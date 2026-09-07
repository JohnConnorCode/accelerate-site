import assert from "node:assert/strict";
import { projectOperatorAttention } from "../src/lib/revenue-os/operator-attention";
import type { OperatorQueueItem } from "../src/lib/revenue-os/types";
import { MemorySupabase } from "./lib/memory-supabase";
import {
  patchOperatorTask,
  completeOperatorTask,
  snoozeOperatorTask,
} from "../src/lib/revenue-os/tasks";
import { randomUUID } from "node:crypto";
const item = (id: string, kind: OperatorQueueItem["kind"]): OperatorQueueItem => ({
  id,
  kind,
  title: id,
  summary: "Source evidence",
  urgency: "normal",
  dueAt: null,
  sourceTimestamp: "2026-09-07T00:00:00Z",
  priorityReason: "Needs attention",
  recommendedNextAction: "Open the original",
  href: "/admin/work",
});
async function main() {
  const custom = {
    ...item("native:42", "system"),
    attention: { sourceType: "creative_review", sourceId: "42", kind: "work" as const },
  };
  const input = [
    item("task:recovery", "reply"),
    item("conversation:c1", "reply"),
    item("action:a1", "approval"),
    item("meeting:m1", "meeting"),
    custom,
    custom,
  ];
  const rows = projectOperatorAttention(input);
  assert.equal(rows.length, 5, "One row per source even when contributed twice");
  assert.deepEqual(
    rows.map((r) => [r.sourceType, r.sourceId, r.attentionKind]),
    [
      ["task", "recovery", "work"],
      ["conversation", "c1", "watch"],
      ["approval", "a1", "decision"],
      ["calendar_event", "m1", "upcoming"],
      ["creative_review", "42", "work"],
    ],
  );
  assert.equal(rows[4]!.href, custom.href, "Custom work retains its native command entrypoint");
  assert.equal("status" in rows[0]!, false, "Attention does not add a lifecycle");
  const id = randomUUID();
  const mem = new MemorySupabase({
    tasks: [
      {
        id,
        title: "Prepare review",
        status: "pending",
        priority: "medium",
        due_date: "2026-09-07",
        completed_at: null,
        snoozed_until: null,
      },
    ],
    audit_log: [],
    activities: [],
  });
  const db = mem.client;
  await patchOperatorTask(db, {
    id,
    title: "Prepare revision 4",
    due_date: null,
    actorEmail: "operator@example.test",
  });
  assert.equal(mem.rows("tasks")[0]!.status, "pending", "Editing does not complete work");
  assert.equal(mem.rows("tasks")[0]!.due_date, null);
  const until = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  await snoozeOperatorTask(db, { id, until, actorEmail: "operator@example.test" });
  assert.equal(mem.rows("tasks")[0]!.status, "snoozed");
  assert.equal(mem.rows("tasks")[0]!.completed_at, null);
  await completeOperatorTask(db, { id, actorEmail: "operator@example.test" });
  assert.equal(mem.rows("tasks")[0]!.status, "completed");
  assert.equal(mem.rows("tasks")[0]!.snoozed_until, null);
  assert.equal(mem.rows("tasks").length, 1, "Every surface mutates the original task");
  await assert.rejects(
    () => completeOperatorTask(db, { id, actorEmail: "operator@example.test" }),
    /already completed/,
  );
  await assert.rejects(
    () =>
      patchOperatorTask(db, { id, due_date: "2026-02-31", actorEmail: "operator@example.test" }),
    /Invalid due date/,
  );
  assert.equal(
    mem.rows("audit_log").length,
    3,
    "Edit, snooze and completion retain distinct audit events",
  );
  console.log(
    "PASS: source identities, recovery tasks, optional native custom work, duplicate projections, canonical task edits/snooze/completion and replay refusal.",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
