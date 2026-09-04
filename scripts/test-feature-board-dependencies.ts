import assert from "node:assert/strict";
import {
  collectFeatureBoardIntegrityFailures,
  findCircularDependencies,
  findForwardMilestoneViolations,
  findLoopOrderViolations,
} from "./lib/feature-board-graph.mjs";
import {
  featureBacklog,
  LOOP_ONE,
  NOW_KEYS,
  SECOND_BRAIN_IMPLEMENTATIONS,
  validateFeatureBacklog,
} from "./feature-backlog-data.mjs";

function card(overrides: Record<string, unknown>) {
  return {
    seed_key: "alpha",
    title: "Alpha",
    status: "planned",
    owner: null,
    labels: ["milestone:next"],
    notes: "Dependencies: None. This can be claimed immediately.\n\nBoard milestone: Next.",
    ...overrides,
  };
}

const missing = collectFeatureBoardIntegrityFailures(
  [
    card({
      seed_key: "alpha",
      title: "Alpha",
      notes: "Dependencies: Missing Title\n\nBoard milestone: Next.",
    }),
  ],
  { loopKeys: ["alpha"], nowKeys: ["alpha"], secondBrainImplementations: {} },
);
assert.match(missing.failures.join("\n"), /depends on "Missing Title"/);

const circular = findCircularDependencies(
  new Map([
    ["a", ["b"]],
    ["b", ["a"]],
  ]),
);
assert.deepEqual(circular[0], ["a", "b", "a"]);

const forward = findForwardMilestoneViolations(
  [
    card({
      seed_key: "now-card",
      labels: ["milestone:now"],
      notes: "Dependencies: Later Card.\n\nBoard milestone: Now.",
    }),
    card({
      seed_key: "later-card",
      title: "Later Card",
      labels: ["milestone:later"],
      notes: "Dependencies: None.\n\nBoard milestone: Later.",
    }),
  ],
  new Map([
    ["now-card", ["later-card"]],
    ["later-card", []],
  ]),
);
assert.equal(forward[0]?.to, "later-card");

const order = findLoopOrderViolations(
  ["later", "earlier"],
  new Map([
    ["later", ["earlier"]],
    ["earlier", []],
  ]),
);
assert.equal(order[0]?.from, "later");

const active = collectFeatureBoardIntegrityFailures(
  [
    card({
      seed_key: "active",
      status: "in_progress",
      owner: "Grok",
      labels: ["milestone:now"],
      notes:
        "Dependencies: Unshipped\n\nBoard milestone: Now.\n\nCurrent implementation evidence: parked.",
    }),
    card({
      seed_key: "unshipped",
      title: "Unshipped",
      status: "planned",
      labels: ["milestone:now"],
      notes: "Dependencies: None.\n\nBoard milestone: Now.",
    }),
  ],
  { loopKeys: ["unshipped", "active"], nowKeys: ["active"], secondBrainImplementations: {} },
);
assert.match(active.warnings.join("\n"), /is in progress but depends on unsatisfied \[unshipped\]/);

const rollup = collectFeatureBoardIntegrityFailures(
  [
    card({ seed_key: "second-brain-see", notes: "Dependencies: None.\n\nBoard milestone: Next." }),
    card({
      seed_key: "founder-note-capture",
      title: "Give the founder's own knowledge a way in",
      notes: "Dependencies: None.\n\nBoard milestone: Next.",
    }),
  ],
  {
    loopKeys: ["second-brain-see"],
    nowKeys: [],
    secondBrainImplementations: { "second-brain-see": ["founder-note-capture"] },
  },
);
assert.match(rollup.failures.join("\n"), /roll-up is missing founder-note-capture/);

const summary = validateFeatureBacklog();
assert.equal(summary.total, featureBacklog.length);
const live = collectFeatureBoardIntegrityFailures(featureBacklog, {
  loopKeys: LOOP_ONE,
  nowKeys: NOW_KEYS,
  secondBrainImplementations: SECOND_BRAIN_IMPLEMENTATIONS,
});
assert.deepEqual(live.failures, [], live.failures.join("\n"));
// Active-dependency violations are live coordination state (another card's
// currently-valid claim elsewhere on the board), not a structural manifest
// defect — surfaced, never asserted empty, since a concurrent agent can put
// this board into that state at any moment for reasons this test can't see.
if (live.warnings.length) {
  console.warn(`warning: ${live.warnings.length} active-dependency violation(s) on the live board:`);
  for (const warning of live.warnings) console.warn(`  - ${warning}`);
}
assert.ok(NOW_KEYS.every((key: string) => LOOP_ONE.includes(key)));
for (const [key, implementations] of Object.entries(SECOND_BRAIN_IMPLEMENTATIONS)) {
  const phase = featureBacklog.find((item: { seed_key: string }) => item.seed_key === key);
  assert.ok(phase, `missing roll-up ${key}`);
  for (const implementation of implementations as string[]) {
    assert.match(phase.notes, new RegExp(`card:${implementation}`));
  }
}

console.log(
  JSON.stringify(
    {
      result: "passed",
      cards: featureBacklog.length,
      loop: LOOP_ONE.length,
      now: NOW_KEYS,
      fixtures: [
        "missing",
        "circular",
        "forward-milestone",
        "loop-order",
        "active-unmet",
        "second-brain-rollup",
      ],
    },
    null,
    2,
  ),
);
