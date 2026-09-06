import assert from "node:assert/strict";
import { updateModuleConfiguration } from "../src/lib/revenue-os/module-configuration";
import { MemorySupabase } from "./lib/memory-supabase";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import { runReportPlugin } from "../src/lib/revenue-os/report-plugins";
import { evaluateInIsolate } from "../src/lib/revenue-os/plugin-isolate";
import { EXTENSION_REPORTS } from "../src/lib/revenue-os/extension-reports.generated";
import { executeRegisteredRevenueTool } from "../src/lib/revenue-os/ai-tools";
async function main() {
  const tenantId = "report-tenant";
  const ids = ["pipeline-watch", "commitment-watch", "meeting-prep", "business-pulse"];
  const config = { modules: Object.fromEntries(ids.map((id) => [id, true])) };
  const now = Date.now();
  const past = new Date(now - 10 * 86400000).toISOString();
  const future = new Date(now + 3600000).toISOString();
  const mem = new MemorySupabase({
    tenants: [{ id: tenantId, status: "active", config }],
    entity_types: [
      {
        type_key: "report_opportunities",
        backing_table: "opportunities",
        metadata: { readable_columns: ["name", "stage", "updated_at", "next_action_at"] },
      },
      {
        type_key: "report_tasks",
        backing_table: "tasks",
        metadata: { readable_columns: ["title", "status", "due_date"] },
      },
      {
        type_key: "report_calendar_events",
        backing_table: "calendar_events",
        metadata: { readable_columns: ["title", "status", "start_at", "end_at"] },
      },
    ].map((row) => ({
      ...row,
      id: row.type_key,
      tenant_id: tenantId,
      id_column: "id",
      is_disabled: false,
    })),
    opportunities: [
      {
        id: "deal-1",
        name: "Example deal",
        stage: "new",
        updated_at: past,
        next_action_at: null,
        tenant_id: tenantId,
      },
      { id: "deal-closed", stage: "won", updated_at: past, tenant_id: tenantId },
      {
        id: "foreign",
        name: "Private foreign deal",
        stage: "new",
        updated_at: past,
        tenant_id: "other",
      },
    ],
    tasks: [
      {
        id: "task-1",
        title: "Return quote",
        status: "pending",
        due_date: past.slice(0, 10),
        tenant_id: tenantId,
      },
      { id: "task-done", status: "completed", due_date: past.slice(0, 10), tenant_id: tenantId },
    ],
    calendar_events: [
      {
        id: "meeting-1",
        title: "Example discovery",
        status: "confirmed",
        start_at: future,
        end_at: null,
        tenant_id: tenantId,
      },
      { id: "cancelled", status: "cancelled", start_at: future, tenant_id: tenantId },
    ],
  });
  const db = bindTenantDatabase(mem.client, tenantId, true);
  for (const id of ids) {
    const report = await runReportPlugin(db, id, "qa@example.example");
    assert.equal(report.items.length, id === "business-pulse" ? 3 : 1, id);
    assert.equal(report.totalFindings, id === "business-pulse" ? 3 : 1);
    assert.equal(report.receipt.truncated, false);
    assert.ok(!JSON.stringify(report).includes("Private foreign"));
    assert.equal(
      mem.rows("agent_runs").find((row) => row.id === report.receipt.runId)?.status,
      "completed",
    );
    (mem.rows("tenants")[0]!.config as typeof config).modules[id] = false;
    await assert.rejects(() => runReportPlugin(db, id, "qa"), /disabled/);
    // A stale AI context must not override current tenant enablement.
    await assert.rejects(
      () =>
        executeRegisteredRevenueTool(
          { supabase: db, actorEmail: "qa", tenantConfig: config },
          "run_" + id.replaceAll("-", "_"),
          {},
        ),
      /disabled|unavailable/,
    );
    (mem.rows("tenants")[0]!.config as typeof config).modules[id] = true;
  }
  await assert.rejects(() => runReportPlugin(mem.client, ids[0]!, "qa"), /tenant-bound/);
  await assert.rejects(() => runReportPlugin(db, "__proto__", "qa"), /Unknown/);
  const taskType = mem.rows("entity_types")[1]!;
  taskType.is_disabled = true;
  await assert.rejects(() => runReportPlugin(db, "commitment-watch", "qa"), /Missing readable/);
  taskType.is_disabled = false;
  mem.tables.tasks = [];
  assert.equal((await runReportPlugin(db, "commitment-watch", "qa")).items.length, 0);
  mem.tables.tasks = Array.from({ length: 105 }, (_, i) => ({
    id: `task-${i}`,
    tenant_id: tenantId,
    title: "Bounded",
    status: "pending",
    due_date: past,
  }));
  const capped = await runReportPlugin(db, "commitment-watch", "qa");
  assert.equal(capped.items.length, 20);
  assert.equal(capped.receipt.inspectedRows, 100);
  assert.equal(capped.receipt.truncated, true);
  const original = EXTENSION_REPORTS["meeting-prep"]!.code;
  try {
    for (const code of [
      'fetch("https://example.example")',
      'readSource("secrets")',
      '({summary:"Forged",items:[{source:"records",id:"foreign",title:"x",detail:"x",severity:"info"}],totalFindings:1})',
      "while(true) {}",
    ]) {
      EXTENSION_REPORTS["meeting-prep"]!.code = code;
      await assert.rejects(() => runReportPlugin(db, "meeting-prep", "qa"));
      assert.equal(mem.rows("agent_runs").at(-1)?.status, "failed");
    }
  } finally {
    EXTENSION_REPORTS["meeting-prep"]!.code = original;
  }
  assert.deepEqual(
    (await evaluateInIsolate("read()", { bindings: { read: () => ({ a: null, b: [null] }) } }))
      .value,
    { a: null, b: [null] },
  );
  assert.equal(
    (await evaluateInIsolate("read() === null", { bindings: { read: () => null } })).value,
    true,
  );
  // Both calls read the initial snapshot before either write completes. The
  // second must retry against the updated JSON config instead of losing it.
  await Promise.all([
    updateModuleConfiguration(db, { moduleId: "pipeline-watch", enabled: false }, "qa"),
    updateModuleConfiguration(db, { moduleId: "meeting-prep", enabled: false }, "qa"),
  ]);
  const saved = mem.rows("tenants")[0]!.config as typeof config;
  assert.equal(saved.modules["pipeline-watch"], false);
  assert.equal(saved.modules["meeting-prep"], false);
  await updateModuleConfiguration(db, { moduleId: "meeting-prep", enabled: true }, "qa");
  await assert.rejects(
    () => updateModuleConfiguration(db, { moduleId: "core-command", enabled: false }, "qa"),
    /optional/,
  );
  mem.fail("agent_runs", { message: "unavailable" });
  await assert.rejects(() => runReportPlugin(db, "meeting-prep", "qa"), /receipt/);
  console.log(
    "Report plugins: real isolate execution, source references, empty/bounded output, tenant isolation, stale AI enablement, missing capabilities, malicious code and failed receipts passed.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
