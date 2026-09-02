#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runPsql } from "./lib/accelerate-database.mjs";

export const CUTOVER_RECEIPT_VERSION = "tenant-cutover-release.v1";
export const CUTOVER_STAGES = ["repository", "post-migration", "post-deploy", "pre-activation"];
const CANONICAL_ALIAS = "https://www.acceleratewith.us";
const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

function check(id, passed, detail) {
  return { id, status: passed ? "passed" : "blocked", detail };
}

function command(args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if (!allowFailure && result.status !== 0)
    throw new Error((result.stderr || result.stdout || `git ${args.join(" ")} failed`).trim());
  return {
    status: result.status ?? 1,
    stdout: result.stdout.trimEnd(),
    stderr: result.stderr.trim(),
  };
}

function lines(value) {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function evaluateRepository(state, excludedWorktrees = []) {
  const checks = [];
  const exclusions = new Map(
    excludedWorktrees.map((entry) => {
      const separator = entry.lastIndexOf("@");
      return separator > 0 ? [entry.slice(0, separator), entry.slice(separator + 1)] : [entry, ""];
    }),
  );
  const matchedExclusions = new Set(
    state.worktrees
      .slice(1)
      .filter((item) => exclusions.get(item.branch) === item.head)
      .map((item) => item.branch),
  );
  const invalidExclusions = [...exclusions].filter(
    ([branch, head]) => !/^[a-f0-9]{40}$/.test(head) || !matchedExclusions.has(branch),
  );
  const additionalWorktrees = state.worktrees
    .slice(1)
    .filter((item) => !matchedExclusions.has(item.branch));
  const unmergedBranches = state.unmergedBranches.filter(
    (branch) => !matchedExclusions.has(branch),
  );
  checks.push(
    check(
      "repository.branch",
      state.branch === "main",
      state.branch === "main"
        ? "Release branch is main."
        : `Release branch is ${state.branch || "detached"}; expected main.`,
    ),
  );
  checks.push(
    check(
      "repository.clean",
      state.dirtyPaths.length === 0,
      state.dirtyPaths.length === 0
        ? "Release worktree is clean."
        : `${state.dirtyPaths.length} changed path(s) remain: ${state.dirtyPaths.slice(0, 8).join(", ")}${state.dirtyPaths.length > 8 ? ", …" : ""}`,
    ),
  );
  checks.push(
    check(
      "repository.upstream",
      Boolean(state.upstream),
      state.upstream ? `Tracking ${state.upstream}.` : "Release branch has no upstream.",
    ),
  );
  checks.push(
    check(
      "repository.synchronized",
      Boolean(state.upstream) && state.head === state.upstreamHead,
      state.upstream && state.head === state.upstreamHead
        ? `HEAD matches ${state.upstream}.`
        : "HEAD does not match the tracked upstream commit.",
    ),
  );
  checks.push(
    check(
      "repository.exclusions_exact",
      invalidExclusions.length === 0,
      invalidExclusions.length === 0
        ? matchedExclusions.size
          ? "Every worktree exclusion is bound to its exact 40-character commit."
          : "No worktree exclusion is requested."
        : `Invalid or stale worktree exclusion(s): ${invalidExclusions.map(([branch, head]) => `${branch}@${head || "missing-sha"}`).join(", ")}`,
    ),
  );
  checks.push(
    check(
      "repository.single_worktree",
      additionalWorktrees.length === 0,
      additionalWorktrees.length === 0
        ? matchedExclusions.size
          ? `Only exact-commit excluded worktree(s) remain outside release: ${[...matchedExclusions].join(", ")}.`
          : "Only the release worktree is present."
        : `${additionalWorktrees.length} additional worktree(s) require reconciliation or exact-commit exclusion: ${additionalWorktrees.map((item) => `${item.branch}@${item.head} (${item.path})`).join(", ")}`,
    ),
  );
  checks.push(
    check(
      "repository.no_unmerged_branches",
      unmergedBranches.length === 0,
      unmergedBranches.length === 0
        ? matchedExclusions.size
          ? `Only exact-commit excluded unmerged branch(es) remain outside release: ${[...matchedExclusions].join(", ")}.`
          : "No local branch is unmerged into the release commit."
        : `Unmerged local branch(es): ${unmergedBranches.join(", ")}`,
    ),
  );
  const missingFiles = state.requiredTrackedFiles.filter((entry) => !entry.tracked);
  checks.push(
    check(
      "repository.cutover_files_tracked",
      missingFiles.length === 0,
      missingFiles.length === 0
        ? "All cutover migrations and verifiers are tracked by the release commit."
        : `Untracked cutover file(s): ${missingFiles.map((entry) => entry.path).join(", ")}`,
    ),
  );
  return checks;
}

export function readRepositoryState() {
  const branch = command(["branch", "--show-current"]).stdout;
  const head = command(["rev-parse", "HEAD"]).stdout;
  const upstreamResult = command(
    ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
    { allowFailure: true },
  );
  const upstream = upstreamResult.status === 0 ? upstreamResult.stdout : "";
  const upstreamHead = upstream ? command(["rev-parse", upstream]).stdout : "";
  const dirtyPaths = command(["status", "--porcelain=v1", "--untracked-files=all"])
    .stdout.split("\n")
    .filter(Boolean)
    .map((entry) => entry.slice(3));
  const worktreeLines = command(["worktree", "list", "--porcelain"]).stdout.split("\n");
  const worktrees = [];
  let current = null;
  for (const line of worktreeLines) {
    if (line.startsWith("worktree ")) {
      current = { path: line.slice(9), head: "", branch: "detached" };
      worktrees.push(current);
    } else if (current && line.startsWith("HEAD ")) current.head = line.slice(5);
    else if (current && line.startsWith("branch refs/heads/"))
      current.branch = line.slice("branch refs/heads/".length);
  }
  const unmergedBranches = lines(
    command(["branch", "--no-merged", "HEAD", "--format=%(refname:short)"]).stdout,
  ).filter((entry) => entry !== branch);
  const requiredPaths = [
    "migrations/20260830-tenant-uniqueness-cutover.sql",
    "migrations/20260831-tenant-suspension-guards.sql",
    "docs/internal/TENANT-CUTOVER-RUNBOOK.md",
    "scripts/test-tenant-suspension-postgres.mjs",
    "scripts/test-tenant-cutover-readiness.mjs",
    "scripts/verify-tenant-production-isolation.mjs",
    "scripts/verify-tenant-cutover-readiness.mjs",
  ];
  const requiredTrackedFiles = requiredPaths.map((path) => ({
    path,
    tracked: command(["ls-files", "--error-unmatch", path], { allowFailure: true }).status === 0,
  }));
  return {
    branch,
    head,
    upstream,
    upstreamHead,
    dirtyPaths,
    worktrees,
    unmergedBranches,
    requiredTrackedFiles,
  };
}

export function expectedCompatibilityIndexes(sql) {
  return [...sql.matchAll(/CREATE UNIQUE INDEX IF NOT EXISTS (compat_[a-z0-9_]+)/g)]
    .map((match) => match[1])
    .sort();
}

export function expectedLegacyArtifacts(cutoverSql, compatibilitySql) {
  const compatibilityIndexes = expectedCompatibilityIndexes(compatibilitySql);
  const droppedIndexes = [...cutoverSql.matchAll(/DROP INDEX IF EXISTS public\.([a-z0-9_]+)/g)].map(
    (match) => match[1],
  );
  const recreatedCompositePrimaryKeys = new Set([
    "email_templates.email_templates_pkey",
    "admin_settings.admin_settings_pkey",
  ]);
  const droppedConstraints = [
    ...cutoverSql.matchAll(
      /ALTER TABLE public\.([a-z0-9_]+) DROP CONSTRAINT IF EXISTS ([a-z0-9_]+)/g,
    ),
  ]
    .map((match) => `${match[1]}.${match[2]}`)
    .filter((name) => !recreatedCompositePrimaryKeys.has(name));
  return {
    indexes: [...new Set([...compatibilityIndexes, ...droppedIndexes])].sort(),
    constraints: [...new Set(droppedConstraints)].sort(),
  };
}

export function evaluateDatabase(stage, state, expectedArtifacts, tenantSlug) {
  const checks = [];
  checks.push(
    check(
      "database.suspension_guard",
      state.suspensionGuardApplied === true,
      state.suspensionGuardApplied
        ? "Operational RPC authorization rechecks active tenant status."
        : "The tenant suspension guard migration is not applied.",
    ),
  );
  const forbidden = [...state.legacyIndexes, ...state.legacyConstraints].sort();
  checks.push(
    check(
      "database.uniqueness_cutover",
      forbidden.length === 0,
      forbidden.length === 0
        ? `All ${expectedArtifacts.indexes.length} legacy/compatibility indexes and ${expectedArtifacts.constraints.length} global constraints are absent.`
        : `${forbidden.length} obsolete global uniqueness artifact(s) remain: ${forbidden.slice(0, 8).join(", ")}${forbidden.length > 8 ? ", …" : ""}`,
    ),
  );
  checks.push(
    check(
      "database.composite_primary_keys",
      state.emailTemplatesCompositePrimaryKey === true &&
        state.adminSettingsCompositePrimaryKey === true,
      state.emailTemplatesCompositePrimaryKey && state.adminSettingsCompositePrimaryKey
        ? "Email templates and admin settings use tenant-composite primary keys."
        : "Tenant-composite primary-key cutover is incomplete.",
    ),
  );
  checks.push(
    check(
      "database.no_active_client",
      state.activeNonBootstrapTenants === 0,
      state.activeNonBootstrapTenants === 0
        ? "No non-bootstrap tenant is active before controlled activation."
        : `${state.activeNonBootstrapTenants} non-bootstrap tenant(s) are already active.`,
    ),
  );
  checks.push(
    check(
      "database.no_client_provider_effects",
      state.connectedNonBootstrapProviders === 0,
      state.connectedNonBootstrapProviders === 0
        ? "No non-bootstrap provider connection is enabled."
        : `${state.connectedNonBootstrapProviders} non-bootstrap provider connection(s) are enabled.`,
    ),
  );
  if (stage === "pre-activation") {
    checks.push(
      check(
        "activation.target_declared",
        Boolean(tenantSlug),
        tenantSlug
          ? `Activation target is ${tenantSlug}.`
          : "Pre-activation verification requires --tenant=<slug>.",
      ),
    );
    checks.push(
      check(
        "activation.target_exists",
        state.targetTenant?.exists === true,
        state.targetTenant?.exists
          ? `Target tenant exists with status ${state.targetTenant.status}.`
          : `Target tenant ${tenantSlug || "(missing)"} does not exist.`,
      ),
    );
    const safeStatus =
      state.targetTenant?.status === "provisioning" || state.targetTenant?.status === "suspended";
    checks.push(
      check(
        "activation.target_inert",
        safeStatus,
        safeStatus
          ? "Target tenant is inert until the founder performs the activation transition."
          : `Target tenant status ${state.targetTenant?.status || "missing"} is not a safe pre-activation state.`,
      ),
    );
    checks.push(
      check(
        "activation.target_providers_disabled",
        (state.targetTenant?.connectedProviders ?? 0) === 0,
        (state.targetTenant?.connectedProviders ?? 0) === 0
          ? "Target tenant has no connected provider effects."
          : `Target tenant has ${state.targetTenant.connectedProviders} connected provider effect(s).`,
      ),
    );
  }
  return checks;
}

function sqlLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

export function readDatabaseState(tenantSlug, expectedArtifacts) {
  const target = tenantSlug ? sqlLiteral(tenantSlug) : "NULL";
  const indexList = expectedArtifacts.indexes.map(sqlLiteral).join(", ") || "NULL";
  const constraintList =
    expectedArtifacts.constraints.map((entry) => sqlLiteral(entry.split(".")[1])).join(", ") ||
    "NULL";
  const sql = `
    WITH target AS (
      SELECT id, status FROM public.tenants WHERE slug = ${target}
    )
    SELECT jsonb_build_object(
      'suspensionGuardApplied', COALESCE(position('tenant execution is unavailable' IN pg_get_functiondef(to_regprocedure('private.authorized_request_tenant_id()'))) > 0, false),
      'legacyIndexes', COALESCE((SELECT jsonb_agg(indexname ORDER BY indexname) FROM pg_indexes WHERE schemaname = 'public' AND indexname IN (${indexList})), '[]'::jsonb),
      'legacyConstraints', COALESCE((SELECT jsonb_agg(conname ORDER BY conname) FROM pg_constraint WHERE conname IN (${constraintList})), '[]'::jsonb),
      'emailTemplatesCompositePrimaryKey', COALESCE((SELECT pg_get_constraintdef(oid) = 'PRIMARY KEY (tenant_id, template_key)' FROM pg_constraint WHERE conrelid = 'public.email_templates'::regclass AND conname = 'email_templates_pkey'), false),
      'adminSettingsCompositePrimaryKey', COALESCE((SELECT pg_get_constraintdef(oid) = 'PRIMARY KEY (tenant_id, key)' FROM pg_constraint WHERE conrelid = 'public.admin_settings'::regclass AND conname = 'admin_settings_pkey'), false),
      'activeNonBootstrapTenants', (SELECT count(*) FROM public.tenants WHERE id <> public.accelerate_default_tenant_id() AND status = 'active'),
      'connectedNonBootstrapProviders', (SELECT count(*) FROM public.integration_connections WHERE tenant_id <> public.accelerate_default_tenant_id() AND status = 'connected'),
      'targetTenant', jsonb_build_object(
        'exists', EXISTS (SELECT 1 FROM target),
        'status', (SELECT status FROM target),
        'connectedProviders', COALESCE((SELECT count(*) FROM public.integration_connections WHERE tenant_id = (SELECT id FROM target) AND status = 'connected'), 0)
      )
    );`;
  const result = runPsql(["-t", "-A", "--command", sql]);
  if (result.status !== 0)
    throw new Error((result.stderr || result.stdout || "database readiness query failed").trim());
  return JSON.parse(result.stdout.trim());
}

export function evaluateReceipt(receipt, head, tenantSlug) {
  if (!receipt)
    return [check("release.receipt", false, "A release receipt is required after deployment.")];
  const checks = [
    check(
      "release.receipt_version",
      receipt.version === CUTOVER_RECEIPT_VERSION,
      receipt.version === CUTOVER_RECEIPT_VERSION
        ? `Receipt uses ${CUTOVER_RECEIPT_VERSION}.`
        : "Release receipt version is missing or unsupported.",
    ),
    check(
      "release.commit",
      receipt.commitSha === head,
      receipt.commitSha === head
        ? "Receipt commit matches the checked-out release."
        : "Receipt commit does not match HEAD.",
    ),
    check(
      "release.deployment",
      typeof receipt.deploymentReceipt === "string" && receipt.deploymentReceipt.trim().length > 0,
      receipt.deploymentReceipt
        ? "Deployment receipt is present."
        : "Deployment receipt is missing.",
    ),
    check(
      "release.alias",
      receipt.canonicalAlias === CANONICAL_ALIAS,
      receipt.canonicalAlias === CANONICAL_ALIAS
        ? `Canonical alias is ${CANONICAL_ALIAS}.`
        : `Canonical alias must be ${CANONICAL_ALIAS}.`,
    ),
    check(
      "release.verified_at",
      typeof receipt.verifiedAt === "string" && !Number.isNaN(Date.parse(receipt.verifiedAt)),
      receipt.verifiedAt
        ? "Release receipt has a verification timestamp."
        : "Release receipt verification timestamp is missing.",
    ),
  ];
  const evidencePassed = (entry) =>
    entry?.status === "passed" &&
    typeof entry.receipt === "string" &&
    entry.receipt.trim().length > 0;
  const missingMigrations = ["suspensionGuard", "uniquenessCutover"].filter(
    (name) => !evidencePassed(receipt.migrations?.[name]),
  );
  checks.push(
    check(
      "release.migration",
      missingMigrations.length === 0,
      missingMigrations.length === 0
        ? "Suspension and uniqueness migration evidence have concrete receipts."
        : `Missing passed migration receipt(s): ${missingMigrations.join(", ")}.`,
    ),
  );
  const requiredChecks = ["schema", "isolation", "providers", "adminRoutes", "rollback"];
  const missing = requiredChecks.filter((name) => !evidencePassed(receipt.verification?.[name]));
  checks.push(
    check(
      "release.verification",
      missing.length === 0,
      missing.length === 0
        ? "Schema, isolation, provider, admin-route, and rollback evidence have concrete receipts."
        : `Missing passed verification receipt(s): ${missing.join(", ")}.`,
    ),
  );
  if (tenantSlug)
    checks.push(
      check(
        "release.activation_target",
        receipt.activationTarget === tenantSlug,
        receipt.activationTarget === tenantSlug
          ? "Receipt is bound to the requested activation target."
          : "Receipt activation target does not match --tenant.",
      ),
    );
  return checks;
}

export function evaluateDeployment(state, head) {
  const expectedId = head.slice(0, 12);
  return [
    check(
      "deployment.canonical_alias",
      state.homeStatus === 200 && state.homeUrl === `${CANONICAL_ALIAS}/`,
      state.homeStatus === 200
        ? `Canonical alias resolved to ${state.homeUrl}.`
        : `Canonical alias returned HTTP ${state.homeStatus}.`,
    ),
    check(
      "deployment.identity",
      state.deploymentIds.length === 1 && state.deploymentIds[0] === expectedId,
      state.deploymentIds.length === 1 && state.deploymentIds[0] === expectedId
        ? `Canonical HTML serves deployment identity ${expectedId}.`
        : `Canonical HTML deployment identities ${state.deploymentIds.join(", ") || "none"} do not match ${expectedId}.`,
    ),
    check(
      "deployment.tenant_route",
      [302, 307, 308].includes(state.tenantRouteStatus) &&
        state.tenantRouteLocation?.startsWith(
          "/admin/login?redirect=%2Ft%2Faccelerate%2Fadmin%2Ftoday",
        ),
      [302, 307, 308].includes(state.tenantRouteStatus)
        ? "Canonical tenant workspace route reaches the authenticated login boundary."
        : `Tenant workspace route returned HTTP ${state.tenantRouteStatus}.`,
    ),
  ];
}

export async function readDeploymentState() {
  const home = await fetch(`${CANONICAL_ALIAS}/`, { signal: AbortSignal.timeout(15_000) });
  const html = await home.text();
  const deploymentIds = [
    ...new Set([...html.matchAll(/\?dpl=([A-Za-z0-9_-]+)/g)].map((match) => match[1])),
  ];
  const tenantRoute = await fetch(`${CANONICAL_ALIAS}/t/accelerate/admin/today`, {
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });
  return {
    homeStatus: home.status,
    homeUrl: home.url,
    deploymentIds,
    tenantRouteStatus: tenantRoute.status,
    tenantRouteLocation: tenantRoute.headers.get("location"),
  };
}

function readReceipt(path) {
  if (!path) return null;
  const absolute = resolve(repoRoot, path);
  if (!existsSync(absolute)) throw new Error(`Release receipt does not exist: ${path}`);
  return JSON.parse(readFileSync(absolute, "utf8"));
}

function parseArguments(argv) {
  const value = (name) =>
    argv.find((entry) => entry.startsWith(`--${name}=`))?.slice(name.length + 3) || null;
  const stage = value("stage") || "repository";
  if (!CUTOVER_STAGES.includes(stage))
    throw new Error(`--stage must be one of: ${CUTOVER_STAGES.join(", ")}`);
  const excludedWorktrees = argv
    .filter((entry) => entry.startsWith("--exclude-worktree="))
    .map((entry) => entry.slice("--exclude-worktree=".length))
    .filter(Boolean);
  return { stage, tenantSlug: value("tenant"), receiptPath: value("receipt"), excludedWorktrees };
}

export function resultFor(stage, checks) {
  const blockers = checks.filter((entry) => entry.status === "blocked");
  return {
    contract: CUTOVER_RECEIPT_VERSION,
    stage,
    status: blockers.length === 0 ? "ready" : "blocked",
    passed: checks.length - blockers.length,
    blocked: blockers.length,
    checks,
  };
}

async function main() {
  const { stage, tenantSlug, receiptPath, excludedWorktrees } = parseArguments(
    process.argv.slice(2),
  );
  const repositoryState = readRepositoryState();
  const checks = evaluateRepository(repositoryState, excludedWorktrees);
  if (stage !== "repository") {
    const compatibilitySql = readFileSync(
      resolve(repoRoot, "migrations/20260830-tenant-uniqueness-compatibility.sql"),
      "utf8",
    );
    const cutoverSql = readFileSync(
      resolve(repoRoot, "migrations/20260830-tenant-uniqueness-cutover.sql"),
      "utf8",
    );
    const expectedArtifacts = expectedLegacyArtifacts(cutoverSql, compatibilitySql);
    const databaseState = readDatabaseState(tenantSlug, expectedArtifacts);
    checks.push(...evaluateDatabase(stage, databaseState, expectedArtifacts, tenantSlug));
  }
  if (stage === "post-deploy" || stage === "pre-activation") {
    checks.push(...evaluateDeployment(await readDeploymentState(), repositoryState.head));
    checks.push(...evaluateReceipt(readReceipt(receiptPath), repositoryState.head, tenantSlug));
  }
  const output = resultFor(stage, checks);
  console.log(JSON.stringify(output, null, 2));
  process.exitCode = output.status === "ready" ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    console.error(
      JSON.stringify(
        {
          contract: CUTOVER_RECEIPT_VERSION,
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  });
}
