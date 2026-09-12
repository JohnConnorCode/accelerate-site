import "server-only";
import type { PipelineStageResolver } from "./pipeline-stage-resolver";

/**
 * Canonical stage-history computation, shared by every reader that needs
 * "furthest stage reached", "time in stage", "regression", or "impossible
 * sequence" facts — Analytics, the Today overview, the Pipeline board, and
 * the assistant.
 *
 * Hard rule: this module never invents a `stage_events` row and never lets
 * the live `opportunities.stage` column silently stand in for recorded
 * history. Every derived fact traces back to an actual event, or the result
 * says explicitly that no history exists.
 */

export interface StageEventInput {
  id?: string;
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
  reason: "unrecognized_from" | "unrecognized_to" | "no_movement" | "invalid_time" | "broken_chain";
}

export interface StageHistoryResult {
  /** Always the live record's current stage — reporting for "where is this
   * opportunity right now" never derives from stage_events. Null only when
   * the stored value matches no stage the tenant currently recognizes. */
  currentStage: string | null;
  status: "complete" | "incomplete" | "missing";
  issues: string[];
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
 * Walks recorded events in timestamp and ID order. Future/invalid events and
 * disconnected segments never fabricate durations; incomplete reads stay visible.
 */
export function computeStageHistory(
  events: StageEventInput[],
  currentStageRaw: string,
  stages: PipelineStageResolver,
  asOf: Date = new Date(),
  inputStatus: "complete" | "truncated" | "unavailable" = "complete",
): StageHistoryResult {
  const currentStage = stages.canonicalStage(currentStageRaw);
  const rankOf = (key: string) => stages.stageKeys.indexOf(key);

  const issues = new Set<string>();
  if (inputStatus !== "complete") issues.add(inputStatus);
  const ordered = [...events].sort(
    (a, b) =>
      Date.parse(a.created_at) - Date.parse(b.created_at) ||
      a.created_at.localeCompare(b.created_at) ||
      (a.id ?? `${a.from_stage}:${a.to_stage}`).localeCompare(
        b.id ?? `${b.from_stage}:${b.to_stage}`,
      ),
  );
  let lastEventAt: string | null = null;

  const reached = new Map<string, number>();
  const regressions: StageRegression[] = [];
  const impossibleEvents: ImpossibleStageEvent[] = [];
  const timeInStage: StageSegment[] = [];

  let previousCanonicalTo: string | null = null;
  let segmentReliable = true;
  let segmentStage: string | null = null;
  let segmentEnteredAt: string | null = null;

  for (const [index, event] of ordered.entries()) {
    const at = Date.parse(event.created_at);
    if (!Number.isFinite(at) || at > asOf.getTime()) {
      impossibleEvents.push({
        fromStage: event.from_stage,
        toStage: event.to_stage,
        at: event.created_at,
        reason: "invalid_time",
      });
      issues.add("invalid_event");
      segmentReliable = false;
      continue;
    }
    if (
      index > 0 &&
      ordered[index - 1]!.created_at === event.created_at &&
      (!event.id || !ordered[index - 1]!.id)
    )
      issues.add("unordered_tie");
    const fromCanonical = event.from_stage ? stages.canonicalStage(event.from_stage) : null;
    const toCanonical = stages.canonicalStage(event.to_stage);

    if (!toCanonical) {
      impossibleEvents.push({
        fromStage: event.from_stage,
        toStage: event.to_stage,
        at: event.created_at,
        reason: "unrecognized_to",
      });
      segmentReliable = false;
      continue;
    }
    if (event.from_stage && !fromCanonical) {
      impossibleEvents.push({
        fromStage: event.from_stage,
        toStage: event.to_stage,
        at: event.created_at,
        reason: "unrecognized_from",
      });
      segmentReliable = false;
      continue;
    }
    if (fromCanonical && fromCanonical === toCanonical) {
      impossibleEvents.push({
        fromStage: event.from_stage,
        toStage: event.to_stage,
        at: event.created_at,
        reason: "no_movement",
      });
      if (fromCanonical !== previousCanonicalTo) segmentReliable = false;
      continue;
    }

    const connected =
      segmentReliable && (previousCanonicalTo === null || fromCanonical === previousCanonicalTo);
    if (!connected) {
      impossibleEvents.push({
        fromStage: event.from_stage,
        toStage: event.to_stage,
        at: event.created_at,
        reason: "broken_chain",
      });
      issues.add("broken_chain");
    }
    if (previousCanonicalTo === null && fromCanonical !== null) issues.add("missing_prefix");
    if (segmentStage && segmentEnteredAt) {
      timeInStage.push({
        stage: segmentStage,
        enteredAt: segmentEnteredAt,
        exitedAt: connected ? event.created_at : null,
        durationMs: connected ? Date.parse(event.created_at) - Date.parse(segmentEnteredAt) : null,
      });
    }
    segmentStage = toCanonical;
    segmentEnteredAt = event.created_at;

    const toRank = rankOf(toCanonical);
    if (fromCanonical && toRank < rankOf(fromCanonical)) {
      regressions.push({ from: fromCanonical, to: toCanonical, at: event.created_at });
    }
    previousCanonicalTo = toCanonical;
    segmentReliable = true;
    lastEventAt = event.created_at;

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

  if (impossibleEvents.length) issues.add("invalid_event");
  if (lastEventAt && previousCanonicalTo !== currentStage) issues.add("current_stage_mismatch");
  const status = issues.size ? "incomplete" : lastEventAt ? "complete" : "missing";

  return {
    currentStage,
    status,
    issues: [...issues],
    hasHistory: lastEventAt !== null,
    furthestStageFromHistory,
    furthestRankFromHistory,
    reachedStages: [...reached.keys()],
    timeInStage,
    regressions,
    impossibleEvents,
    lastEventAt,
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

  if (history.status === "missing" && history.currentStage) {
    const role = stages.role(history.currentStage);
    if (role === "open" || role === "won") {
      return { rank: stages.stageKeys.indexOf(history.currentStage), source: "current_fallback" };
    }
  }
  return { rank: null, source: "unknown" };
}
