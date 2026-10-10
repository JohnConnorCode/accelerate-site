import assert from "node:assert/strict";
import { describeSourceOutput, loadOperationalHealth } from "../src/lib/revenue-os/health";
import { MemorySupabase } from "./lib/memory-supabase";
async function main() {
  assert.equal(
    describeSourceOutput("gmail", "success", {
      mode: "incremental",
      listed: 0,
      stored: 0,
      deferred: 0,
    }).state,
    "quiet",
  );
  assert.equal(describeSourceOutput("google_drive", "success", { stored: 0 }).state, "complete");
  assert.equal(describeSourceOutput("google_drive", "not_configured", {}).state, "not_configured");
  assert.equal(
    describeSourceOutput("gmail", "success", { listed: 10, stored: 3, deferred: 7 }).state,
    "incomplete",
  );
  assert.equal(describeSourceOutput("gmail", "success", {}).state, "unknown");
  const mem = new MemorySupabase({
    integration_connections: [
      {
        provider: "google",
        status: "connected",
        last_success_at: new Date().toISOString(),
        settings: {},
      },
    ],
    source_runs: [],
    job_runs: [],
    work_items: [
      { status: "failed" },
      { status: "pending" },
      { status: "waiting" },
      { status: "claimed" },
      { status: "in_progress" },
      { status: "completed" },
      { status: "cancelled" },
    ],
    messages: [
      { direction: "outbound", status: "processing" },
      { direction: "outbound", status: "failed" },
      { direction: "outbound", status: "uncertain" },
      { direction: "outbound", status: "sent" },
      { direction: "inbound", status: "uncertain" },
    ],
  });
  const health = await loadOperationalHealth(mem.client);
  assert.equal(health.status, "attention");
  assert.equal(health.sourceRuns.find((r) => r.key === "gmail")?.output?.state, "never_run");
  assert.equal(
    health.sourceRuns.find((r) => r.key === "google_drive")?.output?.state,
    "not_configured",
  );
  assert.deepEqual(health.processingBacklog, {
    pendingWork: 4,
    failedWork: 1,
    unresolvedMessages: 3,
  });
  assert.ok(health.concerns.some((c) => c.key === "unreconciled-work"));
  const uncertainOnly = new MemorySupabase({
    job_runs: [
      {
        job_key: "system-health-snapshot",
        status: "success",
        claimed_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
      },
    ],
    messages: [{ direction: "outbound", status: "uncertain" }],
  });
  const uncertainHealth = await loadOperationalHealth(uncertainOnly.client);
  assert.equal(uncertainHealth.status, "attention", "an uncertain outcome must never appear ready");
  assert.equal(uncertainHealth.processingBacklog?.unresolvedMessages, 1);
  assert.match(
    uncertainHealth.concerns.find((c) => c.key === "unreconciled-work")?.detail ?? "",
    /uncertain.*receipt review/,
  );
  const successfulAt = new Date(Date.now() - 120000).toISOString();
  mem.tables.source_runs = [
    {
      source_key: "gmail",
      status: "failed",
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
    },
    {
      source_key: "gmail",
      status: "success",
      started_at: successfulAt,
      finished_at: successfulAt,
      summary: { stored: 2 },
    },
  ];
  const failedHealth = await loadOperationalHealth(mem.client);
  assert.equal(
    failedHealth.sourceRuns.find((r) => r.key === "gmail")?.lastSuccessAt,
    Date.parse(successfulAt),
  );
  assert.equal(failedHealth.sourceRuns.find((r) => r.key === "gmail")?.status, "failed");
  console.log(
    "PASS: source-specific quiet/empty/unconfigured/never-run/incomplete output and live unreconciled-work overlay.",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
