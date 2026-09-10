import assert from "node:assert/strict";
import {
  defaultTodayViews,
  emptyTodayDocument,
  defaultTodayView,
  todayDocumentSchema,
  todaySaveSchema,
  filterTodayItems,
  newTodayModule,
  attentionFingerprint,
  attentionKey,
} from "../src/lib/admin/today-workspace";
import { projectOperatorAttention } from "../src/lib/revenue-os/operator-attention";
import { todayEvidence, todayFacts, validateTodayBrief } from "../src/lib/admin/today-data";
import { toOpenRouterTools } from "../src/lib/revenue-os/ai-tools";
const now = new Date("2026-09-09T12:00:00Z");
const source = projectOperatorAttention([
  {
    id: "task:one",
    title: "Prepare proposal",
    summary: "Review the request",
    kind: "task",
    urgency: "normal",
    sourceTimestamp: now.toISOString(),
    dueAt: "2026-09-09",
    priorityReason: "Due today",
    recommendedNextAction: "Review proposal",
    href: "/admin/work",
  },
  {
    id: "proposal:two",
    title: "Proposal expires",
    summary: "Customer has not replied",
    kind: "proposal",
    urgency: "high",
    sourceTimestamp: now.toISOString(),
    dueAt: "2026-09-15",
    priorityReason: "Expiry approaching",
    recommendedNextAction: "Review activity",
    href: "/admin/proposals",
  },
]);
const doc = emptyTodayDocument();
assert.equal(defaultTodayViews().workspace.document.views[0]?.name, "Business overview");
assert.equal(todayDocumentSchema.safeParse({ ...doc, rawCode: "<script>" }).success, false);
assert.equal(
  todayDocumentSchema.safeParse({
    ...doc,
    views: Array.from({ length: 13 }, () => defaultTodayView()),
  }).success,
  false,
);
assert.equal(
  todaySaveSchema.safeParse({
    scope: "someone-else",
    revision: 0,
    requestId: crypto.randomUUID(),
    document: doc,
  }).success,
  false,
);
assert.equal(
  defaultTodayView({ order: [], hidden: ["operating-summary"] }).modules.some(
    (m) => m.type === "metrics",
  ),
  false,
);
const attentionModule = newTodayModule("attention");
assert.equal(
  filterTodayItems(source, { ...attentionModule, horizon: "today" }, doc, now).length,
  1,
);
assert.equal(
  filterTodayItems(source, { ...attentionModule, source: "proposal" }, doc, now)[0]?.sourceId,
  "two",
);
const pin = { ...doc, pins: [attentionKey(source[1]!)] };
assert.equal(filterTodayItems(source, attentionModule, pin, now)[0]?.sourceId, "two");
const muted = {
  ...doc,
  muted: [{ key: attentionKey(source[1]!), fingerprint: attentionFingerprint(source[1]!) }],
};
assert.equal(filterTodayItems(source, attentionModule, muted, now).length, 1);
const changed = source.map((s) => ({ ...s, sourceTimestamp: "2026-09-10T12:00:00Z" }));
assert.equal(filterTodayItems(changed, attentionModule, muted, now).length, 2);
assert.equal(source[1]?.sourceId, "two"); // no source mutation
const facts = todayFacts(source, []);
assert.ok(facts.every((f) => f.sourceId && f.href.startsWith("/admin/")));
const brief = {
  version: 1,
  generatedAt: now.toISOString(),
  sourceIds: [facts[0]!.id],
  interpretations: [
    {
      title: "Prepare ahead",
      explanation: "Review the context before the deadline.",
      sourceIds: [facts[0]!.id],
    },
  ],
};
Object.assign(brief, { sourceEvidence: todayEvidence(facts) });
assert.ok(validateTodayBrief(brief, facts));
assert.equal(
  validateTodayBrief(
    brief,
    facts.map((f) => ({ ...f, detail: "Changed evidence" })),
  ),
  null,
);
assert.equal(validateTodayBrief({ ...brief, sourceIds: ["invented"] }, facts), null);
assert.equal(
  validateTodayBrief(
    { ...brief, interpretations: [{ ...brief.interpretations[0], sourceIds: [] }] },
    facts,
  ),
  null,
);
for (const name of [
  "get_today_workspace",
  "get_today_views",
  "preview_today_view_change",
  "propose_today_view_change",
])
  for (const pack of ["core", "pipeline", "outreach"] as const)
    assert.ok(toOpenRouterTools(pack).some((t) => t.function.name === name));
console.log(
  "Today contracts: validation, migration defaults, filters, pins, changed-evidence resurfacing, brief provenance and AI discovery passed.",
);
