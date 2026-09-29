import assert from "node:assert/strict";
import { handleMcpRequest } from "../src/lib/revenue-os/mcp-server";
import { executeRegisteredRevenueTool } from "../src/lib/revenue-os/ai-tools";
import { approveAndExecuteAction, executeTaskWrite } from "../src/lib/revenue-os/action-executor";
import { compensateAction } from "../src/lib/revenue-os/action-reversibility";
import { patchOperatorTask } from "../src/lib/revenue-os/tasks";
import { taskReviewState } from "../src/lib/revenue-os/operator-task-patch";
import { AuthorizedMemorySupabase } from "./lib/autonomy-fixture";
import { tenant } from "../src/config/tenant";

const actorEmail = "founder@example.test";
function fixture() {
  const mem = new AuthorizedMemorySupabase({
    tasks: [
      {
        id: "task-1",
        title: "Review the customer brief",
        description: "Original instructions",
        priority: "medium",
        due_date: null,
        status: "completed",
        snoozed_until: null,
        completed_at: "2026-09-28T12:00:00.000Z",
        opportunity_id: null,
      },
    ],
    action_queue: [],
    activities: [],
    audit_log: [],
    agent_memory: [],
  });
  return {
    mem,
    context: { supabase: mem.client, actorEmail, tenantSlug: "accelerate", tenantConfig: tenant },
  };
}
async function main() {
  const originalFetch = globalThis.fetch;
  let escapedRequests = 0;
  globalThis.fetch = async () => {
    escapedRequests++;
    throw new Error("Network forbidden in task proof");
  };
  try {
    const { mem, context } = fixture();
    const row = () => mem.rows("tasks")[0]!;
    const call = async (input: Record<string, unknown>) => {
      const response = await handleMcpRequest(
        {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "propose_task_update", arguments: input },
        },
        context,
      );
      const result = response!.result as { isError: boolean; content: { text: string }[] };
      assert.equal(result.isError, false, result.content[0]!.text);
      return JSON.parse(result.content[0]!.text) as { id: string };
    };
    const propose = async (input: Record<string, unknown>) =>
      executeRegisteredRevenueTool(context, "propose_task_update", input);
    const reopened = await call({ taskId: "task:task-1", changeType: "reopen" });
    assert.equal(row().status, "completed", "MCP only stages a review");
    const retried = await call({ changeType: "reopen", taskId: "task-1" });
    assert.equal(retried.id, reopened.id, "aliases and retry order reuse one proposal");
    assert.equal(mem.rows("action_queue").length, 1);
    await approveAndExecuteAction(context.supabase, reopened.id, actorEmail);
    assert.equal(row().status, "pending");
    assert.equal(row().completed_at, null);
    await assert.rejects(
      () => approveAndExecuteAction(context.supabase, reopened.id, actorEmail),
      /already handled/,
    );

    const edit = await call({
      taskId: "task-1",
      changeType: "edit",
      description: "Call the customer first",
    });
    const revised = await call({
      taskId: "task-1",
      changeType: "edit",
      description: "Check the brief first",
    });
    assert.notEqual(edit.id, revised.id, "changed content requires its own review");
    assert.equal(row().description, "Original instructions");
    await approveAndExecuteAction(context.supabase, edit.id, actorEmail);
    assert.equal(row().description, "Call the customer first");
    await assert.rejects(
      () => approveAndExecuteAction(context.supabase, revised.id, actorEmail),
      /changed since the proposal/,
    );
    assert.equal(
      row().description,
      "Call the customer first",
      "stale same-status edit preserves newer text",
    );
    assert.equal(mem.rows("action_queue").find((r) => r.id === revised.id)!.status, "failed");
    const clear = await call({ taskId: "task-1", changeType: "edit", description: "" });
    assert.match(
      String(mem.rows("action_queue").find((r) => r.id === clear.id)!.description),
      /Clear the description/,
    );
    await approveAndExecuteAction(context.supabase, clear.id, actorEmail);
    assert.equal(row().description, null);
    await compensateAction(context.supabase, clear.id, actorEmail);
    assert.equal(row().description, "Call the customer first", "existing undo retains description");

    for (const input of [
      { taskId: "missing", changeType: "edit", title: "New" },
      { taskId: "task-1", changeType: "complete", description: "Silently ignored?" },
      { taskId: "task-1", changeType: "edit", until: "2099-01-01", title: "New" },
      { taskId: "task-1", changeType: "edit" },
      { taskId: "task-1", changeType: "edit", title: " " },
      { taskId: "task-1", changeType: "edit", dueDate: "2026-02-30" },
      { taskId: "task-1", changeType: "edit", description: "x".repeat(10001) },
      { taskId: "task-1", changeType: "edit", title: "New", expectedState: {} },
    ])
      await assert.rejects(() => propose(input), JSON.stringify(input).slice(0, 180));
    mem.fail("tasks", { message: "private database error" });
    await assert.rejects(
      () => propose({ taskId: "task-1", changeType: "complete" }),
      /Could not read the task/,
    );
    mem.recover("tasks");

    const denied = await call({ taskId: "task-1", changeType: "complete" });
    mem.rpc("check_autonomy", () => ({
      allowed: false,
      level: "prohibited",
      reason: "Access revoked",
    }));
    await assert.rejects(
      () => approveAndExecuteAction(context.supabase, denied.id, actorEmail),
      /denied/,
    );
    assert.equal(row().status, "pending");
    assert.equal(mem.rows("action_queue").find((r) => r.id === denied.id)!.status, "denied");

    // Inject a same-status update after the service read but before its conditional write.
    const race = fixture();
    const task = race.mem.rows("tasks")[0]!;
    task.status = "pending";
    const expectedState = taskReviewState(task);
    const base = race.context.supabase as Parameters<typeof patchOperatorTask>[0];
    const db = new Proxy(base, {
      get(target, key) {
        if (key !== "from") return Reflect.get(target, key);
        return (table: string) => {
          const query = target.from(table);
          if (table !== "tasks") return query;
          return new Proxy(query, {
            get(q, method) {
              if (method !== "update") return Reflect.get(q, method);
              return (patch: Record<string, unknown>) => {
                task.description = "Another operator changed this";
                return q.update(patch);
              };
            },
          });
        };
      },
    });
    await assert.rejects(
      () =>
        patchOperatorTask(db, { id: "task-1", title: "Overwritten?", expectedState, actorEmail }),
      /changed while you were working/,
    );
    assert.equal(task.title, "Review the customer brief");
    assert.equal(task.description, "Another operator changed this");
    assert.equal(race.mem.rows("activities").length, 0);

    // UI and AI still use the same executor and canonical task identity.
    await executeTaskWrite(
      base,
      { kind: "edit", taskId: "task-1", description: "UI edit" },
      actorEmail,
    );
    assert.equal(task.description, "UI edit");
    assert.ok(race.mem.rows("audit_log").some((r) => r.action === "task.updated"));
    assert.equal(escapedRequests, 0);
    console.log(
      "Task lifecycle parity passed: MCP reopen/edit/clear, pending-only proposals, alias/retry identity, changed review, stale and racing edits, invalid inputs, revoked policy, undo, shared UI executor; zero network requests.",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
