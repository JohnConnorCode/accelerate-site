import assert from "node:assert/strict";
import {
  computeStageHistory,
  resolveFunnelProgress,
  type StageEventInput,
} from "../src/lib/revenue-os/stage-history";
import {
  createDefaultPipelineStageResolver,
  type PipelineStageResolver,
} from "../src/lib/revenue-os/pipeline-stage-resolver";
import { summarizeRevenueAnalytics } from "../src/lib/revenue-os/analytics";

const stages = createDefaultPipelineStageResolver();

// --- Fixture 1: forward progression, no regressions, every event valid ---
const forward: StageEventInput[] = [
  { from_stage: null, to_stage: "new", created_at: "2026-01-01T00:00:00Z" },
  { from_stage: "new", to_stage: "qualified", created_at: "2026-01-02T00:00:00Z" },
  { from_stage: "qualified", to_stage: "meeting", created_at: "2026-01-03T00:00:00Z" },
  { from_stage: "meeting", to_stage: "proposal", created_at: "2026-01-04T00:00:00Z" },
  { from_stage: "proposal", to_stage: "won", created_at: "2026-01-05T00:00:00Z" },
];
const forwardResult = computeStageHistory(forward, "won", stages);
assert.equal(forwardResult.hasHistory, true, "forward: history present");
assert.equal(forwardResult.furthestStageFromHistory, "won", "forward: furthest is won");
assert.deepEqual(
  forwardResult.reachedStages,
  ["new", "qualified", "meeting", "proposal", "won"],
  "forward: every stage recorded in order",
);
assert.equal(forwardResult.regressions.length, 0, "forward: no regressions");
assert.equal(forwardResult.impossibleEvents.length, 0, "forward: no impossible events");
assert.equal(forwardResult.timeInStage.length, 5, "forward: one segment per event");
assert.equal(
  forwardResult.timeInStage[0]!.durationMs,
  86400000,
  "forward: first segment duration is exactly one day",
);
assert.equal(
  forwardResult.timeInStage.at(-1)!.exitedAt,
  null,
  "forward: the final (current) segment has no exit time",
);
const forwardProgress = resolveFunnelProgress(forwardResult, stages);
assert.deepEqual(forwardProgress, { rank: stages.stageKeys.indexOf("won"), source: "history" });

// --- Fixture 2: a backward move is recorded as a regression, and the
// furthest stage reached stays the highest rank ever recorded, not the last. ---
const regressive: StageEventInput[] = [
  { from_stage: null, to_stage: "new", created_at: "2026-02-01T00:00:00Z" },
  { from_stage: "new", to_stage: "qualified", created_at: "2026-02-02T00:00:00Z" },
  { from_stage: "qualified", to_stage: "meeting", created_at: "2026-02-03T00:00:00Z" },
  { from_stage: "meeting", to_stage: "qualified", created_at: "2026-02-04T00:00:00Z" },
  { from_stage: "qualified", to_stage: "proposal", created_at: "2026-02-05T00:00:00Z" },
];
const regressiveResult = computeStageHistory(regressive, "proposal", stages);
assert.equal(regressiveResult.regressions.length, 1, "regression: exactly one backward move");
assert.deepEqual(regressiveResult.regressions[0], {
  from: "meeting",
  to: "qualified",
  at: "2026-02-04T00:00:00Z",
});
assert.equal(
  regressiveResult.furthestStageFromHistory,
  "proposal",
  "regression: furthest reached is proposal, the highest rank ever recorded",
);
assert.equal(regressiveResult.timeInStage.length, 5, "regression: re-entering a stage opens a new segment");

// --- Fixture 3: two events sharing one created_at timestamp are ordered by
// their given (insertion) order, a documented, deterministic tie-break. ---
const sameTime: StageEventInput[] = [
  { from_stage: "new", to_stage: "qualified", created_at: "2026-03-01T00:00:00Z" },
  { from_stage: "qualified", to_stage: "meeting", created_at: "2026-03-01T00:00:00Z" },
];
const sameTimeResult = computeStageHistory(sameTime, "meeting", stages);
assert.equal(sameTimeResult.regressions.length, 0, "same-time: forward order preserved, no regression");
assert.equal(sameTimeResult.furthestStageFromHistory, "meeting", "same-time: furthest is meeting");
assert.equal(sameTimeResult.impossibleEvents.length, 0, "same-time: both events are valid movement");

