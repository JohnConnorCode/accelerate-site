import assert from "node:assert/strict";
import { approveAndExecuteAction, executeTaskWrite } from "../src/lib/revenue-os/action-executor";
import { compensateAction } from "../src/lib/revenue-os/action-reversibility";
import { proposeAction } from "../src/lib/revenue-os/actions";
import { AuthorizedMemorySupabase as MemorySupabase } from "./lib/autonomy-fixture";

const ACTOR = "founder@example.com";

type Row = Record<string, unknown>;

function queue(mem: MemorySupabase) {
  return mem.rows("action_queue") as Row[];
}

function audits(mem: MemorySupabase, action: string) {
  return (mem.rows("audit_log") as Row[]).filter((r) => r.action === action);
}

function auditFor(mem: MemorySupabase, action: string, entityId: unknown) {
  return audits(mem, action).some((r) => r.entity_id === entityId);
}

async function main() {
  const mem = new MemorySupabase({
    opportunities: [],
    tasks: [],
    action_queue: [],
    audit_log: [],
    activities: [],
    agent_memory: [],
  });
  const db = mem.client as never;

  // 1. UI create traverses the executor: the queued row carries
  // executor-only receipts (claim approval, authorized audit, stamp).
  const created = (await executeTaskWrite(
    db,
    { kind: "create", title: "Uniforms", description: "Press blues" },
    ACTOR,
  )) as { task: Row };
  assert.equal(created.task.title, "Uniforms");
  const uiRow = queue(mem).find((r) => r.source_context === "admin-ui");
  assert.ok(uiRow, "UI write must stage an action_queue row");
  assert.equal(uiRow.status, "executed");
  assert.equal(uiRow.reversibility, "reversible");
  assert.equal(uiRow.approved_by, ACTOR);
  assert.ok(
    auditFor(mem, "action.authorized", uiRow.id),
    "UI write must carry the executor authorization audit",
  );

  // 2. Same code path: a programmatic executor run produces the identical
  // receipt shape. If the UI helper ever bypassed the executor, section 1
  // would lose its stamps and this equivalence would break.
  const proposed = (await proposeAction(db, {
    actionType: "create_task",
    title: "Programmatic",
    payload: { title: "Programmatic" },
    sourceContext: "test",
  })) as { id: string };
  await approveAndExecuteAction(db, proposed.id, ACTOR);
  const progRow = queue(mem).find((r) => r.id === proposed.id) as Row;
  for (const key of ["status", "reversibility", "approved_by"] as const)
    assert.equal(progRow[key], uiRow[key], `programmatic and UI runs share ${key}`);
  assert.ok(
    auditFor(mem, "action.authorized", progRow.id),
    "programmatic run must carry the same authorization audit",
  );

  // 3. Description edits undo to the prior description, not blanks.
  const taskId = String(created.task.id);
  await executeTaskWrite(db, { kind: "edit", taskId, description: "Steam only" }, ACTOR);
  assert.equal(
    (mem.rows("tasks") as Row[]).find((r) => r.id === taskId)?.description,
    "Steam only",
  );
  const editRow = queue(mem).find(
    (r) => r.action_type === "update_task" && (r.payload as Row)?.taskId === taskId,
  ) as Row;
  await compensateAction(db, String(editRow.id), ACTOR);
  assert.equal(
    (mem.rows("tasks") as Row[]).find((r) => r.id === taskId)?.description,
    "Press blues",
    "compensator must restore the prior description",
  );

  // 4. Delete runs as an approved executor action with a working restore,
  // and a second undo is fenced instead of re-running the compensator.
  await executeTaskWrite(db, { kind: "delete", taskId }, ACTOR);
  assert.equal(
    (mem.rows("tasks") as Row[]).filter((r) => r.id === taskId).length,
    0,
    "delete must remove the row",
  );
  const deleteRow = queue(mem).find((r) => r.action_type === "delete_task") as Row;
  assert.equal(deleteRow.reversibility, "reversible");
  const restored = await compensateAction(db, String(deleteRow.id), ACTOR);
  assert.equal(restored.detail.restored_task_id, taskId);
  assert.equal(
    (mem.rows("tasks") as Row[]).find((r) => r.id === taskId)?.title,
    "Uniforms",
    "compensator must restore the deleted row with its identity",
  );
  await assert.rejects(
    () => compensateAction(db, String(deleteRow.id), ACTOR),
    /already compensated/,
    "a second undo must be fenced, not re-executed",
  );

  // 5. Reopen returns a completed task to pending through the same path.
  const done = (await executeTaskWrite(db, { kind: "create", title: "Close me" }, ACTOR)) as {
    task: Row;
  };
  const doneId = String(done.task.id);
  await executeTaskWrite(db, { kind: "complete", taskId: doneId }, ACTOR);
  assert.equal((mem.rows("tasks") as Row[]).find((r) => r.id === doneId)?.status, "completed");
  await executeTaskWrite(db, { kind: "reopen", taskId: doneId }, ACTOR);
  assert.equal((mem.rows("tasks") as Row[]).find((r) => r.id === doneId)?.status, "pending");

  console.log(
    JSON.stringify({
      result: "passed",
      checks: [
        "ui-create-executor-receipts",
        "programmatic-parity",
        "description-undo",
        "delete-compensator",
        "compensation-fencing",
        "reopen-path",
      ],
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
