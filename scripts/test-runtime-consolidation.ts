import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MemorySupabase } from "./lib/memory-supabase";
import { AuthorizedMemorySupabase } from "./lib/autonomy-fixture";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import { TENANT_SCOPED_TABLES, REVENUE_SCHEMA_TABLES } from "../src/lib/revenue-os/schema-contract";
import { checkBudgets, budgetPeriodStart } from "../src/lib/revenue-os/budgets";
import { getPoliciesForAction } from "../src/lib/revenue-os/memory";
import { completeWorkItem, failWorkItem, withWorkItem } from "../src/lib/revenue-os/work-items";
import {
  executeClaimableWork,
  registerWorkKindHandler,
  workExecutionJobStatus,
  getWorkKindHandler,
} from "../src/lib/revenue-os/work-executor";
import { approveAndExecuteAction } from "../src/lib/revenue-os/action-executor";
import {
  claimApprovedAction,
  finishAction,
  failAction,
  proposeAction,
} from "../src/lib/revenue-os/actions";

import { checkCapabilitiesBeforeWork } from "../src/lib/revenue-os/capabilities";
import { isAiToolModuleEnabled } from "../src/lib/revenue-os/modules";
import { getRevenueAiTools, executeRegisteredRevenueTool } from "../src/lib/revenue-os/ai-tools";
import { registerCoworker } from "../src/lib/revenue-os/coworkers";
import {
  bootstrapFinanceCoworker,
  registerFinanceWorkHandlers,
} from "../src/lib/revenue-os/finance-coworker";
import {
  bootstrapSalesCoworker,
  registerSalesWorkHandlers,
} from "../src/lib/revenue-os/sales-coworker";
import { gatherBusinessSignals } from "../src/lib/revenue-os/proactive-intel";
import { generateTodayBrief } from "../src/lib/revenue-os/today-brief";
import { loadTodaySnapshot } from "../src/lib/revenue-os/today-snapshot";
import {
  bootstrapOperationsCoworker,
  registerOperationsWorkHandlers,
} from "../src/lib/revenue-os/operations-coworker";
import {
  bootstrapBusinessPulseCoworker,
  registerBusinessPulseWorkHandlers,
} from "../src/lib/revenue-os/business-pulse-coworker";
import {
  bootstrapMeetingIntelCoworker,
  registerMeetingIntelWorkHandlers,
} from "../src/lib/revenue-os/meeting-intel-coworker";

