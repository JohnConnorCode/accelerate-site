import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MemorySupabase } from "./lib/memory-supabase";
import { AuthorizedMemorySupabase } from "./lib/autonomy-fixture";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import { TENANT_SCOPED_TABLES } from "../src/lib/revenue-os/schema-contract";
import { checkBudgets, budgetPeriodStart } from "../src/lib/revenue-os/budgets";
import { getPoliciesForAction } from "../src/lib/revenue-os/memory";
import { completeWorkItem, failWorkItem, withWorkItem } from "../src/lib/revenue-os/work-items";
import {
  executeClaimableWork,
  registerWorkKindHandler,
  workExecutionJobStatus,
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
  assert.equal(denied.rows("action_queue")[0]?.status, "failed");
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
        "database-error-gates",
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
