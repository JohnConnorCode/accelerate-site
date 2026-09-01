import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CUTOVER_RECEIPT_VERSION,
  evaluateDatabase,
  evaluateDeployment,
  evaluateReceipt,
  evaluateRepository,
  expectedCompatibilityIndexes,
  expectedLegacyArtifacts,
  readDatabaseState,
  resultFor,
} from "./verify-tenant-cutover-readiness.mjs";

const compatibilitySql = readFileSync(
  "migrations/20260830-tenant-uniqueness-compatibility.sql",
  "utf8",
);
const cutoverSql = readFileSync("migrations/20260830-tenant-uniqueness-cutover.sql", "utf8");
const expectedIndexes = expectedCompatibilityIndexes(compatibilitySql);
const expectedArtifacts = expectedLegacyArtifacts(cutoverSql, compatibilitySql);
assert.equal(
  expectedIndexes.length,
  28,
  "the release gate must inventory every temporary compatibility index",
);
assert.ok(
  expectedArtifacts.indexes.length > expectedIndexes.length,
  "the release gate must also inventory original-name global indexes",
);
assert.equal(
  expectedArtifacts.constraints.length,
  10,
  "the release gate must inventory every removed global uniqueness constraint",
);

const cleanRepository = {
  branch: "main",
  head: "a".repeat(40),
  upstream: "origin/main",
  upstreamHead: "a".repeat(40),
  dirtyPaths: [],
  worktrees: [{ path: "/repo", branch: "main", head: "a".repeat(40) }],
  unmergedBranches: [],
  requiredTrackedFiles: [{ path: "migration.sql", tracked: true }],
};
assert.equal(resultFor("repository", evaluateRepository(cleanRepository)).status, "ready");
assert.equal(
  resultFor(
    "repository",
    evaluateRepository(
      {
        ...cleanRepository,
        worktrees: [
          ...cleanRepository.worktrees,
          { path: "/tmp/investigation", branch: "investigation", head: "b".repeat(40) },
        ],
        unmergedBranches: ["investigation"],
      },
      [`investigation@${"b".repeat(40)}`],
    ),
  ).status,
  "ready",
);
assert.equal(
  resultFor(
    "repository",
    evaluateRepository(
      {
        ...cleanRepository,
        worktrees: [
          ...cleanRepository.worktrees,
          { path: "/tmp/investigation", branch: "investigation", head: "b".repeat(40) },
        ],
        unmergedBranches: ["investigation"],
      },
      ["investigation"],
    ),
  ).status,
  "blocked",
);
for (const mutation of [
  { dirtyPaths: ["src/app/page.tsx"] },
  { upstreamHead: "b".repeat(40) },
  {
    worktrees: [
      ...cleanRepository.worktrees,
      { path: "/tmp/investigation", branch: "investigation", head: "b".repeat(40) },
    ],
  },
  { unmergedBranches: ["investigation"] },
  { requiredTrackedFiles: [{ path: "migration.sql", tracked: false }] },
]) {
  assert.equal(
    resultFor("repository", evaluateRepository({ ...cleanRepository, ...mutation })).status,
    "blocked",
  );
}

const safeDatabase = {
  suspensionGuardApplied: true,
  legacyIndexes: [],
  legacyConstraints: [],
  emailTemplatesCompositePrimaryKey: true,
  adminSettingsCompositePrimaryKey: true,
  activeNonBootstrapTenants: 0,
  connectedNonBootstrapProviders: 0,
  targetTenant: { exists: true, status: "provisioning", connectedProviders: 0 },
};
assert.equal(
  resultFor("post-migration", evaluateDatabase("post-migration", safeDatabase, expectedArtifacts))
    .status,
  "ready",
);
assert.equal(
  resultFor(
    "post-migration",
    evaluateDatabase(
      "post-migration",
      { ...safeDatabase, suspensionGuardApplied: false },
      expectedArtifacts,
    ),
  ).status,
  "blocked",
);
assert.equal(
  resultFor(
    "post-migration",
    evaluateDatabase(
      "post-migration",
      { ...safeDatabase, legacyIndexes: [expectedArtifacts.indexes[0]] },
      expectedArtifacts,
    ),
  ).status,
  "blocked",
);
assert.equal(
  resultFor(
    "post-migration",
    evaluateDatabase(
      "post-migration",
      { ...safeDatabase, emailTemplatesCompositePrimaryKey: false },
      expectedArtifacts,
    ),
  ).status,
  "blocked",
);

