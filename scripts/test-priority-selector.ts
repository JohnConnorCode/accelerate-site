#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { operatorTaskRecordHref, sortOperatorQueue, summarizeOperatorQueue, validateOperatorQueue } from "../src/lib/revenue-os/queue";
import type { OperatorQueueItem } from "../src/lib/revenue-os/types";

function item(overrides: Partial<OperatorQueueItem> & Pick<OperatorQueueItem, "id" | "kind">): OperatorQueueItem {
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
  item({ id: "earlier-b", kind: "task", urgency: "high", dueAt: "2026-08-23", sourceTimestamp: "2026-08-23T11:00:00.000Z" }),
  item({ id: "earlier-a", kind: "task", urgency: "high", dueAt: "2026-08-23", sourceTimestamp: "2026-08-23T11:00:00.000Z" }),
  item({ id: "critical", kind: "system", urgency: "critical", dueAt: "2026-08-25" }),
]);

assert.deepEqual(ranked.map((entry) => entry.id), ["critical", "earlier-a", "earlier-b", "later", "normal"], "urgency, deadline, source time, and stable ID tie-break must fully determine rank");
for (const entry of ranked) {
  assert.ok(entry.priorityReason, `${entry.id} must explain why it is ranked`);
  assert.ok(entry.sourceTimestamp, `${entry.id} must expose its source timestamp`);
  assert.ok(entry.recommendedNextAction, `${entry.id} must expose a recommended next action`);
}
assert.doesNotThrow(() => validateOperatorQueue(ranked));
assert.throws(() => validateOperatorQueue([item({ id: "missing-next", kind: "task", recommendedNextAction: "" })]), /does not satisfy/, "the selector must refuse an item that cannot tell the operator what to do next");

assert.deepEqual(summarizeOperatorQueue(ranked), {
  total: 5,
  urgent: 4,
  critical: 1,
  byKind: { reply: 1, approval: 0, task: 3, follow_up: 0, meeting: 0, proposal: 0, system: 1 },
});

assert.equal(operatorTaskRecordHref({ related_type: "proposal", related_id: "p-1", opportunity_id: null }), "/admin/proposals?proposal=p-1");
assert.equal(operatorTaskRecordHref({ related_type: "client", related_id: "c-1", opportunity_id: null }), "/admin/clients/c-1");
assert.equal(operatorTaskRecordHref({ related_type: "contact", related_id: "person-1", opportunity_id: null }), "/admin/contacts?contact=person-1");
assert.equal(operatorTaskRecordHref({ related_type: "campaign", related_id: "campaign-1", opportunity_id: null }), "/admin/campaigns?campaign=campaign-1");
assert.equal(operatorTaskRecordHref({ related_type: "lead", related_id: "lead-1", opportunity_id: "opp-1" }), "/admin/pipeline/opp-1", "a canonical opportunity must win over a legacy related type");

const overview = readFileSync("src/app/api/admin/revenue-os/overview/route.ts", "utf8");
const priorityRoute = readFileSync("src/app/api/admin/revenue-os/priority/route.ts", "utf8");
const notifications = readFileSync("src/app/api/admin/notifications/route.ts", "utf8");
const aiTools = readFileSync("src/lib/revenue-os/ai-tools.ts", "utf8");
const layout = readFileSync("src/app/admin/layout.tsx", "utf8");
for (const [consumer, source] of Object.entries({ overview, priorityRoute, notifications, aiTools })) {
  assert.match(source, /loadOperatorQueue/, `${consumer} must consume the canonical priority selector`);
}
assert.match(layout, /\/api\/admin\/revenue-os\/priority/, "navigation counters must read the canonical selector endpoint");
assert.match(layout, /admin:priority-refresh/, "mutations must be able to refresh navigation priority state immediately");

console.log(JSON.stringify({
  result: "passed",
  checks: ["deterministic rank", "stable ID tie-break", "required explanation fields", "record-safe task links", "shared summary", "Today API consumer", "navigation consumer", "AI consumer", "notification consumer"],
}, null, 2));
