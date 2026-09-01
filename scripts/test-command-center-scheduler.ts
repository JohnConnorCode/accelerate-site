#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  HEALTH_SNAPSHOT_CADENCE_MINUTES,
  healthSnapshotClaimKey,
  summarizeOperationalHealth,
} from "../src/lib/revenue-os/scheduler";

assert.equal(HEALTH_SNAPSHOT_CADENCE_MINUTES, 15);
assert.equal(
  healthSnapshotClaimKey(Date.parse("2026-08-23T12:00:01Z")),
  healthSnapshotClaimKey(Date.parse("2026-08-23T12:14:59Z")),
  "replays inside one window must share a claim key",
);
assert.notEqual(
  healthSnapshotClaimKey(Date.parse("2026-08-23T12:14:59Z")),
  healthSnapshotClaimKey(Date.parse("2026-08-23T12:15:00Z")),
  "the next cadence window must be independently claimable",
);

const summary = summarizeOperationalHealth({
  status: "attention",
  attentionCount: 2,
  integrations: [
    {
      provider: "google",
      status: "degraded",
      lastSuccessAt: null,
      lastError: "secret-bearing detail",
    },
  ],
  sourceRuns: [],
  jobRuns: [],
  webhookFailures: [
    {
      id: "receipt-1",
      provider: "resend",
      eventType: "email.failed",
      error: "customer content",
      receivedAt: null,
    },
  ],
  concerns: [
    {
      kind: "integration",
      key: "google",
      detail: "secret-bearing detail",
      observedAt: "2026-08-23T12:00:00Z",
    },
  ],
});
assert.deepEqual(summary, {
  status: "attention",
  attentionCount: 2,
  integrationCount: 1,
  sourceCount: 0,
  jobCount: 0,
  webhookFailureCount: 1,
});
assert.ok(
  !JSON.stringify(summary).includes("secret-bearing detail"),
  "scheduled receipts must contain counts and status, not provider diagnostics or customer content",
);

const migration = readFileSync("migrations/20260823-command-center-scheduler.sql", "utf8");
assert.match(migration, /CREATE EXTENSION IF NOT EXISTS pg_cron/i);
assert.match(migration, /CREATE EXTENSION IF NOT EXISTS pg_net/i);
assert.match(
  migration,
  /vault\.create_secret|vault\.update_secret/i,
  "scheduler credentials must be encrypted at rest",
);
assert.match(
  migration,
  /'\*\/15 \* \* \* \*'/,
  "the proof workload must run more frequently than daily",
);
assert.match(
  migration,
  /Authorization[^\n]+Bearer/i,
  "the wake-up call must authenticate to the application adapter",
);
assert.match(
  migration,
  /REVOKE ALL ON FUNCTION public\.configure_command_center_scheduler/i,
  "secret configuration must not be exposed through the Data API",
);
assert.ok(
  !migration.includes("acceleratewith.us"),
  "the migration must not hardcode a deployment URL",
);
assert.ok(
  !/Bearer\s+[A-Za-z0-9_-]{16}/.test(migration),
  "the migration must not contain a credential",
);

const route = readFileSync("src/app/api/cron/system-health-snapshot/route.ts", "utf8");
assert.match(route, /authorization/);
assert.match(route, /withJobRun\(\s*supabase,\s*"system-health-snapshot"/);
assert.match(route, /loadOperationalHealth\(supabase\)/);
assert.doesNotMatch(
  route,
  /sendRecordedEmail|executeDueCampaignMembers|syncGmail|syncCalendar|syncDrive/,
  "the proof job is read-only and cannot widen an automation envelope",
);

const configureScript = readFileSync("scripts/configure-command-center-scheduler.mjs", "utf8");
assert.match(configureScript, /CRON_SECRET/);
assert.match(
  configureScript,
  /redirect:\s*"manual"/,
  "configuration must resolve the canonical host before storing a bearer-authenticated endpoint",
);
assert.doesNotMatch(
  configureScript,
  /console\.log\([^\n]*cronSecret/i,
  "the deployment helper must not print the cron credential",
);

console.log(
  JSON.stringify(
    {
      result: "passed",
      cadenceMinutes: HEALTH_SNAPSHOT_CADENCE_MINUTES,
      checks: [
        "deterministic replay key",
        "redacted receipt",
        "free-first extensions",
        "encrypted Vault",
        "sub-daily cadence",
        "authenticated wake",
        "revoked configuration function",
        "read-only workload",
      ],
    },
    null,
    2,
  ),
);