// --- Fixture 4: a fully custom, tenant-defined stage set (no default stage
// names at all) still ranks correctly by column order, and an unrecognized
// stage value is reported, not silently dropped or guessed at. ---
function customResolver(): PipelineStageResolver {
  const order = ["intro", "demo", "contract", "closed_won", "closed_lost"];
  const roles: Record<string, "open" | "won" | "lost"> = {
    intro: "open",
    demo: "open",
    contract: "open",
    closed_won: "won",
    closed_lost: "lost",
  };
  return {
    stageKeys: order,
    defaultColumnKey: "intro",
    getMeta: (key) =>
      order.includes(key)
        ? { columnKey: key, label: key, probability: 0, role: roles[key]! }
        : null,
    canonicalStage: (raw) => (order.includes(raw) ? raw : null),
    canTransition: (from, to) => order.includes(from) && order.includes(to),
    role: (key) => roles[key] ?? null,
  };
}
const custom = customResolver();
const customEvents: StageEventInput[] = [
  { from_stage: null, to_stage: "intro", created_at: "2026-04-01T00:00:00Z" },
  { from_stage: "intro", to_stage: "demo", created_at: "2026-04-02T00:00:00Z" },
  { from_stage: "demo", to_stage: "contract", created_at: "2026-04-03T00:00:00Z" },
  { from_stage: "contract", to_stage: "closed_won", created_at: "2026-04-04T00:00:00Z" },
  // A stage this tenant no longer has (renamed/removed) — reported, not guessed.
  { from_stage: "closed_won", to_stage: "legacy_stage_that_no_longer_exists", created_at: "2026-04-05T00:00:00Z" },
];
const customResult = computeStageHistory(customEvents, "closed_won", custom);
assert.equal(customResult.furthestStageFromHistory, "closed_won", "custom: ranks by tenant column order");
assert.equal(customResult.impossibleEvents.length, 1, "custom: unrecognized stage is reported");
assert.equal(customResult.impossibleEvents[0]!.reason, "unrecognized_to");
const customWonProgress = resolveFunnelProgress(customResult, custom);
assert.deepEqual(customWonProgress, { rank: custom.stageKeys.indexOf("closed_won"), source: "history" });

// A deal that reached "contract" before it was marked lost still counts as
// having reached contract for funnel purposes — "lost" itself is excluded
// from the open/won progress rank even though its column sits after it.
const lostAfterContract = computeStageHistory(
  [
    { from_stage: null, to_stage: "intro", created_at: "2026-05-01T00:00:00Z" },
    { from_stage: "intro", to_stage: "contract", created_at: "2026-05-02T00:00:00Z" },
    { from_stage: "contract", to_stage: "closed_lost", created_at: "2026-05-03T00:00:00Z" },
  ],
  "closed_lost",
  custom,
);
const lostProgress = resolveFunnelProgress(lostAfterContract, custom);
assert.deepEqual(
  lostProgress,
  { rank: custom.stageKeys.indexOf("contract"), source: "history" },
  "a lost deal's progress rank reflects the furthest OPEN/WON stage it reached, not the terminal loss",
);

// --- Fixture 5: a record with no stage_events at all. History facts stay
// visibly empty/unknown; only the documented current-stage fallback fills
// funnel progress, and only when the current role is open or won. ---
const noHistoryOpen = computeStageHistory([], "proposal", stages);
assert.equal(noHistoryOpen.hasHistory, false);
assert.equal(noHistoryOpen.furthestStageFromHistory, null);
assert.equal(noHistoryOpen.furthestRankFromHistory, null);
assert.deepEqual(noHistoryOpen.reachedStages, []);
assert.deepEqual(noHistoryOpen.timeInStage, []);
assert.equal(noHistoryOpen.lastEventAt, null);
const noHistoryOpenProgress = resolveFunnelProgress(noHistoryOpen, stages);
assert.deepEqual(
  noHistoryOpenProgress,
  { rank: stages.stageKeys.indexOf("proposal"), source: "current_fallback" },
  "missing history for an open record falls back to its current stage, visibly flagged",
);
const noHistoryLost = computeStageHistory([], "lost", stages);
const noHistoryLostProgress = resolveFunnelProgress(noHistoryLost, stages);
assert.deepEqual(
  noHistoryLostProgress,
  { rank: null, source: "unknown" },
  "missing history for a terminal-lost record has no progress rank to report",
);

