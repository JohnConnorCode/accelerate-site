#!/usr/bin/env tsx
/**
 * Northstar Phase B proof, gate composition (AC2): the shared execution
 * path denies unsafe work before any side effect, whichever surface queued
 * it.
 *
 * Drives the real executeClaimableWork loop against MemorySupabase with a
 * stubbed claim RPC and a counting handler, proving:
 *   1. a prohibited autonomy policy blocks execution (handler never runs)
 *      and the deferred denial is receipted, not silent;
 *   2. an exhausted budget blocks execution the same way;
 *   3. the happy path runs the handler exactly once and records completion,
 *      activity and agent memory receipts;
 *   4. checkBudgets reports exhausted vs healthy vs unlimited correctly;
 *   5. checkCapabilitiesBeforeWork separates missing, unavailable, and
 *      policy-blocked capabilities so callers fail safely, not blindly.
 *
 * Database-atomic primitives (claim RPC, autonomy ladder, capability
 * resolution, evidence hierarchy) are proven against real Postgres in
 * scripts/test-phase-b-proof-postgres.mjs; this file proves the TypeScript
 * composition that sits on top of them.
 */
import assert from "node:assert/strict";
import { MemorySupabase } from "./lib/memory-supabase.js";
import { executeClaimableWork, registerWorkKindHandler } from "../src/lib/revenue-os/work-executor";
import { checkBudgets } from "../src/lib/revenue-os/budgets";
import { checkCapabilitiesBeforeWork } from "../src/lib/revenue-os/capabilities";

const KIND = "phase_b_probe";
const ITEM_ID = "11111111-1111-4111-8111-111111111111";

/** Autonomy result returned by the stubbed check_autonomy RPC when work is allowed. */
const ALLOWED_AUTONOMY = {
  action_key: `work:${KIND}`,
  allowed: true,
  level: "autonomous",
  requires_approval: false,
  policy_id: "policy-allow",
  hard_floor: false,
  reason: "Action is freely executable (low-risk)",
} as const;

/** Autonomy result returned when policy prohibits the action outright. */
const PROHIBITED_AUTONOMY = {
  action_key: `work:${KIND}`,
  allowed: false,
  level: "prohibited",
  requires_approval: true,
  policy_id: "policy-prohibited",
  hard_floor: false,
  reason: "Action is prohibited by policy",
} as const;

function itemRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ITEM_ID,
    tenant_id: "tenant-a",
    coworker_id: null,
    kind: KIND,
    objective: "Probe durable execution",
    reason: "Phase B proof needs a durable item",
    source: "phase-b-proof",
    status: "claimed",
    priority: "high",
    dedupe_key: null,
    due_at: null,
    next_check_at: null,
    next_check_reason: null,
    lease_owner: "worker-a",
    lease_expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
    attempt_count: 1,
    max_attempts: 3,
    outcome: null,
    error: null,
    agent_run_id: null,
    entity_type: null,
    entity_id: null,
    created_at: new Date().toISOString(),
    claimed_at: new Date().toISOString(),
    started_at: null,
    finished_at: null,
    ...overrides,
  };
}

function harness(
  seed: Record<string, Record<string, unknown>[]>,
  autonomy: Record<string, unknown> = ALLOWED_AUTONOMY,
) {
  const mem = new MemorySupabase(seed);
  mem.rpc("claim_work_item", (args) => {
    // The real RPC mutates the row; the executor re-reads it and fences on the
    // exact lease, so the stub must hand the row a live lease for the caller.
    const row = mem.rows("work_items").find((candidate) => candidate.id === ITEM_ID);
    if (row) {
      row.status = "claimed";
      row.lease_owner = args.p_lease_owner ?? row.lease_owner;
      row.claimed_at = new Date().toISOString();
      row.lease_expires_at = new Date(Date.now() + 30 * 60_000).toISOString();
      row.attempt_count = Number(row.attempt_count ?? 0) + 1;
    }
    return {
      work_item_id: ITEM_ID,
      claimed: true,
      existing_status: "claimed",
      recovered_stale: false,
    };
  });
  mem.rpc("increment_budget_usage", () => null);
  mem.rpc("check_autonomy", () => autonomy);
  return mem;
}

