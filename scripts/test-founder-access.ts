import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { isConfiguredAdmin } from "../src/lib/admin/access";
import { runPsql } from "./lib/accelerate-database.mjs";

function hydrateEnvFromLocalFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const body = readFileSync(filePath, "utf8");
  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const key = match[1];
    const value = match[2];
    if (key === undefined || value === undefined) continue;
    if (process.env[key] === undefined) {
      process.env[key] = value.startsWith('"') && value.endsWith('"')
        ? value.slice(1, -1)
        : value.startsWith("'") && value.endsWith("'")
          ? value.slice(1, -1)
          : value;
    }
  }
}

hydrateEnvFromLocalFile(".env.local");

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3011";
const representativePages = [
  "/admin/setup",
  "/admin/today",
  "/admin/contacts",
  "/admin/pipeline",
  "/admin/pipeline/founder-access-probe",
  "/admin/ai",
  "/admin/ai-operations",
  "/admin/settings",
  "/admin/campaigns",
];
const representativeApis = [
  "/api/admin/setup",
  "/api/admin/revenue-os/pipeline",
  "/api/admin/features",
  "/api/admin/settings",
  "/api/admin/analytics",
  "/api/admin/revenue-os/overview",
  "/api/admin/revenue-os/campaigns",
  "/api/admin/revenue-os/activity?opportunityId=founder-access-probe",
  "/api/admin/revenue-os/records/opportunity/founder-access-probe",
  "/api/admin/revenue-os/ai/conversations",
  "/api/admin/revenue-os/ai/runs",
];
const CANONICAL_ADMIN_MUTATION_TABLES = [
  "contacts",
  "companies",
  "opportunities",
  "stage_events",
  "conversations",
  "messages",
  "campaigns",
  "campaign_steps",
  "campaign_members",
  "activities",
  "action_queue",
  "agent_runs",
  "agent_run_events",
  "integration_connections",
  "calendar_events",
  "drive_documents",
  "proposal_events",
  "source_runs",
  "job_runs",
  "webhook_receipts",
  "audit_log",
  "proposals",
] as const;
type CookieEnvelope = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Strict" | "Lax" | "None";
};

type PolicyAuditRecord = {
  schemaname: string;
  tablename: string;
  policyname: string;
  cmd: string;
  roles: string[];
  qual: string | null;
  with_check: string | null;
};

const MUTATION_COMMANDS = new Set(["INSERT", "UPDATE", "DELETE", "ALL"]);

function buildSqlTextArray(values: readonly string[]) {
  return values.map((value) => `'${value.replace(/'/g, "''")}'`).join(", ");
}

function runAuthenticatedMutationPolicyAudit() {
  const policyRows = runPolicyAuditRows();
  const mutationRows = policyRows.filter((row) => MUTATION_COMMANDS.has(row.cmd.toUpperCase()));
  if (mutationRows.length > 0) {
    const violations = mutationRows
      .map((row) => `${row.tablename}.${row.policyname}.${row.cmd}`)
      .join(", ");
    throw new Error(`Authenticated mutation policy rows found on canonical admin tables: ${violations}`);
  }

  console.log(`founder-access-policy-audit: checked ${policyRows.length} authenticated policy rows; no mutating policies on canonical admin tables.`);
}

function runPolicyAuditRows() {
  const query = `
    WITH canonical_policies AS (
      SELECT
        schemaname,
        tablename,
        policyname,
        cmd,
        roles,
        qual,
        with_check
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = ANY (ARRAY[${buildSqlTextArray(CANONICAL_ADMIN_MUTATION_TABLES)}]::text[])
        AND roles IS NOT NULL
        AND 'authenticated' = ANY (roles::text[])
    )
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'schemaname', schemaname,
          'tablename', tablename,
          'policyname', policyname,
          'cmd', cmd,
          'roles', roles,
          'qual', qual,
          'with_check', with_check
        )
        ORDER BY schemaname, tablename, policyname
      ),
      '[]'::json
    ) AS records
    FROM canonical_policies;
  `;
  const result = runPsql(["-q", "-A", "-t", "-c", query]);
  if (result.status !== 0) {
    const stderr = (result.stderr ?? "").toString().trim();
    const stdout = (result.stdout ?? "").toString().trim();
    throw new Error(`psql policy audit failed: ${stderr || stdout || "PSQL execution failed"}`);
  }
  const raw = (result.stdout ?? "").toString().trim();
  if (!raw) throw new Error("psql policy audit returned no output.");
  const parsed = JSON.parse(raw);
  const rows = Array.isArray(parsed)
    ? parsed
    : parsed && Array.isArray(parsed.records)
      ? parsed.records
      : [];
  return rows as PolicyAuditRecord[];
}