console.log("computeStageHistory / resolveFunnelProgress fixtures passed.");

// --- Integration: summarizeRevenueAnalytics wires the above into the
// funnel/quality response, per opportunity, without a second stage_events
// query and without ever letting the funnel silently trust current stage
// when real history disagrees. ---
type Opp = {
  id: string;
  stage: string;
  source: string | null;
  source_detail: string | null;
  campaign_id: string | null;
  owner_email: string | null;
  next_action: string | null;
  next_action_at: string | null;
  estimated_value: number;
  won_value: number;
  probability: number;
  created_at: string;
};

const baseOpp = (overrides: Partial<Opp> & { id: string; stage: string }): Opp => ({
  source: "website",
  source_detail: null,
  campaign_id: null,
  owner_email: "founder@example.com",
  next_action: "Follow up",
  next_action_at: "2026-06-01T00:00:00Z",
  estimated_value: 10000,
  won_value: 0,
  probability: 50,
  created_at: "2026-05-20T00:00:00Z",
  ...overrides,
});

const opportunities: Opp[] = [
  // Reached proposal, then lost — current stage alone would hide this from
  // the "proposals reached" bucket; recorded history should not.
  baseOpp({ id: "lost-after-proposal", stage: "lost", probability: 0 }),
  // No stage_events at all — current-stage fallback should still count it
  // as reached-qualified (its own current stage), and the missing-history
  // signal should be visible in quality.
  baseOpp({ id: "no-history-open", stage: "qualified" }),
  // Won with a clean forward history.
  baseOpp({ id: "won-clean", stage: "won", won_value: 9000, probability: 100 }),
];

const eventsByOpportunity = new Map<string, StageEventInput[]>([
  [
    "lost-after-proposal",
    [
      { from_stage: null, to_stage: "new", created_at: "2026-05-20T00:00:00Z" },
      { from_stage: "new", to_stage: "qualified", created_at: "2026-05-21T00:00:00Z" },
      { from_stage: "qualified", to_stage: "proposal", created_at: "2026-05-22T00:00:00Z" },
      { from_stage: "proposal", to_stage: "lost", created_at: "2026-05-23T00:00:00Z" },
    ],
  ],
  [
    "won-clean",
    [
      { from_stage: null, to_stage: "new", created_at: "2026-05-20T00:00:00Z" },
      { from_stage: "new", to_stage: "won", created_at: "2026-05-21T00:00:00Z" },
    ],
  ],
  // "no-history-open" intentionally has no entry in this map.
]);

const withHistory = summarizeRevenueAnalytics(
  opportunities,
  { days: 60 },
  stages,
  eventsByOpportunity,
);
assert.equal(
  withHistory.funnel.proposals,
  2,
  "lost-after-proposal (via history) and won-clean (via history) both reached proposal",
);
assert.equal(
  withHistory.funnel.qualified,
  3,
  "every opportunity reached qualified: two via recorded history, one via the current-stage fallback",
);
assert.equal(withHistory.funnel.won, 1, "won is current-stage/role based, unchanged");
assert.equal(withHistory.quality.stageHistory.missingHistory, 1, "exactly one record has no stage_events");
assert.equal(withHistory.quality.stageHistory.withHistory, 2);
assert.equal(withHistory.quality.stageHistory.regressions, 0);

// Without any stage_events supplied at all (e.g. a degraded stage_events
// read), the module degrades to the documented current-stage fallback for
// every record — it never throws and never fabricates history.
const withoutHistory = summarizeRevenueAnalytics(opportunities, { days: 60 }, stages);
assert.equal(
  withoutHistory.funnel.proposals,
  1,
  "without recorded history, the currently-lost record cannot be credited with reaching proposal " +
    "(only won-clean's current-stage fallback still counts)",
);
assert.equal(withoutHistory.quality.stageHistory.missingHistory, 3);

console.log("summarizeRevenueAnalytics stage-history integration passed.");
