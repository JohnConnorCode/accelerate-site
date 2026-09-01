import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  REQUIRED_GOOGLE_ENV,
  REQUIRED_GOOGLE_SCOPES,
  evaluateProductionDatabase,
  evaluateProductionEnvironment,
  evaluateSource,
  readinessResult,
  readProductionDatabase,
  readSourceState,
} from "./verify-google-oauth-readiness.mjs";

assert.equal(readinessResult("source", evaluateSource(readSourceState())).status, "ready");
assert.equal(
  readinessResult("production", evaluateProductionEnvironment(REQUIRED_GOOGLE_ENV)).status,
  "ready",
);
assert.equal(
  readinessResult("production", evaluateProductionEnvironment(REQUIRED_GOOGLE_ENV.slice(1))).status,
  "blocked",
);

const ready = {
  tenantStatus: "active",
  connection: {
    exists: true,
    status: "connected",
    accountEmailPresent: true,
    refreshEnvelopeValid: true,
    accessEnvelopeValid: true,
    tokenExpiresAtPresent: true,
    scopes: REQUIRED_GOOGLE_SCOPES,
    driveFolderIds: [],
    driveFoldersValid: true,
  },
  runs: {
    gmail: { status: "success", finishedAt: "2026-08-31T12:00:00.000Z" },
    google_calendar: { status: "success", finishedAt: "2026-08-31T12:00:00.000Z" },
    google_drive: { status: "not_configured", finishedAt: "2026-08-31T12:00:00.000Z" },
  },
};
assert.equal(readinessResult("production", evaluateProductionDatabase(ready)).status, "ready");

for (const unsafe of [
  { tenantStatus: "suspended" },
  { connection: { ...ready.connection, status: "revoked" } },
  { connection: { ...ready.connection, refreshEnvelopeValid: false } },
  { connection: { ...ready.connection, scopes: REQUIRED_GOOGLE_SCOPES.slice(1) } },
  { runs: { ...ready.runs, gmail: { status: "failed", finishedAt: "2026-08-31T12:00:00.000Z" } } },
  {
    runs: {
      ...ready.runs,
      google_calendar: { status: "partial", finishedAt: "2026-08-31T12:00:00.000Z" },
    },
  },
  { connection: { ...ready.connection, driveFolderIds: ["folder-1"] } },
]) {
  assert.equal(
    readinessResult("production", evaluateProductionDatabase({ ...ready, ...unsafe })).status,
    "blocked",
  );
}

const databaseReader = readProductionDatabase.toString();
assert.doesNotMatch(
  databaseReader,
  /\b(?:DELETE|UPDATE|INSERT|TRUNCATE|DROP|ALTER|CREATE)\b/i,
  "Google production readiness must remain read-only",
);
assert.doesNotMatch(
  databaseReader,
  /'encrypted_(?:access|refresh)_token'/,
  "Google readiness must never emit encrypted token values as JSON fields",
);
const callbackSource = readFileSync("src/app/api/admin/google/callback/route.ts", "utf8");
assert.doesNotMatch(
  callbackSource,
  /google_error=.*error\.message/,
  "OAuth callback must not reflect raw exception messages",
);

console.log(
  JSON.stringify({
    result: "passed",
    sourceChecks: evaluateSource(readSourceState()).length,
    productionFailureModes: 7,
    readOnlyProductionProof: true,
  }),
);