const postDeployDatabase = safeDatabase;
assert.equal(
  resultFor("post-deploy", evaluateDatabase("post-deploy", postDeployDatabase, expectedArtifacts))
    .status,
  "ready",
);

const receipt = {
  version: CUTOVER_RECEIPT_VERSION,
  commitSha: cleanRepository.head,
  deploymentReceipt: "deployment_123",
  canonicalAlias: "https://www.acceleratewith.us",
  verifiedAt: "2026-08-31T13:45:00.000Z",
  migrations: {
    suspensionGuard: { status: "passed", receipt: "migration-suspension-guard" },
    uniquenessCutover: { status: "passed", receipt: "44 indexes and 10 constraints absent" },
  },
  verification: {
    schema: { status: "passed", receipt: "402/402" },
    isolation: { status: "passed", receipt: "controlled-proof" },
    providers: { status: "passed", receipt: "provider-suite" },
    adminRoutes: { status: "passed", receipt: "retained-route-matrix" },
    rollback: { status: "passed", receipt: "suspension-proof" },
  },
  activationTarget: "controlled-client",
};
assert.equal(
  resultFor("post-deploy", evaluateReceipt(receipt, cleanRepository.head)).status,
  "ready",
);
assert.equal(
  resultFor(
    "post-deploy",
    evaluateReceipt({ ...receipt, commitSha: "b".repeat(40) }, cleanRepository.head),
  ).status,
  "blocked",
);
assert.equal(
  resultFor(
    "post-deploy",
    evaluateReceipt(
      {
        ...receipt,
        verification: { ...receipt.verification, providers: { status: "passed", receipt: "" } },
      },
      cleanRepository.head,
    ),
  ).status,
  "blocked",
);
const deployment = {
  homeStatus: 200,
  homeUrl: "https://www.acceleratewith.us/",
  deploymentIds: [cleanRepository.head.slice(0, 12)],
  tenantRouteStatus: 307,
  tenantRouteLocation: "/admin/login?redirect=%2Ft%2Faccelerate%2Fadmin%2Ftoday",
};
assert.equal(
  resultFor("post-deploy", evaluateDeployment(deployment, cleanRepository.head)).status,
  "ready",
);
assert.equal(
  resultFor(
    "post-deploy",
    evaluateDeployment({ ...deployment, deploymentIds: ["stale-release"] }, cleanRepository.head),
  ).status,
  "blocked",
);
assert.equal(
  resultFor("pre-activation", [
    ...evaluateDatabase(
      "pre-activation",
      postDeployDatabase,
      expectedArtifacts,
      "controlled-client",
    ),
    ...evaluateReceipt(receipt, cleanRepository.head, "controlled-client"),
  ]).status,
  "ready",
);

for (const unsafe of [
  { activeNonBootstrapTenants: 1 },
  { connectedNonBootstrapProviders: 1 },
  { targetTenant: { exists: true, status: "active", connectedProviders: 0 } },
  { targetTenant: { exists: true, status: "provisioning", connectedProviders: 1 } },
]) {
  assert.equal(
    resultFor(
      "pre-activation",
      evaluateDatabase(
        "pre-activation",
        { ...postDeployDatabase, ...unsafe },
        expectedArtifacts,
        "controlled-client",
      ),
    ).status,
    "blocked",
  );
}

const databaseReaderSource = readDatabaseState.toString();
assert.doesNotMatch(
  databaseReaderSource,
  /\b(?:DELETE\s+FROM|UPDATE\s+public\.|INSERT\s+INTO|TRUNCATE|DROP\s+TABLE|ALTER\s+TABLE|CREATE\s+TABLE)\b/i,
  "cutover readiness must remain read-only",
);
const productionProofSource = readFileSync(
  "scripts/verify-tenant-production-isolation.mjs",
  "utf8",
);
assert.ok(
  productionProofSource.includes("--confirm-controlled-production-isolation"),
  "production isolation proof must require an explicit mutation confirmation",
);
assert.ok(
  productionProofSource.includes('PROJECT_REF = "skjypuwkceoiunyhhqlm"') &&
    productionProofSource.includes("`${PROJECT_REF}.supabase.co`"),
  "production isolation proof must remain fixed to the Accelerate project",
);
assert.match(
  productionProofSource,
  /finally \{[\s\S]*Promise\.allSettled[\s\S]*setStatus\(tenant, "suspended"/,
  "production proof failures must always suspend every controlled tenant",
);
console.log(
  JSON.stringify({
    result: "passed",
    repositoryFailureModes: 5,
    compatibilityIndexes: expectedIndexes.length,
    activationFailureModes: 4,
    productionMutationGuard: true,
  }),
);
