import assert from "node:assert/strict";
import {
  classifyRevenueSchemaContractStatus,
  verifyRevenueSchemaDataAccess,
  computeSchemaCenterStatus,
  REVENUE_SCHEMA_CONTRACT_VERSION,
  type RevenueSchemaIssue,
  type SchemaVerificationRun,
  type SchemaVerificationState,
} from "../src/lib/revenue-os/schema-contract";

function makeIssues(
  records: Array<{ table: string; message?: string; code?: string }>,
): RevenueSchemaIssue[] {
  return records.map((record) => ({
    table: record.table,
    columns: ["id"],
    code: record.code,
    message: record.message ?? "schema contract requirement missing",
  }));
}

function makeState(overrides: Partial<SchemaVerificationState>): SchemaVerificationState {
  const defaultLatest: SchemaVerificationRun = {
    contract_version: REVENUE_SCHEMA_CONTRACT_VERSION,
    status: "success",
    checked_at: "2026-08-17T00:00:00.000Z",
  };
  return {
    runtimeStatus: "success",
    latestVerification: defaultLatest,
    ...overrides,
  };
}

assert.equal(
  classifyRevenueSchemaContractStatus([]),
  "success",
  "A complete contract check should classify as success.",
);

assert.equal(
  classifyRevenueSchemaContractStatus(makeIssues([{ table: "missing_table", code: "42P01" }])),
  "unapplied_migration",
  "A missing table should classify as unapplied migration when all issues are relation-missing.",
);

assert.equal(
  classifyRevenueSchemaContractStatus(
    (() => {
      const driftIssue = makeIssues([
        { table: "some_column", message: "column mismatch", code: "42883" },
      ])[0];
      if (!driftIssue) throw new Error("Expected one drift issue for schema-verification fixture.");
      driftIssue.table = "contacts";
      return [
        ...makeIssues([{ table: "some_table", message: "relation missing", code: "42P01" }]),
        driftIssue,
      ];
    })(),
  ),
  "drift",
  "Mixed metadata misses should classify as drift, not unapplied migration.",
);

assert.equal(
  classifyRevenueSchemaContractStatus(
    makeIssues([{ table: "database", message: "connect ECONNREFUSED 127.0.0.1:54321" }]),
  ),
  "connectivity_failure",
  "Connectivity errors with network failure messages should classify as connectivity_failure.",
);

const mixedConnectivityIssues = [
  ...makeIssues([{ table: "database", message: "could not connect to server" }]),
  ...makeIssues([
    { table: "missing_table", code: "42P01", message: 'relation "missing_table" does not exist' },
  ]),
];

assert.equal(
  classifyRevenueSchemaContractStatus(mixedConnectivityIssues),
  "connectivity_failure",
  "Connectivity failures should dominate unapplied-migration signals when both are present.",
);

assert.equal(
  classifyRevenueSchemaContractStatus(makeIssues([{ table: "any", message: "network" }])),
  "drift",
  "Ambiguous metadata-like placeholders should remain drift when no connectivity signature is present.",
);

const mappedSuccessMissingReceipt = computeSchemaCenterStatus(
  makeState({ runtimeStatus: "success", latestVerification: null }),
);
assert.equal(
  mappedSuccessMissingReceipt.status,
  "action",
  "Runtime success without a successful verification receipt is an action item.",
);

const mappedDrift = computeSchemaCenterStatus(
  makeState({
    runtimeStatus: "drift",
    latestVerification: {
      contract_version: REVENUE_SCHEMA_CONTRACT_VERSION,
      status: "drift",
      checked_at: "2026-08-17T00:00:00.000Z",
      failure_code: "drift",
    },
  }),
);
assert.equal(mappedDrift.status, "degraded", "Drift should surface as degraded in Setup Center.");

const mappedDriftWithSuccessReceipt = computeSchemaCenterStatus(
  makeState({
    runtimeStatus: "drift",
    latestVerification: {
      contract_version: REVENUE_SCHEMA_CONTRACT_VERSION,
      status: "success",
      checked_at: "2026-08-17T00:00:00.000Z",
    },
  }),
);
assert.equal(
  mappedDriftWithSuccessReceipt.status,
  "degraded",
  "Any drift runtime remains degraded even with a stale success receipt.",
);

const mappedConnectivity = computeSchemaCenterStatus(
  makeState({
    runtimeStatus: "connectivity_failure",
    latestVerification: null,
  }),
);
assert.equal(
  mappedConnectivity.status,
  "action",
  "Connectivity failure should still require action.",
);

const mappedUnapplied = computeSchemaCenterStatus(
  makeState({
    runtimeStatus: "unapplied_migration",
    latestVerification: {
      contract_version: REVENUE_SCHEMA_CONTRACT_VERSION,
      status: "unapplied_migration",
      checked_at: "2026-08-17T00:00:00.000Z",
      failure_code: "unapplied_migration",
    },
  }),
);
assert.equal(
  mappedUnapplied.status,
  "action",
  "Unapplied migration should be an action, not degraded.",
);

const mappedHealthy = computeSchemaCenterStatus(
  makeState({
    runtimeStatus: "success",
    latestVerification: {
      contract_version: REVENUE_SCHEMA_CONTRACT_VERSION,
      status: "success",
      checked_at: "2026-08-17T00:00:00.000Z",
    },
  }),
);
assert.equal(
  mappedHealthy.status,
  "ready",
  "Healthy runtime and successful verification must map to Setup readiness.",
);

const mappedStaleSuccess = computeSchemaCenterStatus(
  makeState({
    runtimeStatus: "success",
    latestVerification: {
      contract_version: "revenue-os.2026-08-17.4",
      status: "success",
      checked_at: "2026-08-16T00:00:00.000Z",
    },
  }),
);
assert.equal(
  mappedStaleSuccess.status,
  "action",
  "A mismatched contract version must not be read as ready.",
);

console.log(
  JSON.stringify({ result: "schema contract terminal-state and Setup mapping covered", checks: 9 }),
);

// Regression: a tenant_id-only probe used to accept a half-installed draft table.
async function proveIncompleteFeatureSchema() {
  const database = {
    from(table: string) {
      return {
        select(columns: string) {
          return {
            async limit() {
              return {
                error:
                  table === "site_drafts" && columns.split(",").includes("checksum")
                    ? { code: "42703", message: "column site_drafts.checksum does not exist" }
                    : null,
              };
            },
          };
        },
      };
    },
  } as unknown as Parameters<typeof verifyRevenueSchemaDataAccess>[0];
  const result = await verifyRevenueSchemaDataAccess(database);
  assert.equal(
    result.status,
    "drift",
    "An existing draft table without concurrency fields is not ready",
  );
  assert.ok(result.issues.some((issue) => issue.table === "site_drafts"));
  console.log("Incomplete Site Studio schema is refused even when its tenant column exists.");
}
proveIncompleteFeatureSchema().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
