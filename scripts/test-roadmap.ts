import assert from "node:assert/strict";
import {
  cardMatchesQuery,
  countRoadmapByStatus,
  DEFAULT_ROADMAP_FILTERS,
  filterRoadmapCards,
  groupRoadmapByStatus,
  parseRoadmapSearchParams,
  roadmapFiltersAreDefault,
  serializeRoadmapSearchParams,
  uniqueRoadmapCategories,
  type PublicRoadmapCard,
} from "../src/lib/roadmap";

function card(overrides: Partial<PublicRoadmapCard> & Pick<PublicRoadmapCard, "seedKey" | "title">): PublicRoadmapCard {
  return {
    description: "A card used by the public roadmap filters.",
    status: "planned",
    priority: "medium",
    category: "operator",
    capabilities: ["admin-ux"],
    acceptance: ["Search finds this card", "Filters hide it when they should"],
    ready: true,
    ...overrides,
  };
}

const cards: PublicRoadmapCard[] = [
  card({
    seedKey: "gmail-incremental-sync",
    title: "Incremental Gmail sync",
    status: "in_progress",
    priority: "high",
    category: "integrations",
    capabilities: ["email"],
    ready: false,
  }),
  card({
    seedKey: "conversations-operator-inbox",
    title: "Conversations operator inbox",
    status: "planned",
    priority: "high",
    category: "operator",
    capabilities: ["email"],
    ready: true,
  }),
  card({
    seedKey: "docs-content-first-pass",
    title: "Write the documentation spine",
    description: "Fill in the Command Center user guide after the coverage gate.",
    status: "backlog",
    priority: "medium",
    category: "productization",
    capabilities: ["documentation"],
    ready: false,
    acceptance: ["Getting started is six pages"],
  }),
  card({
    seedKey: "feature-board-operational",
    title: "Operate the Feature Board",
    status: "shipped",
    priority: "high",
    category: "platform",
    ready: false,
  }),
  card({
    seedKey: "blocked-dep",
    title: "Waiting on a dependency",
    status: "blocked",
    priority: "urgent",
    category: "runtime",
    ready: false,
  }),
];

const active = filterRoadmapCards(cards, DEFAULT_ROADMAP_FILTERS);
assert.deepEqual(
  active.map((item) => item.seedKey),
  ["gmail-incremental-sync", "conversations-operator-inbox", "blocked-dep"],
  "default view is in progress, planned, and blocked",
);

const all = filterRoadmapCards(cards, { ...DEFAULT_ROADMAP_FILTERS, status: "all" });
assert.equal(all.length, 5, "all statuses are reachable");

const shipped = filterRoadmapCards(cards, { ...DEFAULT_ROADMAP_FILTERS, status: "shipped" });
assert.deepEqual(shipped.map((item) => item.seedKey), ["feature-board-operational"]);

const gmail = filterRoadmapCards(cards, { ...DEFAULT_ROADMAP_FILTERS, status: "all", query: "gmail" });
assert.deepEqual(gmail.map((item) => item.seedKey), ["gmail-incremental-sync"]);

const multiTerm = filterRoadmapCards(cards, {
  ...DEFAULT_ROADMAP_FILTERS,
  status: "all",
  query: "command center",
});
assert.deepEqual(multiTerm.map((item) => item.seedKey), ["docs-content-first-pass"]);

const miss = filterRoadmapCards(cards, { ...DEFAULT_ROADMAP_FILTERS, status: "all", query: "gmail zzzzqqq" });
assert.equal(miss.length, 0, "every term must match");

assert.equal(cardMatchesQuery(cards[0]!, "  GMAIL  "), true);
assert.equal(cardMatchesQuery(cards[0]!, "inbox"), false);

const operator = filterRoadmapCards(cards, {
  ...DEFAULT_ROADMAP_FILTERS,
  status: "all",
  category: "operator",
});
assert.deepEqual(operator.map((item) => item.seedKey), ["conversations-operator-inbox"]);

const high = filterRoadmapCards(cards, {
  ...DEFAULT_ROADMAP_FILTERS,
  status: "all",
  priority: "high",
});
assert.equal(high.length, 3);

const ready = filterRoadmapCards(cards, {
  ...DEFAULT_ROADMAP_FILTERS,
  status: "all",
  readyOnly: true,
});
assert.deepEqual(ready.map((item) => item.seedKey), ["conversations-operator-inbox"]);

const counts = countRoadmapByStatus(cards);
assert.equal(counts.all, 5);
assert.equal(counts.active, 3);
assert.equal(counts.shipped, 1);
assert.equal(counts.backlog, 1);

assert.deepEqual(uniqueRoadmapCategories(cards), [
  "integrations",
  "operator",
  "platform",
  "productization",
  "runtime",
]);

assert.deepEqual(
  groupRoadmapByStatus(active).map((group) => group.status),
  ["in_progress", "planned", "blocked"],
);

assert.deepEqual(parseRoadmapSearchParams({}), DEFAULT_ROADMAP_FILTERS);
assert.deepEqual(
  parseRoadmapSearchParams({ q: " gmail ", status: "shipped", category: "integrations", priority: "high", ready: "1" }),
  {
    query: "gmail",
    status: "shipped",
    category: "integrations",
    priority: "high",
    readyOnly: true,
  },
);
assert.equal(parseRoadmapSearchParams({ status: "nope" }).status, "active");
assert.equal(parseRoadmapSearchParams({ priority: "critical" }).priority, null);

const params = new URLSearchParams("q=inbox&status=planned&ready=true");
assert.equal(parseRoadmapSearchParams(params).query, "inbox");
assert.equal(parseRoadmapSearchParams(params).readyOnly, true);

assert.equal(serializeRoadmapSearchParams(DEFAULT_ROADMAP_FILTERS), "");
assert.equal(
  serializeRoadmapSearchParams({
    query: "gmail",
    status: "all",
    category: "integrations",
    priority: "high",
    readyOnly: true,
  }),
  "q=gmail&status=all&category=integrations&priority=high&ready=1",
);
assert.equal(roadmapFiltersAreDefault(DEFAULT_ROADMAP_FILTERS), true);
assert.equal(roadmapFiltersAreDefault({ ...DEFAULT_ROADMAP_FILTERS, query: "x" }), false);

console.log("roadmap filters ok");