async function main() {
  let handlerCalls = 0;
  registerWorkKindHandler(KIND, async () => {
    handlerCalls++;
    return { status: "completed" as const, outcome: "probe handler executed" };
  });

  // ---- 1. Prohibited autonomy policy blocks before any side effect --------
  {
    const mem = harness(
      {
        work_items: [itemRow()],
        audit_log: [],
        activities: [],
      },
      PROHIBITED_AUTONOMY,
    );
    handlerCalls = 0;
    const summary = await executeClaimableWork(mem.client as never, { kinds: [KIND] });
    assert.equal(handlerCalls, 0, "a blocked item must never reach its handler");
    assert.ok(summary.deferred >= 1, "the block must count as a deferred denial, not vanish");
    const deferred = mem.rows("audit_log").find((row) => row.action === "work_item.deferred");
    assert.ok(deferred, "the block must leave an inspectable receipt");
    assert.match(
      String((deferred.after_state as Record<string, unknown> | null)?.outcome ?? ""),
      /prohibited by policy/i,
      "the receipt must name the policy that blocked execution",
    );
  }

  // ---- 2. Exhausted budget blocks before any side effect ------------------
  {
    const today = new Date().toISOString().slice(0, 10);
    const mem = harness({
      work_items: [itemRow({ coworker_id: "cw-1" })],
      coworkers: [{ id: "cw-1", required_capabilities: [], status: "active" }],
      budget_limits: [
        {
          id: "limit-1",
          tenant_id: "tenant-a",
          coworker_id: "cw-1",
          budget_kind: "emails_sent",
          limit_value: 3,
          period: "daily",
          created_at: new Date().toISOString(),
        },
      ],
      budget_usage: [
        {
          id: "usage-1",
          coworker_id: "cw-1",
          period_key: today,
          budget_kind: "emails_sent",
          used_value: 3,
        },
      ],
      audit_log: [],
      activities: [],
    }, ALLOWED_AUTONOMY);
    handlerCalls = 0;
    const summary = await executeClaimableWork(mem.client as never, { kinds: [KIND] });
    assert.equal(handlerCalls, 0, "an over-budget item must never reach its handler");
    assert.ok(summary.deferred >= 1, "exhaustion must count as a deferred denial");
    const deferred = mem.rows("audit_log").find((row) => row.action === "work_item.deferred");
    assert.match(
      String((deferred?.after_state as Record<string, unknown> | null)?.outcome ?? ""),
      /Budget exhausted: emails_sent \(3\/3\)/,
      "the receipt must carry the exact exhausted budget and counts",
    );
  }

  // ---- 3. Happy path: exactly one effect with full receipts ---------------
  {
    const mem = harness({
      work_items: [itemRow({ coworker_id: null })],
      learned_policies: [],
      budget_limits: [],
      budget_usage: [],
      audit_log: [],
      activities: [],
      agent_memory: [],
    });
    handlerCalls = 0;
    const summary = await executeClaimableWork(mem.client as never, { kinds: [KIND] });
    assert.equal(handlerCalls, 1, "the happy path must execute the handler exactly once");
    assert.equal(summary.completed, 1);
    const completed = mem.rows("audit_log").find((row) => row.action === "work_item.completed");
    assert.equal(
      (completed?.after_state as Record<string, unknown> | null)?.outcome,
      "probe handler executed",
    );
    assert.ok(
      mem.rows("activities").some((row) => row.activity_type === "work_item_completed"),
      "completion must append to the activity timeline",
    );
    assert.equal(mem.rows("agent_memory").length, 1, "prior-work memory must be stored");
    // Budget consumption is written on the coworker-agent path
    // (claimResourceBudget -> increment_budget_usage); the generic work
    // executor only gates. Atomic accumulation itself is proven against real
    // Postgres in scripts/test-phase-b-proof-postgres.mjs.
  }

  // ---- 4. checkBudgets truth table ----------------------------------------
  {
    const today = new Date().toISOString().slice(0, 10);
    const mem = new MemorySupabase({
      budget_limits: [
        { coworker_id: "*", budget_kind: "emails_sent", limit_value: 5, period: "daily" },
        { coworker_id: "cw-9", budget_kind: "emails_sent", limit_value: 2, period: "daily" },
      ],
      budget_usage: [
        { coworker_id: "cw-9", period_key: today, budget_kind: "emails_sent", used_value: 2 },
      ],
    });
    const budgets = await checkBudgets(mem.client as never, {
      coworkerId: "cw-9",
      budgetKinds: ["emails_sent"],
    });
    // One result per applicable limit: the tenant-wide cap (5) and the
    // coworker cap (2). Usage at the coworker cap must deny.
    assert.equal(budgets.length, 2, "each applicable limit must be reported");
    const denied = budgets.find((result) => !result.allowed);
    assert.ok(denied, "usage at the coworker limit must deny");
    assert.match(denied.reason ?? "", /Budget exhausted: emails_sent \(2\/2\)/);
    assert.ok(
      budgets.some((result) => result.allowed),
      "the tenant cap still has headroom and must allow",
    );

    const globalOnly = await checkBudgets(mem.client as never, {
      coworkerId: "cw-other",
      budgetKinds: ["emails_sent"],
    });
    // A tenant-wide limit counts every coworker's usage, so cw-9's 2 of 5 is
    // already spent against the shared cap.
    assert.equal(globalOnly[0]?.allowed, true, "usage below the global limit must allow");
    assert.equal(globalOnly[0]?.remaining, 3);

    const unlimited = await checkBudgets(new MemorySupabase().client as never, {
      coworkerId: "cw-9",
      budgetKinds: ["emails_sent"],
    });
    assert.equal(unlimited[0]?.allowed, true, "no configured limit must allow");
    assert.equal(unlimited[0]?.limit, Infinity);
  }

  // ---- 5. Capability pre-check separates the three failure shapes ---------
  {
    const mem = new MemorySupabase({
      // "gone" is deliberately absent: an unregistered capability is missing,
      // not merely unavailable or policy-blocked.
      workspace_capabilities: [
        {
          capability_key: "down",
          available: false,
          policy: null,
          status_reason: "Provider disconnected",
          verified_at: null,
        },
        {
          capability_key: "forbidden",
          available: true,
          policy: "prohibited",
          status_reason: "Policy forbids autonomous use",
          verified_at: new Date().toISOString(),
        },
        {
          capability_key: "ok-missing-stub",
          available: false,
          policy: null,
          status_reason: "Provider disconnected",
          verified_at: null,
        },
      ],
    });
    const result = await checkCapabilitiesBeforeWork(mem.client as never, [
      "gone",
      "down",
      "forbidden",
      "ok-missing-stub",
    ]);
    assert.deepEqual(result.missing, ["gone"]);
    assert.deepEqual(result.unavailable.sort(), ["down", "ok-missing-stub"]);
    assert.deepEqual(result.policyBlocked, ["forbidden"]);
  }

  console.log(
    JSON.stringify(
      {
        result: "passed",
        gates: [
          "autonomy-policy-block",
          "budget-exhaustion-block",
          "happy-path-single-effect",
          "budget-truth-table",
          "capability-failure-shapes",
        ],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
