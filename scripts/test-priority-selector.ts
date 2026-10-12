#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  operatorTaskQueuePresentation,
  operatorTaskRecordHref,
  loadOperatorQueue,
  sortOperatorQueue,
  summarizeOperatorQueue,
  validateOperatorQueue,
} from "../src/lib/revenue-os/queue";
import type { OperatorQueueItem } from "../src/lib/revenue-os/types";
import { MemorySupabase } from "./lib/memory-supabase";
import { DEMO_SCENARIOS } from "../src/lib/admin/demo/scenarios";
import { initialState, priority as demoPriority } from "../src/lib/admin/demo/runtime";

function item(
  overrides: Partial<OperatorQueueItem> & Pick<OperatorQueueItem, "id" | "kind">,
): OperatorQueueItem {
  return {
    title: overrides.id,
    summary: "Grounded source fact",
    urgency: "normal",
    dueAt: null,
    sourceTimestamp: "2026-08-23T12:00:00.000Z",
    priorityReason: "Inspectable deterministic rule",
    recommendedNextAction: "Open the source record and act.",
    href: "/admin/today",
    ...overrides,
  };
}

const ranked = sortOperatorQueue([
  item({ id: "normal", kind: "reply" }),
  item({ id: "later", kind: "task", urgency: "high", dueAt: "2026-08-24" }),
  item({
    id: "earlier-b",
    kind: "task",
    urgency: "high",
    dueAt: "2026-08-23",
    sourceTimestamp: "2026-08-23T11:00:00.000Z",
  }),
  item({
    id: "earlier-a",
    kind: "task",
    urgency: "high",
    dueAt: "2026-08-23",
    sourceTimestamp: "2026-08-23T11:00:00.000Z",
  }),
  item({ id: "critical", kind: "system", urgency: "critical", dueAt: "2026-08-25" }),
]);

assert.deepEqual(
  ranked.map((entry) => entry.id),
  ["critical", "earlier-a", "earlier-b", "later", "normal"],
  "urgency, deadline, source time, and stable ID tie-break must fully determine rank",
);
for (const entry of ranked) {
  assert.ok(entry.priorityReason, `${entry.id} must explain why it is ranked`);
  assert.ok(entry.sourceTimestamp, `${entry.id} must expose its source timestamp`);
  assert.ok(entry.recommendedNextAction, `${entry.id} must expose a recommended next action`);
}
assert.doesNotThrow(() => validateOperatorQueue(ranked));
assert.throws(
  () =>
    validateOperatorQueue([item({ id: "missing-next", kind: "task", recommendedNextAction: "" })]),
  /does not satisfy/,
  "the selector must refuse an item that cannot tell the operator what to do next",
);

assert.deepEqual(summarizeOperatorQueue(ranked), {
  total: 5,
  urgent: 4,
  critical: 1,
  byKind: { reply: 1, approval: 0, task: 3, follow_up: 0, meeting: 0, proposal: 0, system: 1 },
});

assert.equal(
  operatorTaskRecordHref({ related_type: "proposal", related_id: "p-1", opportunity_id: null }),
  "/admin/proposals?proposal=p-1",
);
assert.equal(
  operatorTaskRecordHref({ related_type: "client", related_id: "c-1", opportunity_id: null }),
  "/admin/clients/c-1",
);
assert.equal(
  operatorTaskRecordHref({ related_type: "contact", related_id: "person-1", opportunity_id: null }),
  "/admin/contacts/person-1",
);
assert.equal(
  operatorTaskRecordHref({
    related_type: "campaign",
    related_id: "campaign-1",
    opportunity_id: null,
  }),
  "/admin/campaigns?campaign=campaign-1",
);
assert.equal(
  operatorTaskRecordHref({ related_type: "lead", related_id: "lead-1", opportunity_id: "opp-1" }),
  "/admin/pipeline/opp-1",
  "a canonical opportunity must win over a legacy related type",
);
assert.deepEqual(
  operatorTaskQueuePresentation(
    {
      source: "recovery",
      title: "Reply to recovery lead: lead@example.com",
      priority: "high",
      dueDate: "2026-08-23",
    },
    "2026-08-23",
  ),
  {
    kind: "reply",
    priorityReason: "Recovery reply needs a personal response",
    recommendedNextAction:
      "Open the contact, respond personally while intent is fresh, then complete the task.",
  },
  "recovery replies must appear in the Replies lane with a conversion-oriented next action",
);
assert.deepEqual(
  operatorTaskQueuePresentation(
    {
      source: "recovery",
      title: "Confirm recovery booking: lead@example.com",
      priority: "high",
      dueDate: "2026-08-23",
    },
    "2026-08-23",
  ),
  {
    kind: "reply",
    priorityReason: "Recovery booking needs immediate confirmation",
    recommendedNextAction:
      "Open the contact, confirm the appointment, prepare the conversation, then complete the task.",
  },
  "recovery bookings must appear in the Replies lane with a meeting-prep action",
);

