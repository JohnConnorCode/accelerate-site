import assert from "node:assert/strict";
import { approveAndExecuteAction, APPROVABLE_ACTIONS } from "../src/lib/revenue-os/action-executor";
import {
  ACTION_REVERSIBILITY,
  compensateAction,
  reversibilityOf,
} from "../src/lib/revenue-os/action-reversibility";
import { proposeAction } from "../src/lib/revenue-os/actions";
import { AuthorizedMemorySupabase as MemorySupabase } from "./lib/autonomy-fixture";

const ACTOR = "founder@example.com";

function pendingAction(overrides: Record<string, unknown> = {}) {
  return {
    id: `action-${Math.random().toString(36).slice(2, 9)}`,
    action_type: "create_task",
    title: "Test action",
    payload: {},
    status: "pending",
    ...overrides,
  };
}

async function main() {
  // 1. Registry completeness: every executable action declares exactly one
  // reversibility class, and impact stays a separate declared axis.
  assert.equal(
    new Set(ACTION_REVERSIBILITY.map((r) => r.actionType)).size,
    APPROVABLE_ACTIONS.length,
    "every approvable action must declare exactly one reversibility class",
  );
  for (const name of APPROVABLE_ACTIONS) {
    const entry = reversibilityOf(name);
    assert.ok(
      ["reversible", "compensable", "irreversible"].includes(entry.reversibility),
      `${name} has a valid class`,
    );
    assert.ok(
      ["read", "internal_write", "external_action"].includes(entry.impact),
      `${name} keeps impact as a separate declared axis`,
    );
  }
  assert.throws(() => reversibilityOf("wire_money_somewhere"), /no reversibility class/);

  const mem = new MemorySupabase({
    opportunities: [
      { id: "o9", stage: "qualified", next_action: "Call Ana", next_action_at: null },
    ],
    tasks: [],
    action_queue: [],
    audit_log: [],
    activities: [],
    agent_memory: [],
  });
  const db = mem.client as never;

  // 2. Irreversible actions refuse autonomous execution before any effect.
  mem.tables.action_queue!.push({
    ...pendingAction({
      id: "a-send",
      action_type: "send_email",
      payload: { to: "x@y.zz", subject: "s", body: "b" },
    }),
  });
  await assert.rejects(
    () => approveAndExecuteAction(db, "a-send", ACTOR, { mode: "autonomous" }),
    /requires human approval/,
    "irreversible sends must never run autonomously",
  );
  assert.equal(
    mem.rows("action_queue").find((r) => r.id === "a-send")?.status,
    "failed",
    "refused autonomous run must fail closed with a receipt, not linger",
  );

  // 3. Replay idempotency: a duplicate proposal resolves to one row.
  const first = (await proposeAction(db, {
    actionType: "create_task",
    title: "Quote Q3",
    payload: { title: "Quote Q3" },
    sourceContext: "test",
    dedupeKey: "replay-1",
  })) as { id: string };
  const second = (await proposeAction(db, {
    actionType: "create_task",
    title: "Quote Q3",
    payload: { title: "Quote Q3" },
    sourceContext: "test",
    dedupeKey: "replay-1",
  })) as { id: string };
  assert.equal(first.id, second.id, "replayed proposal must deduplicate to one effect");

  // 4. create_task executes, stamps its inverse, and undoes truthfully.
  mem.tables.action_queue!.push({
    ...pendingAction({ id: "a-task", payload: { title: "Quote Q3" } }),
  });
  await approveAndExecuteAction(db, "a-task", ACTOR);
  const created = mem.rows("tasks").find((r) => r.title === "Quote Q3");
  assert.ok(created, "approved task must exist after execution");
  const stored = mem.rows("action_queue").find((r) => r.id === "a-task") as Record<string, unknown>;
  assert.equal(stored.status, "executed");
  assert.equal(stored.reversibility, "reversible");
  assert.equal((stored.compensation as Record<string, unknown>)?.createdTaskId, created!.id);
  const undone = await compensateAction(db, "a-task", ACTOR);
  assert.equal(undone.undone, "create_task");
  assert.equal(
    mem.rows("tasks").filter((r) => r.title === "Quote Q3").length,
    0,
    "compensator must remove the created row",
  );
  assert.ok(
    mem.rows("audit_log").some((r) => r.action === "action.compensated"),
    "compensation must leave an audit receipt",
  );

  // 5. update_next_action restores the prior values, not blanks.
  mem.tables.action_queue!.push({
    ...pendingAction({
      id: "a-next",
      action_type: "update_next_action",
      payload: { opportunityId: "o9", nextAction: "Send contract" },
    }),
  });
  await approveAndExecuteAction(db, "a-next", ACTOR);
  assert.equal(mem.rows("opportunities").find((r) => r.id === "o9")?.next_action, "Send contract");
  await compensateAction(db, "a-next", ACTOR);
  assert.equal(
    mem.rows("opportunities").find((r) => r.id === "o9")?.next_action,
    "Call Ana",
    "compensator must restore prior values, not blanks",
  );

  // 6. update_task complete reopens to the captured prior state.
  mem.tables.tasks!.push({
    id: "t9",
    title: "Follow up",
    status: "pending",
    priority: "medium",
    due_date: null,
    snoozed_until: null,
    completed_at: null,
  });
  mem.tables.action_queue!.push({
    ...pendingAction({
      id: "a-complete",
      action_type: "update_task",
      payload: { taskId: "t9", changeType: "complete" },
    }),
  });
  await approveAndExecuteAction(db, "a-complete", ACTOR);
  assert.equal(mem.rows("tasks").find((r) => r.id === "t9")?.status, "completed");
  await compensateAction(db, "a-complete", ACTOR);
  const reopened = mem.rows("tasks").find((r) => r.id === "t9");
  assert.equal(reopened?.status, "pending");
  assert.equal(reopened?.completed_at, null);

  // 7. Refusals: non-executed rows and irreversible types never undo.
  mem.tables.action_queue!.push({ ...pendingAction({ id: "a-pending" }) });
  await assert.rejects(() => compensateAction(db, "a-pending", ACTOR), /Only executed actions/);
  mem.tables.action_queue!.push({
    ...pendingAction({ id: "a-sent", action_type: "send_email", status: "executed" }),
  });
  await assert.rejects(() => compensateAction(db, "a-sent", ACTOR), /irreversible/);

  console.log(
    JSON.stringify({
      result: "passed",
      checks: [
        "registry-completeness",
        "autonomous-irreversible-refusal",
        "replay-idempotency",
        "create-task-compensator",
        "next-action-restore",
        "task-reopen",
        "compensation-refusals",
      ],
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
