import { isDeepStrictEqual } from "node:util";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MemorySupabase, type Row } from "./memory-supabase";
import { prepareOperatorTaskPatch } from "../../src/lib/revenue-os/operator-task-patch";

/** Transport fixture for existing executor tests. Native SQL tests own transaction,
 * authorization, state fencing and rollback proof. No production fallback. */
export function installLocalActionFixture(mem: MemorySupabase) {
  const copy = <T>(value: T): T => structuredClone(value);
  for (const action of mem.rows("action_queue")) {
    if (!["update_task", "delete_task", "update_next_action"].includes(String(action.action_type)))
      continue;
    const payload = action.payload as Row;
    const table = action.action_type === "update_next_action" ? "opportunities" : "tasks";
    const row = mem.rows(table).find((r) => r.id === (payload.taskId ?? payload.opportunityId));
    if (row) payload.expectedState ??= copy(row);
  }
  mem.rpc("apply_local_action", async ({ p_id, p_payload, p_actor, p_undo }) => {
    const db = mem.client as SupabaseClient;
    const a = mem.rows("action_queue").find((r) => r.id === p_id)!;
    if (!a) throw new Error("Action unavailable");
    const payload = p_payload as Row;
    const table = a.action_type === "update_next_action" ? "opportunities" : "tasks";
    const inverse = a.compensation as Row;
    const target = p_undo ? inverse.targetId : (payload.taskId ?? payload.opportunityId);
    const loaded = await db.from(table).select("*").eq("id", target).maybeSingle();
    if (loaded.error) throw new Error(loaded.error.message);
    const before = loaded.data ? copy(loaded.data as Row) : null;
    const write = async (query: PromiseLike<{ error: { message: string } | null }>) => {
      const result = await query;
      if (result.error) throw new Error(result.error.message);
    };
    if (p_undo) {
      if (inverse.receipt) return inverse.receipt;
      if (!isDeepStrictEqual(before, inverse.after))
        throw new Error("Record changed since execution");
      if (a.action_type === "create_task") await write(db.from(table).delete().eq("id", target));
      else if (a.action_type === "delete_task") await write(db.from(table).insert(inverse.before));
      else await write(db.from(table).update(inverse.before).eq("id", target));
      const receipt = { undone: a.action_type, detail: { targetId: target } };
      inverse.receipt = receipt;
      await write(
        db.from("audit_log").insert({ action: "action.compensated", actor_email: p_actor }),
      );
      return receipt;
    }
    let after: Row | null = null;
    let result: unknown;
    if (a.action_type === "create_task") {
      if (!String(payload.title ?? "").trim()) throw new Error("Task title required");
      const created = await db
        .from("tasks")
        .insert({
          title: payload.title,
          description: payload.description ?? null,
          status: "pending",
          priority: payload.priority ?? "medium",
        })
        .select("*")
        .single();
      if (created.error) throw new Error(created.error.message);
      after = copy(created.data as Row);
      result = { task: after, deduplicated: false };
    } else {
      if (!before) throw new Error("This task is no longer available");
      if (!isDeepStrictEqual(before, payload.expectedState))
        throw new Error("Record changed since proposal");
      if (a.action_type === "delete_task") {
        await write(db.from(table).delete().eq("id", target));
        result = { deleted: target };
      } else {
        let patch: Row;
        if (a.action_type === "update_next_action")
          patch = { next_action: payload.nextAction, next_action_at: payload.nextActionAt ?? null };
        else {
          if (!["complete", "snooze", "edit", "patch"].includes(String(payload.changeType)))
            throw new Error("Unknown task update changeType");
          const input =
            payload.changeType === "patch"
              ? (payload.patch as Row)
              : payload.changeType === "complete"
                ? { status: "completed" }
                : payload.changeType === "snooze"
                  ? { snoozed_until: payload.until }
                  : {
                      title: payload.title,
                      description: payload.description,
                      due_date: payload.dueDate,
                      priority: payload.priority,
                    };
          patch = prepareOperatorTaskPatch(
            before,
            { ...input, id: String(target) },
            payload.changeType !== "patch" || payload.requireOpen === true,
          );
        }
        if (!Object.keys(patch).length) throw new Error("No task fields were changed");
        await write(db.from(table).update(patch).eq("id", target));
        after = copy(mem.rows(table).find((r) => r.id === target)!);
        result = after;
      }
    }
    a.compensation = { version: 1, targetId: after?.id ?? target, before, after };
    a.reversibility = "reversible";
    a.status = "executed";
    a.error = null;
    a.executed_at = new Date().toISOString();
    a.result = result;
    return result;
  });
}
