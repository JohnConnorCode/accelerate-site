import "server-only";
import type { PipelineStageResolver } from "./pipeline-stage-resolver";

/**
 * Canonical stage-history computation, shared by every reader that needs
 * "furthest stage reached", "time in stage", "regression", or "impossible
 * sequence" facts — Analytics, the Today overview, the Pipeline board, and
 * (once the AI tool layer carries a per-request tenant id) the assistant.
 *
 * Hard rule: this module never invents a `stage_events` row and never lets
 * the live `opportunities.stage` column silently stand in for recorded
 * history. Every derived fact traces back to an actual event, or the result
 * says explicitly that no history exists.
 */

export interface StageEventInput {
  from_stage: string | null;
  to_stage: string;
  created_at: string;
}

export interface StageSegment {
  /** Canonical column_key the opportunity occupied for this segment. */
  stage: string;
  enteredAt: string;
  /** Null while the opportunity is still in this stage (no later event). */
  exitedAt: string | null;
  /** Null when `exitedAt` is null — an open segment has no final duration,
   * only elapsed time so far, which callers can derive from `enteredAt`. */
  durationMs: number | null;
}

export interface StageRegression {
  from: string;
  to: string;
  at: string;
}

export interface ImpossibleStageEvent {
  fromStage: string | null;
  toStage: string;
  at: string;
  reason: "unrecognized_from" | "unrecognized_to" | "no_movement";
}

export interface StageHistoryResult {
  /** Always the live record's current stage — reporting for "where is this
   * opportunity right now" never derives from stage_events. Null only when
   * the stored value matches no stage the tenant currently recognizes. */
  currentStage: string | null;
  /** True when at least one usable stage_events row exists for this record. */
  hasHistory: boolean;
  /** The highest-ranked canonical stage any recorded event actually reached.
   * Null when there is no usable history — never backfilled from
   * `currentStage`, so a caller can tell "reached nothing recorded" apart
   * from "reached this specific stage". */
  furthestStageFromHistory: string | null;
  furthestRankFromHistory: number | null;
  /** Every canonical stage a recorded event actually reached, in first-seen order. */
  reachedStages: string[];
  timeInStage: StageSegment[];
  regressions: StageRegression[];
  impossibleEvents: ImpossibleStageEvent[];
  lastEventAt: string | null;
}

/**
 * Walks one opportunity's stage_events in time order and derives history
 * facts purely from those rows. `asOf` only affects the still-open final
 * segment's elapsed duration; it never changes which stages were reached.
 */
export function computeStageHistory(
  events: StageEventInput[],
  currentStageRaw: string,
  stages: PipelineStageResolver,
  asOf: Date = new Date(),
): StageHistoryResult {
  const currentStage = stages.canonicalStage(currentStageRaw);
  const rankOf = (key: string) => stages.stageKeys.indexOf(key);

  // Array.sort is stable in the JS engines this runs on (Node/V8), so
  // same-timestamp events keep the order the caller supplied them in —
  // typically insertion/id order from the query, which is the best
  // available tie-break when two events share a created_at value.
  const ordered = [...events].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));

  const reached = new Map<string, number>();
  const regressions: StageRegression[] = [];
  const impossibleEvents: ImpossibleStageEvent[] = [];
  const timeInStage: StageSegment[] = [];

  let previousCanonicalTo: string | null = null;
  let previousRank = -1;
  let segmentStage: string | null = null;
  let segmentEnteredAt: string | null = null;

  for (const event of ordered) {
    const fromCanonical = event.from_stage ? stages.canonicalStage(event.from_stage) : null;
    const toCanonical = stages.canonicalStage(event.to_stage);

    if (!toCanonical) {
      impossibleEvents.push({
        fromStage: event.from_stage,
        toStage: event.to_stage,
        at: event.created_at,
        reason: "unrecognized_to",
      });
      continue;
    }
    if (event.from_stage && !fromCanonical) {
      impossibleEvents.push({
        fromStage: event.from_stage,
        toStage: event.to_stage,
        at: event.created_at,
        reason: "unrecognized_from",
      });
      // The destination is still valid, so keep processing this event below.
    }
    if (fromCanonical && fromCanonical === toCanonical) {
      impossibleEvents.push({
        fromStage: event.from_stage,
        toStage: event.to_stage,
        at: event.created_at,
        reason: "no_movement",
      });
      continue;
    }

    if (segmentStage && segmentEnteredAt) {
      timeInStage.push({
        stage: segmentStage,
        enteredAt: segmentEnteredAt,
        exitedAt: event.created_at,
        durationMs: Date.parse(event.created_at) - Date.parse(segmentEnteredAt),
      });
    }
    segmentStage = toCanonical;
    segmentEnteredAt = event.created_at;

    const toRank = rankOf(toCanonical);
    if (previousCanonicalTo && toRank < previousRank) {
      regressions.push({ from: previousCanonicalTo, to: toCanonical, at: event.created_at });
    }
    previousCanonicalTo = toCanonical;
    previousRank = toRank;

    if (!reached.has(toCanonical)) reached.set(toCanonical, toRank);
  }

  if (segmentStage && segmentEnteredAt) {
    timeInStage.push({
      stage: segmentStage,
      enteredAt: segmentEnteredAt,
      exitedAt: null,
      durationMs: null,
    });
  }

  let furthestStageFromHistory: string | null = null;
  let furthestRankFromHistory: number | null = null;
  for (const [stage, rank] of reached) {
    if (furthestRankFromHistory === null || rank > furthestRankFromHistory) {
      furthestRankFromHistory = rank;
      furthestStageFromHistory = stage;
    }
  }

  void asOf; // Reserved for callers that want "elapsed so far" on the open segment.

  return {
    currentStage,
    hasHistory: ordered.length > 0,
    furthestStageFromHistory,
    furthestRankFromHistory,
    reachedStages: [...reached.keys()],
    timeInStage,
    regressions,
    impossibleEvents,
    lastEventAt: ordered.length ? ordered[ordered.length - 1]!.created_at : null,
  };
}

export interface FunnelProgress {
  /** Rank (index into the tenant's ordered stage columns) of the furthest
   * open/won stage this opportunity is known to have reached. */
  rank: number | null;
  /** "history" — derived from a recorded open/won stage_events row.
   * "current_fallback" — no usable history exists at all, so the live
   * current stage stood in, visibly flagged as a fallback, never silently.
   * "unknown" — neither history nor an open/won current stage is available. */
  source: "history" | "current_fallback" | "unknown";
}

/**
 * The funnel-progression rank used for "how far did this opportunity get"
 * counting (qualified / meeting / proposal / won buckets). Terminal "lost"
 * or other non-progression terminal stages (e.g. "nurture") are excluded
 * from the reached set even though they may rank higher in the column
 * order, because reaching "lost" is not funnel progress — the highest
 * open/won stage actually recorded before that is.
 */
export function resolveFunnelProgress(
  history: StageHistoryResult,
  stages: PipelineStageResolver,
): FunnelProgress {
  const openWonRanks = history.reachedStages
    .filter((stage) => {
      const role = stages.role(stage);
      return role === "open" || role === "won";
    })
    .map((stage) => stages.stageKeys.indexOf(stage));
  if (openWonRanks.length) return { rank: Math.max(...openWonRanks), source: "history" };

  if (!history.hasHistory && history.currentStage) {
    const role = stages.role(history.currentStage);
    if (role === "open" || role === "won") {
      return { rank: stages.stageKeys.indexOf(history.currentStage), source: "current_fallback" };
    }
  }
  return { rank: null, source: "unknown" };
}