function runPolicyAuditIfAvailable(): boolean {
  try {
    const smoke = runPsql(["-q", "-A", "-t", "-c", "SELECT 1;"]);
    return smoke.status === 0;
  } catch (error) {
    if (error instanceof Error) {
      console.log(`Skipping founder-access policy audit: ${error.message}`);
    } else {
      console.log("Skipping founder-access policy audit: database unavailable.");
    }
    return false;
  }
}

if (!process.env.ADMIN_EMAIL) {
  throw new Error("ADMIN_EMAIL is required for founder-access control tests.");
}
const configuredFounderEmail = process.env.ADMIN_EMAIL;
const nonFounderEmail = configuredFounderEmail.toLowerCase().startsWith("founder") ? "ops@example.com" : "founder@example.com";

assert.equal(isConfiguredAdmin(`  ${configuredFounderEmail}  `), true, "Configured admin email should pass a normalized auth match.");
assert.equal(isConfiguredAdmin(nonFounderEmail), false, "Non-founder email should fail the configured-admin predicate.");

async function collectChunks(root: string): Promise<string[]> {
  if (!existsSync(root)) return [];
  const entries = readdirSync(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectChunks(fullPath));
      continue;
    }
    if (fullPath.endsWith(".js") || fullPath.endsWith(".mjs") || fullPath.endsWith(".js.gz")) {
      files.push(fullPath);
    }
  }
  return files;
}

function normalizeCookieEntries(source?: string): CookieEnvelope[] {
  if (!source) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((cookie) => ({
      name: String((cookie as Record<string, unknown>).name ?? ""),
      value: String((cookie as Record<string, unknown>).value ?? ""),
      domain: String((cookie as Record<string, unknown>).domain ?? "localhost"),
      path: String((cookie as Record<string, unknown>).path ?? "/"),
      expires: Number((cookie as Record<string, unknown>).expires ?? 0),
      httpOnly: typeof (cookie as Record<string, unknown>).httpOnly === "boolean"
        ? Boolean((cookie as Record<string, unknown>).httpOnly)
        : false,
      secure: typeof (cookie as Record<string, unknown>).secure === "boolean"
        ? Boolean((cookie as Record<string, unknown>).secure)
        : false,
      sameSite: (
        ((cookie) => {
          const candidate = (cookie as Record<string, unknown>).sameSite;
          return candidate === "Strict" || candidate === "Lax" || candidate === "None" ? candidate : "Lax";
        })((cookie as Record<string, unknown>)) as CookieEnvelope["sameSite"]
      ),
    }))
    .filter((cookie) => cookie.name && cookie.domain);
}

function toBase64CookiePayload(payload: unknown, baseUrl: string): CookieEnvelope[] {
  if (!payload || typeof payload !== "object") return [];
  const projectRef = (() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return "";
    try {
      return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
    } catch {
      return "";
    }
  })();
  if (!projectRef) return [];
  const expiresAt = Number((payload as { expires_at?: string | number }).expires_at);
  const expires = Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt : 0;
  return [{
    name: `sb-${projectRef}-auth-token`,
    value: `base64-${Buffer.from(JSON.stringify(payload)).toString("base64url")}`,
    domain: new URL(baseUrl).hostname,
    path: "/",
    expires,
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
  }];
}

async function loadSessionCookiesFromSupabase(email: string, baseUrl: string): Promise<CookieEnvelope[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${baseUrl}/admin/setup` },
  });
  if (linkError || !linkData?.properties?.hashed_token) return [];

  const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyError || !verified?.session) return [];
  return toBase64CookiePayload(verified.session, baseUrl);
}

async function pickNonFounderAdminEmailFromSupabase(founderEmail: string): Promise<string | undefined> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return undefined;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const founderEmailLower = founderEmail.toLowerCase().trim();
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error || !data?.users?.length) return undefined;
  const user = data.users.find((candidate) => {
    if (!candidate.email) return false;
    return candidate.email.toLowerCase().trim() !== founderEmailLower;
  });
  return user?.email ? user.email.toLowerCase().trim() : undefined;
}

type DisposableNonFounderSession = {
  email: string;
  userId: string;
};

function isLocalAppHost(): boolean {
  try {
    const hostname = new URL(BASE_URL).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local");
  } catch {
    return true;
  }
}

async function createDisposableNonFounderUserIfPossible(founderEmail: string): Promise<DisposableNonFounderSession | undefined> {
  if (!isLocalAppHost()) return undefined;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return undefined;

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `nonfounder-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  if (email.toLowerCase().trim() === founderEmail.toLowerCase().trim()) return undefined;

  const { data: createData, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: "P@ssw0rd!",
    email_confirm: true,
  });
  if (createError || !createData?.user?.id) return undefined;

  return { email: createData.user.email!.toLowerCase(), userId: createData.user.id };
}

