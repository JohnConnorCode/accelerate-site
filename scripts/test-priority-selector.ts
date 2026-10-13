#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mock } from "node:test";
import { createClient } from "@supabase/supabase-js";
import {
  operatorTaskQueuePresentation,
  operatorTaskRecordHref,
  loadOperatorQueue,
  sortOperatorQueue,
  summarizeOperatorQueue,
  validateOperatorQueue,
} from "../src/lib/revenue-os/queue";
import type { OperatorQueueItem } from "../src/lib/revenue-os/types";
import { MemorySupabase, type Row } from "./lib/memory-supabase";
import { DEMO_SCENARIOS } from "../src/lib/admin/demo/scenarios";
import { initialState, priority as demoPriority } from "../src/lib/admin/demo/runtime";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import { ACCELERATE_TENANT_ID } from "../src/lib/tenancy/context";
import { getRevenueAiTools } from "../src/lib/revenue-os/ai-tools";

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

async function verifyTaskSourceSelection() {
  mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-13T12:00:00.000Z") });
  const today = "2026-10-13";
  const task = (id: string, overrides: Row = {}) => ({
    id,
    tenant_id: ACCELERATE_TENANT_ID,
    title: `Follow up: ${id}`,
    status: "pending",
    priority: "medium",
    due_date: today,
    snoozed_until: null,
    source: "manual",
    related_type: "contact",
    related_id: "person-1",
    opportunity_id: null,
    created_at: "2026-10-01T12:00:00.000Z",
    ...overrides,
  });
  const many = (overrides: Row = {}) =>
    Array.from({ length: 80 }, (_, index) =>
      task(`z-${index.toString().padStart(3, "0")}`, overrides),
    );
  const cases = [
    {
      name: "overdue after first50",
      rows: [
        ...many({ priority: "high" }).slice(0, 50),
        task("late-overdue", { priority: "low", due_date: "2026-10-12" }),
      ],
      first: "late-overdue",
    },
    {
      name: "High before on-time normal",
      rows: [...many(), task("late-high", { priority: "high", due_date: "2026-10-14" })],
      first: "late-high",
    },
    {
      name: "snoozed rows do not consume slots",
      rows: [
        ...many({ status: "snoozed", due_date: "2026-10-11", snoozed_until: "2026-10-14" }),
        task("expired-snooze", { status: "snoozed", snoozed_until: today }),
      ],
      first: "expired-snooze",
    },
    {
      name: "oldest deadline before creation time",
      rows: [
        ...many({ due_date: "2026-10-12" }),
        task("older-deadline", { due_date: "2026-10-10", created_at: "2026-10-13T11:00:00.000Z" }),
      ],
      first: "older-deadline",
    },
    {
      name: "recovery reply wins a deadline tie",
      rows: [
        ...many(),
        task("late-recovery", { source: "recovery", created_at: "2026-10-13T11:00:00.000Z" }),
      ],
      first: "late-recovery",
    },
    {
      name: "lead recovery remains follow-up",
      rows: [...many({ source: "recovery", related_type: "lead" }), task("late-task")],
      first: "late-task",
    },
    {
      name: "older source wins an exact kind tie",
      rows: [...many(), task("older-source", { created_at: "2026-09-01T12:00:00.000Z" })],
      first: "older-source",
    },
    {
      name: "stable ID wins exact timestamp tie",
      rows: [...many(), task("a-first")],
      first: "a-first",
    },
    {
      name: "nullable priority and related type stay eligible",
      rows: [task("nullable", { priority: null, related_type: null })],
      first: "nullable",
    },
    {
      name: "completed and outside-horizon rows stay excluded",
      rows: [
        ...many({ status: "completed", due_date: "2026-10-12" }),
        task("undated", { due_date: null }),
        task("outside-horizon", { due_date: "2026-10-21" }),
        task("seven-day-boundary", { due_date: "2026-10-20" }),
      ],
      first: "seven-day-boundary",
    },
    {
      name: "mixed urgency and kind groups merge into the canonical top75",
      rows: (["critical", "high", "normal"] as const).flatMap((urgency) =>
        (["reply", "task", "follow_up"] as const).flatMap((kind) =>
          Array.from({ length: 12 }, (_, index) =>
            task(`${urgency}-${kind}-${index.toString().padStart(2, "0")}`, {
              priority: urgency === "high" ? "high" : "low",
              due_date:
                urgency === "critical" ? "2026-10-12" : urgency === "high" ? "2026-10-14" : today,
              source: kind === "reply" ? "recovery" : "manual",
              related_type: kind === "follow_up" ? "lead" : "contact",
            }),
          ),
        ),
      ),
      first: "critical-reply-00",
    },
  ];
  try {
    for (const fixture of cases) {
      for (const rows of [fixture.rows, [...fixture.rows].reverse()]) {
        const mem = new MemorySupabase({
          tasks: rows,
          tenants: [{ id: ACCELERATE_TENANT_ID, status: "active" }],
        });
        const database = bindTenantDatabase(mem.client, ACCELERATE_TENANT_ID, true);
        const before = JSON.stringify(mem.rows("tasks"));
        const expected = sortOperatorQueue(
          rows
            .filter(
              (row) =>
                ["pending", "snoozed"].includes(String(row.status)) &&
                typeof row.due_date === "string" &&
                row.due_date <= "2026-10-20" &&
                (!row.snoozed_until || String(row.snoozed_until) <= today),
            )
            .map((row) =>
              item({
                id: `task:${row.id}`,
                kind:
                  row.related_type === "lead"
                    ? "follow_up"
                    : row.source === "recovery"
                      ? "reply"
                      : "task",
                urgency:
                  String(row.due_date) < today
                    ? "critical"
                    : row.priority === "high"
                      ? "high"
                      : "normal",
                dueAt: String(row.due_date),
                sourceTimestamp: String(row.created_at),
              }),
            ),
        ).slice(0, 75);
        const queue = await loadOperatorQueue(database);
        assert.deepEqual(
          queue.map((entry) => entry.id),
          expected.map((entry) => entry.id),
          fixture.name,
        );
        assert.equal(queue[0]?.id, `task:${fixture.first}`, fixture.name);
        assert.deepEqual(
          await loadOperatorQueue(database),
          queue,
          `${fixture.name}: repeatability`,
        );
        assert.equal(JSON.stringify(mem.rows("tasks")), before, `${fixture.name}: read only`);
      }
    }
    const requests: URL[] = [];
    let failPartition = false;
    let duplicatePartition = false;
    const transport = createClient("https://queue-fixture.invalid", "fixture-not-a-credential", {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        fetch: async (input) => {
          const url = new URL(
            typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
          );
          requests.push(url);
          if (
            duplicatePartition &&
            url.pathname.endsWith("/tasks") &&
            url.searchParams.get("priority") === "eq.high" &&
            url.searchParams.has("source")
          )
            return new Response(
              JSON.stringify([
                task("moved-between-partitions", {
                  priority: "high",
                  source: url.searchParams.get("source") === "eq.recovery" ? "recovery" : "manual",
                }),
              ]),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          if (
            failPartition &&
            url.pathname.endsWith("/tasks") &&
            url.searchParams.get("priority") === "eq.high"
          ) {
            const body =
              url.searchParams.get("source") === "eq.recovery"
                ? { message: "Task partition unavailable" }
                : url.searchParams.get("source") === "neq.recovery"
                  ? [task("healthy-partition", { priority: "high" })]
                  : [];
            return new Response(JSON.stringify(body), {
              status: Array.isArray(body) ? 200 : 400,
              headers: { "content-type": "application/json" },
            });
          }
          return new Response("[]", {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        },
      },
    });
    await loadOperatorQueue(bindTenantDatabase(transport, ACCELERATE_TENANT_ID, true));
    const taskReads = requests.filter((url) => url.pathname.endsWith("/tasks"));
    assert.ok(
      taskReads.length > 0 && taskReads.length <= 9,
      "Task selection has a constant query budget",
    );
    assert.ok(
      taskReads.every(
        (url) =>
          url.searchParams.has("limit") &&
          Number(url.searchParams.get("limit")) > 0 &&
          Number(url.searchParams.get("limit")) <= 75,
      ),
    );
    assert.ok(
      taskReads.every((url) => url.searchParams.get("tenant_id") === `eq.${ACCELERATE_TENANT_ID}`),
      "Every task partition retains the caller's tenant scope",
    );
    assert.ok(
      taskReads.every(
        (url) => url.searchParams.get("order") === "due_date.asc,created_at.asc,id.asc",
      ),
    );
    assert.ok(
      taskReads.every((url) =>
        url.searchParams
          .getAll("or")
          .includes("(snoozed_until.is.null,snoozed_until.lte.2026-10-13)"),
      ),
    );
    failPartition = true;
    const scopedTransport = bindTenantDatabase(transport, ACCELERATE_TENANT_ID, true);
    await assert.rejects(loadOperatorQueue(scopedTransport), /Task partition unavailable/);
    const unavailable: string[] = [];
    const degraded = await loadOperatorQueue(scopedTransport, {
      onSourceError: (source) => unavailable.push(source),
    });
    assert.deepEqual(unavailable, ["Tasks"], "One failed partition reports the task source once");
    assert.equal(
      degraded.some((entry) => entry.id.startsWith("task:")),
      false,
      "Partial tasks cannot be reported as a complete ranking",
    );
    failPartition = false;
    duplicatePartition = true;
    await assert.rejects(
      loadOperatorQueue(scopedTransport),
      /Tasks changed during priority selection/,
    );
    duplicatePartition = false;
    assert.deepEqual(
      await loadOperatorQueue(scopedTransport),
      [],
      "A fresh read recovers without changing records",
    );

    const snapshotTool = getRevenueAiTools().find((tool) => tool.name === "get_today_snapshot");
    assert.ok(snapshotTool);
    for (const count of [0, 15, 16, 80]) {
      const mem = new MemorySupabase({
        tenants: [{ id: ACCELERATE_TENANT_ID, status: "active" }],
        tasks: many().slice(0, count),
      });
      const before = JSON.stringify(mem.rows("tasks"));
      const snapshot = (await snapshotTool.execute(
        {
          supabase: bindTenantDatabase(mem.client, ACCELERATE_TENANT_ID, true),
          actorEmail: "fixture@example.test",
        },
        {},
      )) as { queue: OperatorQueueItem[]; truncated: boolean };
      assert.equal(snapshot.queue.length, Math.min(count, 15));
      assert.equal(snapshot.truncated, count > 15, "AI discloses clipped queue items");
      assert.equal(JSON.stringify(mem.rows("tasks")), before);
    }
    const mem = new MemorySupabase({
      tenants: [{ id: ACCELERATE_TENANT_ID, status: "active" }],
      tasks: cases[0]!.rows,
      opportunities: [
        {
          id: "opportunity-1",
          tenant_id: ACCELERATE_TENANT_ID,
          name: "Controlled opportunity",
          stage: "qualified",
          estimated_value: 3000,
          probability: 0.5,
        },
      ],
    });
    const context = {
      supabase: bindTenantDatabase(mem.client, ACCELERATE_TENANT_ID, true),
      actorEmail: "fixture@example.test",
    };
    const before = JSON.stringify({
      tasks: mem.rows("tasks"),
      opportunities: mem.rows("opportunities"),
    });
    const snapshot = (await snapshotTool.execute(context, {})) as {
      queue: OperatorQueueItem[];
      truncated: boolean;
    };
    assert.equal(
      snapshot.queue[0]?.id,
      "task:late-overdue",
      "The actual registered AI tool receives the later-stored overdue task first",
    );
    assert.equal(snapshot.truncated, true);
    assert.equal(
      JSON.stringify({ tasks: mem.rows("tasks"), opportunities: mem.rows("opportunities") }),
      before,
    );
    mem.fail("tasks", { message: "Task source unavailable" });
    await assert.rejects(snapshotTool.execute(context, {}), /Task source unavailable/);
  } finally {
    mock.timers.reset();
  }
}

verifyTaskDeadlines()
  .then(verifyTaskSourceSelection)
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
            "eligible task selection beyond source caps with all canonical tie-breaks",
            "constant bounded PostgREST query shape",
            "failed task partitions remain unavailable rather than a partial ranking",
            "cross-partition record movement requires a fresh read",
            "registered AI snapshot discloses clipped queue items",
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
