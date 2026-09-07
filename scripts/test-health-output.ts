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
    work_items: [{ status: "failed" }, { status: "pending" }],
    messages: [{ direction: "outbound", status: "processing" }],
  });
  const health = await loadOperationalHealth(mem.client);
  assert.equal(health.status, "attention");
  assert.equal(health.sourceRuns.find((r) => r.key === "gmail")?.output?.state, "never_run");
  assert.equal(
    health.sourceRuns.find((r) => r.key === "google_drive")?.output?.state,
    "not_configured",
  );
  assert.deepEqual(health.processingBacklog, {
    pendingWork: 1,
    failedWork: 1,
    unresolvedMessages: 1,
  });
  assert.ok(health.concerns.some((c) => c.key === "unreconciled-work"));
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