async function deleteDisposableNonFounderUser(userId: string) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await supabase.auth.admin.deleteUser(userId, true);
}

async function resolveNonFounderAuthContext(
  founderEmail: string,
): Promise<{ cookies: CookieEnvelope[]; disposableUserId?: string }> {
  const explicitNonFounderEmail = process.env.NONFOUNDER_ADMIN_EMAIL?.trim().toLowerCase();
  if (explicitNonFounderEmail && explicitNonFounderEmail !== founderEmail.toLowerCase()) {
    console.log(`Using explicit NONFOUNDER_ADMIN_EMAIL for non-founder fail-closed assertion: ${explicitNonFounderEmail}`);
    return { cookies: await loadSessionCookiesFromSupabase(explicitNonFounderEmail, BASE_URL) };
  }

  const discoveredEmail = await pickNonFounderAdminEmailFromSupabase(founderEmail);
  if (discoveredEmail && discoveredEmail !== founderEmail.toLowerCase()) {
    console.log(`Auto-selected non-founder auth user for fail-closed assertion: ${discoveredEmail}`);
    return { cookies: await loadSessionCookiesFromSupabase(discoveredEmail, BASE_URL) };
  }

  if (!isLocalAppHost()) {
    console.log("No non-founder auth user available for authenticated fail-closed branch. Set NONFOUNDER_ADMIN_EMAIL or NONFOUNDER_ADMIN_COOKIES to exercise this assertion.");
    return { cookies: [] };
  }

  const disposable = await createDisposableNonFounderUserIfPossible(founderEmail);
  if (!disposable) {
    console.log("Could not create a disposable non-founder auth user in local auth; skipping authenticated fail-closed assertion.");
    return { cookies: [] };
  }

  const cookies = await loadSessionCookiesFromSupabase(disposable.email, BASE_URL);
  if (!cookies.length) {
    await deleteDisposableNonFounderUser(disposable.userId);
    console.log("Could not mint a disposable non-founder session cookie; skipping authenticated fail-closed assertion.");
    return { cookies: [] };
  }
  return { cookies, disposableUserId: disposable.userId };
}

async function assertAuthenticatedSessionFailure(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  cookies: CookieEnvelope[],
  label: string,
) {
  if (!cookies.length) {
    console.log(`${label} not set or invalid; skipping authenticated fail-closed assertion for non-founder path.`);
    return;
  }
  const context = await browser.newContext({
    storageState: { cookies, origins: [] },
    viewport: { width: 1280, height: 840 },
  });
  const page = await context.newPage();
  for (const pagePath of representativePages) {
    const response = await page.goto(`${BASE_URL}${pagePath}`, { waitUntil: "domcontentloaded" });
    const responseStatus = response?.status();
    assert.equal(
      page.url().includes("/admin/login") || responseStatus === 401 || responseStatus === 403,
      true,
      `Authenticated non-founder to ${pagePath} should not access protected content (${responseStatus}).`,
    );
  }
  for (const apiPath of representativeApis) {
    const response = await context.request.get(`${BASE_URL}${apiPath}`);
    assert.ok(response.status() === 401 || response.status() === 403, `Authenticated non-founder request to ${apiPath} should fail closed with 401/403; got ${response.status()}.`);
  }
  await context.close();
}

async function assertAuthenticatedSessionSuccess(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  cookies: CookieEnvelope[],
  label: string,
) {
  if (!cookies.length) {
    console.log(`${label} not set or invalid; skipping authenticated founder success assertion.`);
    return;
  }
  const context = await browser.newContext({
    storageState: { cookies, origins: [] },
    viewport: { width: 1280, height: 840 },
  });
  const page = await context.newPage();
  const response = await page.goto(`${BASE_URL}/admin/setup`, { waitUntil: "domcontentloaded" });
  assert.equal(response?.status(), 200, "Founder-authenticated session should load protected admin pages.");
  await context.close();
}