const overview = readFileSync("src/app/api/admin/revenue-os/overview/route.ts", "utf8");
const priorityRoute = readFileSync("src/app/api/admin/revenue-os/priority/route.ts", "utf8");
const notifications = readFileSync("src/app/api/admin/notifications/route.ts", "utf8");
const aiTools = readFileSync("src/lib/revenue-os/ai-tools.ts", "utf8");
const adminShell = readFileSync("src/components/admin/AdminShell.tsx", "utf8");
for (const [consumer, source] of Object.entries({
  overview,
  priorityRoute,
  notifications,
  aiTools,
})) {
  assert.match(
    source,
    /loadOperatorQueue/,
    `${consumer} must consume the canonical priority selector`,
  );
}
assert.match(
  adminShell,
  /\/api\/admin\/revenue-os\/priority/,
  "navigation counters must read the canonical selector endpoint",
);
assert.match(
  adminShell,
  /admin:priority-refresh/,
  "mutations must be able to refresh navigation priority state immediately",
);

async function verifyTaskDeadlines() {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const task = (id: string, priority: string, dueDate: string) => ({
    id,
    title: `Follow up: ${id}`,
    status: "pending",
    priority,
    due_date: dueDate,
    snoozed_until: null,
    related_type: "contact",
    related_id: "person-1",
    opportunity_id: null,
    created_at: `${yesterday}T12:00:00.000Z`,
  });
  const mem = new MemorySupabase({
    tasks: [
      task("a-overdue-high", "high", yesterday),
      task("b-overdue-medium", "medium", yesterday),
      task("c-overdue-low", "low", yesterday),
      task("due-today", "high", today),
      task("upcoming", "high", tomorrow),
      { ...task("snoozed", "high", yesterday), status: "snoozed", snoozed_until: tomorrow },
      { ...task("completed", "high", yesterday), status: "completed" },
    ],
  });
  const before = JSON.stringify(mem.rows("tasks"));
  const options = { onSourceError: () => {} };
  const queue = await loadOperatorQueue(mem.client, options);
  const commitments = queue.filter((entry) => entry.id.startsWith("task:"));
  assert.deepEqual(
    commitments.map((entry) => entry.id),
    [
      "task:a-overdue-high",
      "task:b-overdue-medium",
      "task:c-overdue-low",
      "task:due-today",
      "task:upcoming",
    ],
    "Every overdue commitment precedes high-priority work that is still on time",
  );
  for (const entry of commitments.slice(0, 3)) {
    assert.equal(entry.urgency, "critical", "An overdue high priority must never lower urgency");
    assert.equal(entry.priorityReason, "Overdue commitment");
    assert.equal(entry.href, "/admin/contacts/person-1");
    assert.ok(entry.recommendedNextAction);
  }
  assert.equal(commitments[3]!.urgency, "high", "Due today is not overdue");
  assert.deepEqual(
    await loadOperatorQueue(mem.client, options),
    queue,
    "Repeated reads stay stable",
  );
  assert.equal(JSON.stringify(mem.rows("tasks")), before, "Ranking never mutates commitments");
  const unavailable: string[] = [];
  mem.fail("tasks", { message: "Tasks unavailable" });
  const degraded = await loadOperatorQueue(mem.client, {
    onSourceError: (source) => unavailable.push(source),
  });
  assert.ok(unavailable.includes("Tasks"), "A failed source must report unavailable tasks");
  assert.equal(
    degraded.some((entry) => entry.id.startsWith("task:")),
    false,
  );
  for (const pack of Object.values(DEMO_SCENARIOS)) {
    const state = initialState();
    for (const [index, priority] of (["high", "medium", "low"] as const).entries())
      state.taskOverrides[pack.tasks[index]!.id] = {
        status: "pending",
        priority,
        due_date: yesterday,
      };
    const upcomingId = pack.tasks[3]!.id;
    state.taskOverrides[upcomingId] = { status: "pending", priority: "high", due_date: tomorrow };
    const before = JSON.stringify(state);
    const result = demoPriority(pack, state);
    assert.deepEqual(
      result.items,
      sortOperatorQueue([...result.items].reverse()),
      `${pack.id}: shared ordering`,
    );
    for (const task of pack.tasks.slice(0, 3)) {
      const index = result.items.findIndex((item) => item.id === `task:${task.id}`);
      assert.ok(index >= 0);
      assert.equal(result.items[index]!.urgency, "critical", `${pack.id}: overdue ${task.id}`);
      assert.ok(index < result.items.findIndex((item) => item.id === `task:${upcomingId}`));
    }
    assert.equal(
      result.summary.critical,
      result.items.filter((item) => item.urgency === "critical").length,
    );
    assert.equal(
      result.summary.urgent,
      result.items.filter((item) => ["critical", "high"].includes(item.urgency)).length,
    );
    assert.equal(
      JSON.stringify(state),
      before,
      `${pack.id}: a queue read never changes demo state`,
    );
  }
}

verifyTaskDeadlines()
  .then(() =>
    console.log(
      JSON.stringify(
        {
          result: "passed",
          checks: [
            "deterministic rank",
            "stable ID tie-break",
            "required explanation fields",
            "record-safe task links",
            "shared summary",
            "Today API consumer",
            "navigation consumer",
            "AI consumer",
            "notification consumer",
            "overdue task urgency and deadline precedence",
            "snoozed and completed task exclusion",
            "read-only stable ranking and degraded source reporting",
            "shared deadline ordering and truthful counts in all six fictional demos",
          ],
        },
        null,
        2,
      ),
    ),
  )
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