const future = () => new Date(Date.now() + 60_000).toISOString();
function workFixture() {
  const item = {
    id: "work-1",
    tenant_id: "tenant-a",
    kind: "audit-fixture",
    status: "pending",
    objective: "Verify the contract",
    coworker_id: null,
    max_attempts: 3,
    attempt_count: 0,
    lease_owner: null,
    lease_expires_at: null,
  };
  const mem = new AuthorizedMemorySupabase({
    work_items: [item],
    audit_log: [],
    activities: [],
    agent_memory: [],
  });
  mem.rpc("claim_work_item", (args) => {
    const row = mem.rows("work_items")[0]!;
    if (row.status !== "pending") return { claimed: false, work_item_id: row.id };
    Object.assign(row, {
      status: "claimed",
      lease_owner: args.p_lease_owner,
      claimed_at: new Date().toISOString(),
      lease_expires_at: future(),
      attempt_count: Number(row.attempt_count) + 1,
    });
    return {
      claimed: true,
      work_item_id: row.id,
      existing_status: "pending",
      recovered_stale: false,
    };
  });
  return mem;
}
async function main() {
  // Warm registry imports hid schema initialization cycles in Today and booking reads.
  for (const owner of ["today-snapshot", "queue", "debate-bookings", "debate-invitations"]) {
    const result = spawnSync(
      process.execPath,
      [
        "--conditions=react-server",
        "--import",
        "tsx",
        "-e",
        `require('./src/lib/revenue-os/${owner}.ts');
         const tools = require('./src/lib/revenue-os/ai-tools.ts').getRevenueAiTools();
         for (const name of ['propose_debate_milestone', 'propose_debate_invitation']) {
           if (!tools.some(tool => tool.name === name && tool.inputSchema.type === 'object'))
             throw new Error('Booking schema missing: ' + name);
         }`,
      ],
      { encoding: "utf8", timeout: 15_000 },
    );
    assert.equal(result.status, 0, `${owner} cold import failed: ${result.stderr}`);
  }
  registerFinanceWorkHandlers();
  registerOperationsWorkHandlers();
  registerBusinessPulseWorkHandlers();
  registerMeetingIntelWorkHandlers();
  registerSalesWorkHandlers();
  // The permissive row fixture used to hide queries for nonexistent columns.
  // Check report projections and filters against canonical schema fields plus
  // the existing timestamp/title fields verified in the native database.
  const additionalColumns: Record<string, string[]> = {
    contacts: ["created_at", "updated_at"],
    opportunities: ["name", "created_at", "updated_at", "next_action"],
    work_items: ["created_at", "finished_at", "dedupe_key"],
    job_runs: ["claimed_at", "finished_at"],
    source_runs: ["started_at", "finished_at", "error"],
    activities: [
      "metadata",
      "contact_id",
      "title",
      "summary",
      "company_id",
      "created_at",
      "conversation_id",
      "proposal_id",
      "campaign_id",
      "actor_email",
    ],
  };
  function reportDatabase(memory: MemorySupabase): SupabaseClient {
    const client = memory.client as SupabaseClient;
    return bindTenantDatabase(
      {
        ...client,
        from(table: string) {
          const query = client.from(table) as unknown as Record<
            string,
            (...args: unknown[]) => unknown
          >;
          const schema = REVENUE_SCHEMA_TABLES.find((entry) => entry.table === table);
          if (schema && additionalColumns[table]) {
            const columns = new Set([...schema.columns, ...additionalColumns[table]!]);
            for (const method of ["select", "eq", "in", "not", "gte", "lt", "gt", "order", "or"]) {
              const original = query[method]!.bind(query);
              query[method] = (raw, ...args) => {
                const fields = String(raw)
                  .split(",")
                  .map((field) => (method === "or" ? field.split(".")[0]! : field.trim()));
                for (const field of fields)
                  if (field !== "*")
                    assert.ok(columns.has(field), `${table}.${field} must be a canonical field`);
                return original(raw, ...args);
              };
            }
          }
          return query as never;
        },
      } as unknown as SupabaseClient,
      "tenant-a",
      true,
    );
  }
  for (const kind of [
    "weekly_revenue_reconciliation",
    "revenue_stage_audit",
    "detect_overdue_payments",
    "detect_stale_deals",
    "detect_stage_bottleneck",
    "detect_velocity_change",
    "daily_health_check",
    "integration_status_audit",
    "data_quality_scan",
    "pre_call_brief",
    "qualify_lead",
    "gather_lead_context",
    "review_stale_proposal",
    "schedule_followup_check",
    "post_meeting_process",
    "update_crm_from_meeting",
  ]) {
    const memory = new MemorySupabase({
      contacts: [
        {
          id: "contact-fixture",
          tenant_id: "tenant-a",
          full_name: "Evan Cole",
          primary_email: "evan@example.test",
        },
      ],
      opportunities: [
        {
          id: "opportunity-fixture",
          tenant_id: "tenant-a",
          name: "Northline renewal",
          contact_id: "contact-fixture",
          stage: "won",
          probability: 100,
          updated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
      ],
    });
    const handler = getWorkKindHandler(kind)!;
    const outcome = await handler(reportDatabase(memory), {
      id: "work-fixture",
      tenant_id: "tenant-a",
      kind,
      entity_type:
        kind === "pre_call_brief" || kind === "qualify_lead" || kind === "gather_lead_context"
          ? "contact"
          : "opportunity",
      entity_id:
        kind === "pre_call_brief" || kind === "qualify_lead" || kind === "gather_lead_context"
          ? "contact-fixture"
          : "opportunity-fixture",
    } as never);
    if (kind === "post_meeting_process" || kind === "update_crm_from_meeting") {
      assert.equal(
        outcome.status,
        "deferred",
        "missing meeting interpretation cannot claim a CRM update",
      );
      assert.match(outcome.outcome, /No CRM changes were recorded/);
      assert.equal(memory.rows("audit_log").length, 0);
    } else assert.ok(["completed", "skipped"].includes(outcome.status), kind);
  }
  const signals = new MemorySupabase({
    opportunities: [
      {
        id: "opportunity-fixture",
        tenant_id: "tenant-a",
        name: "Northline renewal",
        stage: "proposal",
        probability: 50,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    activities: [
      {
        activity_type: "opportunity_stage_changed",
        tenant_id: "tenant-a",
        opportunity_id: "opportunity-fixture",
        metadata: { to_stage: "won" },
        occurred_at: new Date().toISOString(),
      },
    ],
  });
  const gathered = await gatherBusinessSignals(reportDatabase(signals));
  assert.ok(gathered.some((signal) => signal.summary.includes("Northline renewal")));
  assert.ok(gathered.some((signal) => signal.summary === "1 deal won"));
  assert.ok(gathered.some((signal) => signal.summary === "1 new opportunity entered the pipeline"));
  signals.fail("opportunities", { message: "Signal evidence unavailable" });
  await assert.rejects(
    () => gatherBusinessSignals(signals.client as never),
    /Signal evidence unavailable/,
  );
  const recentActivity = new MemorySupabase({
    tenants: [{ id: "tenant-a", status: "active", config: {} }],
    activities: [
      {
        id: "activity-fixture",
        tenant_id: "tenant-a",
        title: "Saved customer follow-up",
        summary: "Recorded work",
        occurred_at: new Date().toISOString(),
      },
    ],
  });
  const snapshot = await loadTodaySnapshot(
    bindTenantDatabase(recentActivity.client as never, "tenant-a", true),
    { includeBrief: false },
  );
  assert.equal(snapshot.activity.state, "ready");
  assert.equal(
    snapshot.activity.data[0]?.title,
    "Saved customer follow-up",
    "Today uses the bounded workspace activity reader",
  );
  const unavailableBrief = new MemorySupabase({
    tenants: [{ id: "tenant-a", status: "active", config: {} }],
  });
  unavailableBrief.fail("tasks", { message: "Task source unavailable" });
  unavailableBrief.fail("activities", { message: "Activity source unavailable" });
  await assert.rejects(
    () =>
      generateTodayBrief(
        bindTenantDatabase(unavailableBrief.client as never, "tenant-a", true),
        {} as never,
      ),
    /Daily digest evidence could not be refreshed/,
  );
  for (const [kind, table] of [
    ["weekly_revenue_reconciliation", "opportunities"],
    ["revenue_stage_audit", "opportunities"],
    ["detect_overdue_payments", "opportunities"],
    ["detect_stale_deals", "opportunities"],
    ["detect_stage_bottleneck", "opportunities"],
    ["detect_velocity_change", "opportunities"],
    ["daily_health_check", "job_runs"],
    ["integration_status_audit", "source_runs"],
    ["data_quality_scan", "contacts"],
    ["pre_call_brief", "contacts"],
  ]) {
    const memory = new MemorySupabase({ audit_log: [], agent_memory: [] });
    memory.fail(table!, { message: "Business evidence unavailable" });
    const handler = getWorkKindHandler(kind!);
    assert.ok(handler, `${kind} has a registered owner`);
    await assert.rejects(
      () =>
        handler(
          memory.client as never,
          {
            kind,
            entity_id: "contact-fixture",
            entity_type: "contact",
          } as never,
        ),
      /Business evidence unavailable/,
    );
    assert.equal(
      memory.rows("audit_log").length,
      0,
      "failed reads cannot produce successful findings",
    );
    assert.equal(
      memory.rows("agent_memory").length,
      0,
      "failed reads cannot become business memory",
    );
  }
  const savedSettings = {
    description: "Saved description",
    status: "paused",
    model: "saved-model",
    tool_pack: "outreach",
    required_capabilities: ["gmail.read"],
    work_kinds: ["custom-work"],
    autonomy_overrides: { send: "always_ask" },
    config: { schedule: "weekly" },
  };
  const registered = new MemorySupabase({
    coworkers: [{ id: "saved", name: "Saved", role: "Saved", ...savedSettings }],
  });
  const updated = await registerCoworker(registered.client as never, {
    id: "saved",
    name: "Updated",
    role: "Updated role",
  });
  for (const [key, value] of Object.entries(savedSettings))
    assert.deepEqual(updated[key as keyof typeof updated], value, `registration preserves ${key}`);
  await registerCoworker(registered.client as never, {
    id: "saved",
    name: "Updated",
    role: "Updated role",
    model: null,
    config: {},
    requiredCapabilities: [],
  });
  assert.equal(registered.rows("coworkers")[0]?.model, null);
  assert.deepEqual(registered.rows("coworkers")[0]?.config, {});
  assert.deepEqual(registered.rows("coworkers")[0]?.required_capabilities, []);
  registered.fail("coworkers", { message: "Registration read failed" });
  await assert.rejects(
    () =>
      registerCoworker(registered.client as never, {
        id: "new",
        name: "New",
        role: "New role",
      }),
    /Registration read failed/,
  );
  assert.equal(registered.rows("coworkers").length, 1, "failed reads cannot become inserts");

  for (const bootstrap of [
    bootstrapFinanceCoworker,
    bootstrapSalesCoworker,
    bootstrapOperationsCoworker,
    bootstrapBusinessPulseCoworker,
    bootstrapMeetingIntelCoworker,
  ]) {
    const memory = new MemorySupabase({ coworkers: [], audit_log: [], workspace_capabilities: [] });
    memory.rpc("upsert_workspace_capability", () => "capability-id");
    memory.rpc("upsert_autonomy_policy", (args) => {
      assert.ok(
        memory.rows("coworkers").some((row) => row.id === args.p_coworker_id),
        "scoped policies require the coworker identity first",
      );
      return "policy-id";
    });
    await bootstrap(memory.client as never, "founder@example.test");
    assert.ok(memory.rows("audit_log").some((row) => String(row.action).endsWith(".bootstrapped")));
    const worker = memory.rows("coworkers")[0]!;
    Object.assign(worker, savedSettings, { name: "Custom name", role: "Custom role" });
    await bootstrap(memory.client as never, "founder@example.test");
    for (const key of Object.keys(savedSettings))
      assert.deepEqual(worker[key], savedSettings[key as keyof typeof savedSettings]);

    assert.equal(worker.name, "Custom name");
    assert.equal(worker.role, "Custom role");
    const failed = new MemorySupabase({ coworkers: [], audit_log: [] });
    failed.rpc("upsert_workspace_capability", () => "capability-id");
    failed.rpc("upsert_autonomy_policy", () => ({ error: { message: "Policy setup failed" } }));
    await assert.rejects(() => bootstrap(failed.client as never), /Policy setup failed/);
    assert.equal(
      failed.rows("audit_log").some((row) => String(row.action).endsWith(".bootstrapped")),
      false,
      "failed policy setup cannot record successful bootstrap",
    );
  }
  for (const tool of getRevenueAiTools())
    assert.equal(
      Boolean(isAiToolModuleEnabled(tool.name).module),
      true,
      `${tool.name} must have a module owner`,
    );
  const staged = new AuthorizedMemorySupabase({
    action_queue: [],
    agent_memory: [],
    coworkers: [],
  });
  const stagedContext = {
    supabase: staged.client as never,
    actorEmail: "founder@example.test",
    workItemId: "work-fixture",
  };
  const memoryProposal = await executeRegisteredRevenueTool(stagedContext, "store_agent_memory", {
    category: "prior_work",
    subject: "Review",
    body: "A sourced observation",
  });
  assert.ok((memoryProposal.output as { id: string }).id);
  assert.equal(
    staged.rows("agent_memory").length,
    0,
    "model tools must not write memory before approval",
  );
  assert.equal(
    staged.rows("action_queue")[0]?.work_item_id,
    "work-fixture",
    "the work link is part of the original proposal insert",
  );
  await executeRegisteredRevenueTool(stagedContext, "bootstrap_sales_coworker", {});
  assert.equal(
    staged.rows("coworkers").length,
    0,
    "bootstrap must stage rather than mutate configuration",
  );
  assert.equal(budgetPeriodStart("weekly", "2026-09-06"), "2026-08-31");
  assert.equal(budgetPeriodStart("monthly", "2026-09-06"), "2026-09-01");
  const globalBudget = new MemorySupabase({
    budget_limits: [
      { coworker_id: "*", budget_kind: "vendor_api_calls", limit_value: 2, period: "daily" },
      { coworker_id: "sales", budget_kind: "vendor_api_calls", limit_value: 10, period: "daily" },
    ],
    budget_usage: [
      {
        coworker_id: "operations",
        budget_kind: "vendor_api_calls",
        used_value: 2,
        period_key: new Date().toISOString().slice(0, 10),
      },
    ],
  });
  assert.ok(
    (await checkBudgets(globalBudget.client as never, { coworkerId: "sales" })).some(
      (result) => !result.allowed,
    ),
    "another coworker can exhaust the tenant-wide cap",
  );
  let capabilityQueries = 0;
  const caps = new MemorySupabase({
    workspace_capabilities: [
      { capability_key: "crm.read", available: true, policy: "automatic" },
      { capability_key: "email.send", available: true, policy: "prohibited" },
    ],
  });
  const client = caps.client as SupabaseClient;
  const instrumented = {
    ...client,
    from: (table: string) => {
      capabilityQueries++;
      return client.from(table);
    },
  };
  const availability = await checkCapabilitiesBeforeWork(instrumented as never, [
    "crm.read",
    "email.send",
    "drive.read",
  ]);
  assert.deepEqual(availability, {
    missing: ["drive.read"],
    unavailable: [],
    policyBlocked: ["email.send"],
  });
  assert.equal(
    capabilityQueries,
    1,
    "capability preflight uses one bounded query, not one per key",
  );
  const failingBudget = new MemorySupabase();
  failingBudget.fail("budget_limits", { message: "database offline" });
  await assert.rejects(
    () => checkBudgets(failingBudget.client as never, { coworkerId: "sales" }),
    /unavailable/,
  );
  const failingUsage = new MemorySupabase({
    budget_limits: [
      { coworker_id: "sales", budget_kind: "model_spend", limit_value: 10, period: "daily" },
    ],
  });
  failingUsage.fail("budget_usage", { message: "database offline" });
  await assert.rejects(
    () => checkBudgets(failingUsage.client as never, { coworkerId: "sales" }),
    /unavailable/,
  );
  const failingPolicy = new MemorySupabase();
  failingPolicy.fail("learned_policies", { message: "database offline" });
  await assert.rejects(
    () => getPoliciesForAction(failingPolicy.client as never, { actionKey: "work:test" }),
    /Policy lookup failed/,
  );

  for (const table of [
    "work_items",
    "agent_memory",
    "learned_policies",
    "budget_limits",
    "budget_usage",
    "autonomy_policies",
    "workspace_capabilities",
    "coworkers",
    "plugins",
    "claims",
    "evidence",
    "kanban_columns",
  ]) {
    assert.ok((TENANT_SCOPED_TABLES as readonly string[]).includes(table));
    const mem = new MemorySupabase({
      [table]: [
        { id: "a", tenant_id: "a" },
        { id: "b", tenant_id: "b" },
      ],
    });
    const db = bindTenantDatabase(mem.client as never, "a", true);
    const { data } = await db.from(table).select("*");
    assert.deepEqual(
      data?.map((r) => r.id),
      ["a"],
      `${table}: reads stay in the tenant`,
    );
    await db.from(table).update({ touched: true });
    assert.equal(mem.rows(table)[1]?.touched, undefined, `${table}: writes stay in the tenant`);
    await db.from(table).insert({ id: "c", tenant_id: "b" });
    assert.equal(
      mem.rows(table)[2]?.tenant_id,
      "a",
      `${table}: inserts cannot choose another tenant`,
    );
  }

  const ok = workFixture();
  const result = await withWorkItem(ok.client as never, "audit-fixture", async () => ({
    status: "completed",
    value: 42,
    outcome: "Verified",
  }));
  assert.equal(result.status, "completed");
  assert.equal(ok.rows("work_items")[0]?.status, "completed");
  assert.equal(ok.rows("work_items")[0]?.lease_owner, null);
  const deferred = workFixture();
  await withWorkItem(deferred.client as never, "audit-fixture", async () => ({
    status: "deferred",
    value: null,
    outcome: "Budget exhausted",
    nextCheckAt: future(),
  }));
  assert.equal(deferred.rows("work_items")[0]?.status, "waiting");
  assert.equal(deferred.rows("work_items")[0]?.attempt_count, 0);
  assert.ok(!deferred.rows("audit_log").some((r) => r.action === "work_item.completed"));
  const failed = workFixture();
  await withWorkItem(failed.client as never, "audit-fixture", async () => {
    throw new Error("Provider unavailable");
  });
  assert.equal(failed.rows("work_items")[0]?.status, "pending");
  assert.match(String(failed.rows("work_items")[0]?.next_check_reason), /Provider unavailable/);
  const partial = workFixture();
  await withWorkItem(partial.client as never, "audit-fixture", async () => ({
    status: "partial",
    value: null,
    outcome: "Turn budget exhausted",
  }));
  assert.equal(partial.rows("work_items")[0]?.status, "pending");

  const stale = workFixture();
  const lease = { lease_owner: "old", lease_expires_at: future(), attempt_count: 1 };
  Object.assign(stale.rows("work_items")[0]!, {
    ...lease,
    status: "in_progress",
    lease_owner: "new",
    attempt_count: 2,
  });
  await assert.rejects(
    () => completeWorkItem(stale.client as never, "work-1", "Wrong worker", lease),
    /superseded/,
  );
  await assert.rejects(
    () => failWorkItem(stale.client as never, "work-1", "Wrong worker", lease),
    /superseded/,
  );
  assert.equal(stale.rows("work_items")[0]?.lease_owner, "new");
  assert.equal(stale.rows("audit_log").length, 0);

  const cycle = workFixture();
  let called = false;
  cycle.fail("budget_limits", { message: "offline" });
  registerWorkKindHandler("audit-fixture", async () => {
    called = true;
    return { status: "completed", outcome: "must not run" };
  });
  const summary = await executeClaimableWork(cycle.client as never, { kinds: ["audit-fixture"] });
  assert.equal(called, false);
  assert.equal(summary.failed, 1);
  assert.equal(summary.completed, 0);
  assert.equal(summary.executed, 0);
  assert.equal(workExecutionJobStatus(summary), "failed");

  const awaiting = workFixture();
  awaiting.tables.action_queue = [{ id: "a-linked", work_item_id: "work-1", status: "pending" }];
  let approvalReran = false;
  registerWorkKindHandler("audit-fixture", async () => {
    approvalReran = true;
    return { status: "completed", outcome: "Wrong retry" };
  });
  const waitingSummary = await executeClaimableWork(awaiting.client as never, {
    kinds: ["audit-fixture"],
  });
  assert.equal(waitingSummary.awaitingApproval, 1);
  assert.equal(approvalReran, false);
  assert.equal(awaiting.rows("work_items")[0]?.status, "waiting");
  assert.equal(workExecutionJobStatus(waitingSummary), "partial");
  assert.equal(
    workExecutionJobStatus({ ...waitingSummary, failed: 1, errors: ["another work item failed"] }),
    "partial",
    "pending approvals remain visible in mixed failed cycles",
  );
  const resumed = workFixture();
  resumed.tables.action_queue = [{ id: "a-linked", work_item_id: "work-1", status: "executed" }];
  const resumedSummary = await executeClaimableWork(resumed.client as never, {
    kinds: ["audit-fixture"],
  });
  assert.equal(resumedSummary.completed, 1);
  assert.equal(approvalReran, false);
  assert.equal(
    workExecutionJobStatus(resumedSummary),
    "success",
    "approval recovery completed work without rerunning the model",
  );
  const denied = new AuthorizedMemorySupabase({
    action_queue: [
      {
        id: "a1",
        status: "pending",
        action_type: "update_next_action",
        payload: { opportunityId: "o1", nextAction: "Must not happen" },
      },
    ],
    opportunities: [{ id: "o1" }],
  });
  denied.rpc("check_autonomy", ({ p_action_key }) => ({
    action_key: p_action_key,
    allowed: false,
    level: "prohibited",
    requires_approval: true,
    policy_id: "p1",
    hard_floor: false,
    reason: "Revoked",
  }));
  await assert.rejects(
    () => approveAndExecuteAction(denied.client as never, "a1", "founder@example.test"),
    /Revoked/,
  );
  assert.equal(denied.rows("opportunities")[0]?.next_action, undefined);
  // Authority revoked after approval now writes a truthful `denied` terminal
  // receipt (denyAction), not a generic `failed` that looks like an outage.
  assert.equal(denied.rows("action_queue")[0]?.status, "denied");
  assert.deepEqual((denied.rows("action_queue")[0]?.result as Record<string, unknown>)?.policy, {
    policy_id: "p1",
    action_key: "update_next_action",
    level: "prohibited",
    mode: "approved",
  });
  assert.ok(
    denied
      .rows("audit_log")
      .some((row) => row.action === "action.denied" && row.entity_id === "a1"),
    "a revocation after approval must leave an action.denied audit entry",
  );
  const automatic = new AuthorizedMemorySupabase({
    action_queue: [{ id: "auto", status: "pending", action_type: "create_task" }],
    agent_memory: [],
  });
  await claimApprovedAction(automatic.client as never, "auto", "system", "autonomous");
  assert.equal(
    automatic.rows("action_queue")[0]?.approved_by,
    undefined,
    "autonomous execution must never fabricate human approval",
  );
  assert.equal(
    automatic.rows("agent_memory").length,
    0,
    "autonomous claims must not generate human trust signals",
  );
  await finishAction(automatic.client as never, "auto", { id: "task" });
  await assert.rejects(() => finishAction(automatic.client as never, "auto", {}), /superseded/);
  await assert.rejects(() => failAction(automatic.client as never, "auto", "late"), /superseded/);
  const prose = new MemorySupabase({
    learned_policies: [{ action_key: "create_task", rule: "Always ask how the customer is doing" }],
    action_queue: [],
  });
  const proposed = await proposeAction(prose.client as never, {
    actionType: "create_task",
    title: "Follow up",
    payload: { title: "Follow up" },
    sourceContext: "audit",
  });
  assert.ok(proposed.id, "prose mentioning always ask is not an executable denial");
  console.log(
    JSON.stringify({
      result: "passed",
      checks: [
        "cold-today-and-booking-imports",
        "database-error-gates",
        "coworker-setup-preserves-settings-and-failures",
        "coworker-evidence-read-failures",
        "canonical-worker-fields-and-stage-events",
        "truthful-meeting-deferral-and-today-activity",
        "runtime-table-tenant-boundary",
        "typed-outcomes",
        "bounded-retry",
        "lease-fencing",
        "truthful-cycle-summary",
        "policy-revocation",
        "observations-not-authority",
      ],
    }),
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