const main = async () => {
  let founderCookies = normalizeCookieEntries(process.env.FOUNDER_ADMIN_COOKIES);
  let nonFounderCookies = normalizeCookieEntries(process.env.NONFOUNDER_ADMIN_COOKIES);
  let disposableNonFounderUserId: string | undefined;
  if (!founderCookies.length) {
    founderCookies = await loadSessionCookiesFromSupabase(configuredFounderEmail, BASE_URL);
  }
  if (!nonFounderCookies.length) {
    const { cookies, disposableUserId } = await resolveNonFounderAuthContext(configuredFounderEmail);
    nonFounderCookies = cookies;
    disposableNonFounderUserId = disposableUserId;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 840 } });
  const canRunPolicyAudit = runPolicyAuditIfAvailable();

  try {
    for (const pagePath of representativePages) {
      const page = await context.newPage();
      const response = await page.goto(`${BASE_URL}${pagePath}`, { waitUntil: "domcontentloaded" });
      if (!response) throw new Error(`No response for ${pagePath}`);
      const responseStatus = response.status();
      assert.equal(
        page.url().includes("/admin/login") || responseStatus === 401 || responseStatus === 403,
        true,
        `Unauthenticated request to ${pagePath} must not return protected content (${responseStatus}).`,
      );
      await page.close();
    }

    for (const apiPath of representativeApis) {
      const response = await context.request.get(`${BASE_URL}${apiPath}`);
      assert.ok(response.status() === 401 || response.status() === 403, `Unauthenticated API request to ${apiPath} should fail closed with 401/403; got ${response.status()}.`);
    }

    const chunksRoot = ".next/static";
    if (!existsSync(chunksRoot)) {
      throw new Error("Browser bundle artifacts not found. Run npm run build before founder-access static coverage.");
    }

    const sensitiveEnvValues = [
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      process.env.SUPABASE_URL,
      process.env.OPENROUTER_API_KEY,
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_TOKEN_ENCRYPTION_KEY,
      process.env.RESEND_API_KEY,
      process.env.PLAUSIBLE_API_KEY,
      process.env.CRON_SECRET,
      process.env.CALENDLY_PERSONAL_ACCESS_TOKEN,
      process.env.CALENDLY_WEBHOOK_SECRET,
    ].filter((value): value is string => Boolean(value && value.length > 6));

    const forbiddenBundlePatterns = [
      /\bprocess\.env\.GOOGLE_CLIENT_ID\b/,
      /\bprocess\.env\.GOOGLE_CLIENT_SECRET\b/,
      /\bprocess\.env\.GOOGLE_TOKEN_ENCRYPTION_KEY\b/,
      /\bprocess\.env\.OPENROUTER_API_KEY\b/,
      /\bprocess\.env\.RESEND_API_KEY\b/,
      /\bprocess\.env\.PLAUSIBLE_API_KEY\b/,
      /\bprocess\.env\.CRON_SECRET\b/,
      /\bprocess\.env\.CALENDLY_PERSONAL_ACCESS_TOKEN\b/,
      /\bprocess\.env\.CALENDLY_WEBHOOK_SECRET\b/,
      /\bprocess\.env\.SUPABASE_SERVICE_ROLE_KEY\b/,
      /\bprocess\.env\.SUPABASE_URL\b/,
    ];
    for (const chunk of await collectChunks(chunksRoot)) {
      const body = readFileSync(chunk, "utf8");
      if (sensitiveEnvValues.some((value) => body.includes(value))) {
        throw new Error(`Browser bundle ${chunk} appears to contain secret value materiality.`);
      }
      for (const pattern of forbiddenBundlePatterns) {
        if (pattern.test(body)) {
          throw new Error(`Browser bundle ${chunk} appears to contain client-readable server env reference (${pattern}).`);
        }
      }
    }

    await assertAuthenticatedSessionSuccess(browser, founderCookies, "FOUNDER_ADMIN_COOKIES");
    await assertAuthenticatedSessionFailure(browser, nonFounderCookies, "NONFOUNDER_ADMIN_COOKIES");
    if (canRunPolicyAudit) {
      runAuthenticatedMutationPolicyAudit();
    } else {
      console.log("Skipping canonical admin policy audit due DB access or local environment constraints.");
    }
    const checks = representativePages.length
      + representativeApis.length
      + 1
      + (founderCookies.length ? 1 : 0)
      + (nonFounderCookies.length ? 1 : 0)
      + (canRunPolicyAudit ? 1 : 0);
    const coverageMessage = [
      "founder access, unauthenticated gates, authenticated fail-closed checks, browser-bundle service-role exposure checks",
      canRunPolicyAudit ? "canonical admin policy audit covered" : "canonical admin policy audit skipped (environment constraints)",
    ].join(", ");
    console.log(JSON.stringify({
      checks,
      result: coverageMessage,
    }));
  } finally {
    if (disposableNonFounderUserId) {
      await deleteDisposableNonFounderUser(disposableNonFounderUserId).catch(() => {
        // Best effort cleanup for test-only local fixtures.
      });
      disposableNonFounderUserId = undefined;
    }
    await context.close();
    await browser.close();
  }

};

void main();
