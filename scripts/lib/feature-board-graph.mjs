const NO_DEPENDENCY_SENTINEL = "None";
const MILESTONE_RANK = { now: 0, next: 1, later: 2, done: 3 };

export function milestoneOf(card) {
  return (
    card.labels.find((label) => label.startsWith("milestone:"))?.slice("milestone:".length) ?? null
  );
}

export function parseDependencyTitles(card) {
  const line = String(card.notes || "")
    .split("\n\n")
    .find((section) => section.startsWith("Dependencies: "));
  if (!line) return [];
  const declared = line.slice("Dependencies: ".length).trim();
  if (!declared || declared.startsWith(NO_DEPENDENCY_SENTINEL)) return [];
  return declared
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildDependencyGraph(cards) {
  const byTitle = new Map(cards.map((card) => [card.title, card]));
  const byKey = new Map(cards.map((card) => [card.seed_key, card]));
  const edges = new Map();
  const missing = [];
  for (const card of cards) {
    const depKeys = [];
    for (const title of parseDependencyTitles(card)) {
      const dependency = byTitle.get(title);
      if (!dependency) missing.push({ from: card.seed_key, title });
      else depKeys.push(dependency.seed_key);
    }
    edges.set(card.seed_key, depKeys);
  }
  return { byKey, byTitle, edges, missing };
}

export function findCircularDependencies(edges) {
  const cycles = [];
  const visiting = new Set();
  const visited = new Set();

  function walk(key, stack) {
    if (visiting.has(key)) {
      cycles.push([...stack.slice(stack.indexOf(key)), key]);
      return;
    }
    if (visited.has(key)) return;
    visiting.add(key);
    stack.push(key);
    for (const next of edges.get(key) ?? []) walk(next, stack);
    stack.pop();
    visiting.delete(key);
    visited.add(key);
  }

  for (const key of edges.keys()) walk(key, []);
  return [...new Map(cycles.map((cycle) => [cycle.join(" -> "), cycle])).values()];
}

export function findForwardMilestoneViolations(cards, edges) {
  const byKey = new Map(cards.map((card) => [card.seed_key, card]));
  const violations = [];
  for (const card of cards) {
    if (card.status === "shipped") continue;
    const from = milestoneOf(card);
    for (const depKey of edges.get(card.seed_key) ?? []) {
      const dependency = byKey.get(depKey);
      if (!dependency || dependency.status === "shipped") continue;
      const to = milestoneOf(dependency);
      if (MILESTONE_RANK[from] < MILESTONE_RANK[to]) {
        violations.push({ from: card.seed_key, fromMilestone: from, to: depKey, toMilestone: to });
      }
    }
  }
  return violations;
}

export function findLoopOrderViolations(loopKeys, edges) {
  const index = new Map(loopKeys.map((key, position) => [key, position]));
  const violations = [];
  for (const [key, depKeys] of edges) {
    const position = index.get(key);
    if (position == null) continue;
    for (const depKey of depKeys) {
      const depPosition = index.get(depKey);
      if (depPosition == null) continue;
      if (depPosition >= position)
        violations.push({ from: key, to: depKey, fromIndex: position, toIndex: depPosition });
    }
  }
  return violations;
}

export function findActiveDependencyViolations(cards, edges) {
  const byKey = new Map(cards.map((card) => [card.seed_key, card]));
  const violations = [];
  for (const card of cards.filter((item) => item.status === "in_progress")) {
    for (const depKey of edges.get(card.seed_key) ?? []) {
      const dependency = byKey.get(depKey);
      if (!dependency || dependency.status !== "shipped") {
        violations.push({
          from: card.seed_key,
          to: depKey,
          status: dependency?.status ?? "missing",
        });
      }
    }
  }
  return violations;
}

export function findMilestoneNoteMismatches(cards) {
  return cards.flatMap((card) => {
    const label = milestoneOf(card);
    const note = String(card.notes || "")
      .match(/Board milestone: (Now|Next|Later|Done)/)?.[1]
      ?.toLowerCase();
    if (!label || !note || label === note) return [];
    return [{ key: card.seed_key, label, note }];
  });
}

export function findSecondBrainRollupGaps(cards, requiredImplementations) {
  const byKey = new Map(cards.map((card) => [card.seed_key, card]));
  const gaps = [];
  for (const [key, implementationKeys] of Object.entries(requiredImplementations)) {
    const card = byKey.get(key);
    if (!card) {
      gaps.push({ key, missing: "roll-up card" });
      continue;
    }
    for (const implementationKey of implementationKeys) {
      if (!byKey.has(implementationKey))
        gaps.push({
          key,
          missing: implementationKey,
          reason: "implementation card does not exist",
        });
      else if (!card.notes.includes(`card:${implementationKey}`)) {
        gaps.push({
          key,
          missing: implementationKey,
          reason: "roll-up notes do not name the implementation card",
        });
      }
    }
  }
  return gaps;
}

// A board that cannot dispatch is a broken board: if zero dependency-ready
// backlog/planned cards carry milestone:now|next, an agent asking "what
// should I work on?" gets no legal answer even when startable work exists.
export function findDispatchDeadlock(cards) {
  const graph = buildDependencyGraph(cards);
  const claimable = cards.filter((c) => c.status === "backlog" || c.status === "planned");
  const ready = claimable.filter((c) => {
    const deps = graph.edges.get(c.seed_key) ?? [];
    return deps.every((depKey) => graph.byKey.get(depKey)?.status === "shipped");
  });
  const dispatchable = ready.filter((c) => {
    const m = milestoneOf(c);
    return m === "now" || m === "next";
  });
  if (ready.length > 0 && dispatchable.length === 0) {
    return [
      `Dispatch deadlock: ${ready.length} dependency-ready backlog/planned card(s) exist but none carry milestone:now or milestone:next.`,
    ];
  }
  return [];
}

export function collectFeatureBoardIntegrityFailures(
  cards,
  { loopKeys, nowKeys, secondBrainImplementations },
) {
  const failures = [];
  const graph = buildDependencyGraph(cards);

  for (const item of graph.missing) {
    failures.push(`[${item.from}] depends on "${item.title}", which matches no card title`);
  }
  for (const cycle of findCircularDependencies(graph.edges)) {
    failures.push(`Circular Feature Board dependency: ${cycle.join(" -> ")}`);
  }
  for (const item of findForwardMilestoneViolations(cards, graph.edges)) {
    failures.push(
      `[${item.from}] milestone:${item.fromMilestone} depends on later [${item.to}] milestone:${item.toMilestone}`,
    );
  }
  for (const item of findLoopOrderViolations(loopKeys, graph.edges)) {
    failures.push(
      `[${item.from}] delivery-circuit step ${item.fromIndex + 1} depends on later circuit card [${item.to}] step ${item.toIndex + 1}`,
    );
  }
  for (const item of findActiveDependencyViolations(cards, graph.edges)) {
    failures.push(
      `[${item.from}] is in progress but depends on unsatisfied [${item.to}] (${item.status})`,
    );
  }
  for (const card of cards.filter((item) => item.status === "in_progress")) {
    // Evidence is proof of completion; a card just claimed through the live
    // claim RPC has none yet and that's expected — verify-agent-contract.mjs
    // enforces evidence at shipped, not here.
    if (!card.owner?.trim()) failures.push(`[${card.seed_key}] is in progress without an Owner`);
  }
  for (const item of findMilestoneNoteMismatches(cards)) {
    failures.push(
      `[${item.key}] milestone label ${item.label} does not match notes (${item.note})`,
    );
  }
  for (const key of nowKeys) {
    if (!loopKeys.includes(key))
      failures.push(`NOW_KEYS includes ${key}, which is not on the delivery circuit`);
  }
  if (nowKeys.length > 4)
    failures.push(`NOW_KEYS has ${nowKeys.length} cards; keep Now small enough to scan`);
  for (const item of findSecondBrainRollupGaps(cards, secondBrainImplementations)) {
    failures.push(
      `[${item.key}] roll-up is missing ${item.missing}${item.reason ? ` (${item.reason})` : ""}`,
    );
  }
  failures.push(...findDispatchDeadlock(cards));
  return failures;
}
