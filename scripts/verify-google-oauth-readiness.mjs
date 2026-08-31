#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runPsql } from "./lib/accelerate-database.mjs";

export const GOOGLE_READINESS_VERSION = "google-oauth-readiness.v1";
export const GOOGLE_READINESS_STAGES = ["source", "production"];
export const REQUIRED_GOOGLE_ENV = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_TOKEN_ENCRYPTION_KEY"];
export const REQUIRED_GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/drive.readonly",
];

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

function check(id, passed, detail) {
  return { id, status: passed ? "passed" : "blocked", detail };
}

export function evaluateSource(source) {
  const scopeOrder = REQUIRED_GOOGLE_SCOPES.map((scope) => source.google.indexOf(`"${scope}"`));
  const exactScopesPresent = scopeOrder.every((index) => index >= 0) && scopeOrder.every((index, position) => position === 0 || index > scopeOrder[position - 1]);
  return [
    check("source.minimum_scopes", exactScopesPresent && !/auth\/drive(?:["'])/.test(source.google), "OAuth requests the declared Gmail read/send, Calendar events, and Drive read-only scope set."),
    check("source.tenant_composite_upserts", ["tenant_id,provider", "tenant_id,provider,external_id"].every((target) => source.google.includes(`onConflict: "${target}"`)), "Google connection, Calendar, and Drive writes declare tenant-composite conflict keys."),
    check("source.signed_state", source.authorize.includes("createGoogleOAuthStateBinding") && source.callback.includes("verifyGoogleOAuthStateBinding"), "OAuth state is authenticated, expires, and remains bound to tenant ID and slug."),
    check("source.safe_errors", source.callback.includes("googleOperatorError") && !source.callback.includes("error.message") && !source.authorize.includes("error.message"), "OAuth redirects expose stable error codes rather than provider or database messages."),
    check("source.drive_boundary", source.google.includes("slice(0, 10)") && source.syncRoute.includes("driveFolderIds.length > 10"), "Drive selection and execution remain bounded to ten explicit folder IDs."),
  ];
}

export function readSourceState() {
  const read = (path) => readFileSync(resolve(repoRoot, path), "utf8");
  return {
    google: read("src/lib/revenue-os/google.ts"),
    authorize: read("src/app/api/admin/google/authorize/route.ts"),
    callback: read("src/app/api/admin/google/callback/route.ts"),
    syncRoute: read("src/app/api/admin/google/sync/route.ts"),
  };
}

export function evaluateProductionEnvironment(envNames) {
  const missing = REQUIRED_GOOGLE_ENV.filter((name) => !envNames.includes(name));
  return [check("production.environment", missing.length === 0, missing.length === 0
    ? "All three Google OAuth and encryption variables exist in Vercel Production; values were not read."
    : `Missing Vercel Production variable name(s): ${missing.join(", ")}.`)];
}

export function readProductionEnvironment() {
  const result = spawnSync("npx", ["vercel", "env", "ls", "production", "--format", "json", "--non-interactive"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || "Vercel Production environment lookup failed").trim());
  const parsed = JSON.parse(result.stdout);
  return (parsed.envs ?? []).map((entry) => entry.key).filter((key) => typeof key === "string");
}

export function evaluateProductionDatabase(state) {
  const scopes = state.connection?.scopes ?? [];
  const missingScopes = REQUIRED_GOOGLE_SCOPES.filter((scope) => !scopes.includes(scope));
  const folders = state.connection?.driveFolderIds ?? [];
  const driveRun = state.runs?.google_drive ?? null;
  const driveReady = folders.length === 0
    ? !driveRun || driveRun.status === "not_configured"
    : driveRun?.status === "success" && Boolean(driveRun.finishedAt);
  return [
    check("production.tenant_active", state.tenantStatus === "active", state.tenantStatus === "active" ? "The bootstrap tenant is active." : `Bootstrap tenant status is ${state.tenantStatus || "missing"}.`),
    check("production.connection", state.connection?.exists === true && state.connection.status === "connected" && state.connection.accountEmailPresent === true, state.connection?.exists ? `Google connection status is ${state.connection.status}; account identity ${state.connection.accountEmailPresent ? "is" : "is not"} present.` : "No bootstrap Google connection exists."),
    check("production.encrypted_credentials", state.connection?.refreshEnvelopeValid === true && state.connection?.accessEnvelopeValid === true && state.connection?.tokenExpiresAtPresent === true, state.connection?.refreshEnvelopeValid && state.connection?.accessEnvelopeValid ? "Access and refresh credentials use the supported encrypted envelope." : "Encrypted Google access and refresh credentials are not both usable."),
    check("production.scopes", missingScopes.length === 0, missingScopes.length === 0 ? "The connected account granted every declared minimum scope." : `Missing granted scope(s): ${missingScopes.join(", ")}.`),
    check("production.gmail_first_sync", state.runs?.gmail?.status === "success" && Boolean(state.runs.gmail.finishedAt), state.runs?.gmail ? `Latest Gmail source run is ${state.runs.gmail.status}.` : "No Gmail source-run receipt exists."),
    check("production.calendar_first_sync", state.runs?.google_calendar?.status === "success" && Boolean(state.runs.google_calendar.finishedAt), state.runs?.google_calendar ? `Latest Calendar source run is ${state.runs.google_calendar.status}.` : "No Google Calendar source-run receipt exists."),
    check("production.drive_boundary", state.connection?.driveFoldersValid === true && folders.length <= 10 && driveReady, state.connection?.driveFoldersValid !== true ? "Drive folder settings are unavailable or invalid." : folders.length === 0 ? "No Drive folders are selected; Drive is correctly absent or not configured." : `${folders.length} selected Drive folder(s) have a successful bounded source receipt.`),
  ];
}

export function readProductionDatabase() {
  const sql = String.raw`
    WITH bootstrap AS (
      SELECT id, status FROM public.tenants WHERE id = public.accelerate_default_tenant_id()
    ), connection AS (
      SELECT
        status,
        account_email IS NOT NULL AND length(trim(account_email)) > 0 AS account_email_present,
        encrypted_refresh_token ~ '^v1[.][A-Za-z0-9_-]+[.][A-Za-z0-9_-]+[.][A-Za-z0-9_-]+$' AS refresh_envelope_valid,
        encrypted_access_token ~ '^v1[.][A-Za-z0-9_-]+[.][A-Za-z0-9_-]+[.][A-Za-z0-9_-]+$' AS access_envelope_valid,
        token_expires_at IS NOT NULL AS token_expires_at_present,
        scopes,
        settings
      FROM public.integration_connections
      WHERE tenant_id = (SELECT id FROM bootstrap) AND provider = 'google'
    ), latest_runs AS (
      SELECT DISTINCT ON (source_key) source_key, status, finished_at
      FROM public.source_runs
      WHERE tenant_id = (SELECT id FROM bootstrap)
        AND source_key IN ('gmail', 'google_calendar', 'google_drive')
      ORDER BY source_key, started_at DESC
    )
    SELECT jsonb_build_object(
      'tenantStatus', (SELECT status FROM bootstrap),
      'connection', jsonb_build_object(
        'exists', EXISTS (SELECT 1 FROM connection),
        'status', (SELECT status FROM connection),
        'accountEmailPresent', COALESCE((SELECT account_email_present FROM connection), false),
        'refreshEnvelopeValid', COALESCE((SELECT refresh_envelope_valid FROM connection), false),
        'accessEnvelopeValid', COALESCE((SELECT access_envelope_valid FROM connection), false),
        'tokenExpiresAtPresent', COALESCE((SELECT token_expires_at_present FROM connection), false),
        'scopes', COALESCE((SELECT to_jsonb(scopes) FROM connection), '[]'::jsonb),
        'driveFolderIds', COALESCE((SELECT settings->'drive_folder_ids' FROM connection), '[]'::jsonb),
        'driveFoldersValid', COALESCE((SELECT CASE WHEN jsonb_typeof(COALESCE(settings->'drive_folder_ids', '[]'::jsonb)) = 'array' THEN
          NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(settings->'drive_folder_ids', '[]'::jsonb)) item WHERE jsonb_typeof(item) <> 'string' OR length(trim(item #>> '{}')) = 0)
          ELSE false END
          FROM connection), false)
      ),
      'runs', COALESCE((SELECT jsonb_object_agg(source_key, jsonb_build_object('status', status, 'finishedAt', finished_at)) FROM latest_runs), '{}'::jsonb)
    );`;
  const result = runPsql(["-t", "-A", "--command", sql]);
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || "Google readiness database query failed").trim());
  return JSON.parse(result.stdout.trim());
}

export function readinessResult(stage, checks) {
  const blocked = checks.filter((entry) => entry.status === "blocked");
  return { contract: GOOGLE_READINESS_VERSION, stage, status: blocked.length ? "blocked" : "ready", passed: checks.length - blocked.length, blocked: blocked.length, checks };
}

function parseStage(argv) {
  const stage = argv.find((entry) => entry.startsWith("--stage="))?.slice("--stage=".length) || "source";
  if (!GOOGLE_READINESS_STAGES.includes(stage)) throw new Error(`--stage must be one of: ${GOOGLE_READINESS_STAGES.join(", ")}`);
  return stage;
}

async function main() {
  const stage = parseStage(process.argv.slice(2));
  const checks = evaluateSource(readSourceState());
  if (stage === "production") {
    checks.push(...evaluateProductionEnvironment(readProductionEnvironment()));
    checks.push(...evaluateProductionDatabase(readProductionDatabase()));
  }
  const output = readinessResult(stage, checks);
  console.log(JSON.stringify(output, null, 2));
  process.exitCode = output.status === "ready" ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    console.error(JSON.stringify({ contract: GOOGLE_READINESS_VERSION, status: "error", error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 1;
  });
}
