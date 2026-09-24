import assert from "node:assert/strict";
import {
  normalizeWorkflowPreference,
  readWorkflowPreference,
  workflowCalendarDays,
  workflowDateKey,
  workflowDayKey,
  writeWorkflowPreference,
  type WorkflowViewDescriptor,
} from "../src/lib/admin/workflow-views";

process.env.TZ = "America/Los_Angeles";

const descriptor: WorkflowViewDescriptor<{ id: string }> = {
  id: "test",
  label: "Test",
  layouts: ["list", "board", "calendar"],
  fields: [
    { id: "title", label: "Title" },
    { id: "due", label: "Due" },
  ],
  groupBy: { label: "Status", values: [{ id: "open", label: "Open" }] },
  sortBy: [{ id: "due", label: "Due" }],
  filters: [{ id: "owner", label: "Owner" }],
  title: ({ id }) => id,
  dueDate: () => null,
  status: () => "open",
};

assert.equal(
  workflowDateKey("2026-01-01"),
  "2026-01-01",
  "date-only values do not shift by timezone",
);
assert.equal(workflowDateKey("2026-02-30"), null, "invalid date-only values are unscheduled");
assert.equal(
  workflowDateKey("2026-01-01T01:00:00.000Z"),
  "2025-12-31",
  "instants display on the viewer's local day",
);
assert.equal(workflowDateKey("not-a-date"), null);

const days = workflowCalendarDays(new Date(2026, 5, 15));
assert.ok(days.length === 35 || days.length === 42);
assert.equal(
  days[0]?.getDay(),
  0,
  "month grid begins Sunday for the locale-neutral shared calendar",
);
const firstDay = days[0]!;
assert.equal(
  workflowDayKey(firstDay),
  [
    firstDay.getFullYear(),
    String(firstDay.getMonth() + 1).padStart(2, "0"),
    String(firstDay.getDate()).padStart(2, "0"),
  ].join("-"),
);

assert.deepEqual(
  normalizeWorkflowPreference(
    {
      layout: "timeline",
      visibleFields: ["due", "unknown"],
      filters: { owner: "mine", private: "ignored" },
    },
    descriptor,
  ),
  { layout: "list", visibleFields: ["due"], filters: { owner: "mine" } },
  "unknown layouts, fields, and filters fall back to the descriptor contract",
);
assert.deepEqual(
  normalizeWorkflowPreference({ visibleFields: [] }, descriptor),
  { layout: "list", visibleFields: ["title", "due"] },
  "malformed empty field selections restore the useful default",
);

const saved = new Map<string, string>();
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    localStorage: {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => saved.set(key, value),
    },
  },
});
writeWorkflowPreference("tenant-a:user-a", descriptor, {
  layout: "calendar",
  visibleFields: ["due"],
  filters: { owner: "mine" },
});
assert.deepEqual(readWorkflowPreference("tenant-a:user-a", descriptor), {
  layout: "calendar",
  visibleFields: ["due"],
  filters: { owner: "mine" },
});
assert.deepEqual(
  readWorkflowPreference("tenant-b:user-a", descriptor),
  { layout: "list", visibleFields: ["title", "due"] },
  "another workspace cannot read this member's stored view",
);
assert.deepEqual(
  readWorkflowPreference("tenant-a:user-b", descriptor),
  { layout: "list", visibleFields: ["title", "due"] },
  "another member cannot read this workspace view",
);

console.log(
  "Workflow view contracts passed: safe preferences, date-only boundaries, local timestamps, and calendar grids.",
);
