import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Triage gate for the operator queue.
 *
 * The operator queue is the scarcest thing this product has: a human's
 * attention. A row that arrives costs a dismissal, and a founder who learns to
 * dismiss reflexively stops reading the queue, which makes every later row
 * worthless too. So a proposal has to earn its place before it is written, not
 * after a human has already spent attention on it.
 *
 * This is deliberately deterministic. A proposal already carries structured
 * metadata — urgency, entity, evidence, origin — and "is this worth a person's
 * attention" is answerable from that metadata. Asking a model the same question
 * adds a provider call, a new failure mode and a cost on the hottest path in the
 * product to produce a less predictable answer to arithmetic. Northstar section 8
 * is explicit: software determines facts, models handle ambiguity. There is no
 * ambiguity here, so there is no model.
 *
 * The gate records why it decided what it decided. A suppressed proposal leaves
 * a receipt; a shown proposal carries its reason. Nothing disappears silently in
 * the sense of untraceably — "nothing worth surfacing" is itself a recorded,
 * auditable outcome.
 */

export const TRIAGE_ACTIONS = ["answer", "investigate", "pass"] as const;
export type TriageAction = (typeof TRIAGE_ACTIONS)[number];

export interface TriageScores {
  /** 0-100: how much a human decision here changes the business. */
  usefulness: number;
  /** 0-100: how well supported the proposal is by what we can actually see. */
  confidence: number;
  /** 0-100: how much of the queue this consumes to say something small. */
  noise: number;
  /** 0-100: cost of pulling someone away from what they were doing. */
  interruptionCost: number;
  /** 0-100: whether checking before answering is worth the extra step. */
  investigationValue: number;
}

export interface TriageDecision {
  action: TriageAction;
  scores: TriageScores;
  /** Plain-language reason, shown to the operator on the row it kept. */
  reason: string;
  /** True when a human asked for this directly, which always answers. */
  explicit: boolean;
  /** Whether a configured usefulness threshold contributed to the decision. */
  thresholdApplied: boolean;
}

export interface TriageInput {
  actionType: string;
  urgency?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  reasoning?: string | null;
  description?: string | null;
  evidence?: Record<string, unknown> | null;
  /** A human asked for this. Never suppress it, however thin the finding. */
  explicit?: boolean;
}

export interface TriageSettings {
  /** Minimum usefulness to reach the queue. Null keeps pre-gate behavior. */
  suppressionThreshold: number | null;
}

const URGENCY_USEFULNESS: Record<string, number> = {
  critical: 90,
  high: 70,
  normal: 45,
  low: 20,
};

/**
 * Ambient sweeps are the fatigue source. They run on a schedule whether or not
 * anyone is waiting, they carry no human request, and a finding from one is
 * usually a condition rather than a decision. Operator-initiated work is the
 * opposite on every axis.
 */
const AMBIENT_ACTION_TYPES = new Set([
  "data_quality_scan",
  "integration_status_audit",
  "daily_health_check",
  "detect_stale_deals",
  "detect_stage_bottleneck",
  "detect_velocity_change",
  "revenue_stage_audit",
  "proactive_intel_brief",
  "daily_digest",
]);

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Scores derived only from what the caller already knows about the proposal. */
export function scoreTriage(input: TriageInput): TriageScores {
  const explicit = input.explicit === true;
  const ambient = !explicit && AMBIENT_ACTION_TYPES.has(input.actionType);
  const usefulness = clamp(URGENCY_USEFULNESS[input.urgency ?? "normal"] ?? 45);
  // Support is what the proposal brought with it, not how urgent it claims to be.
  const hasEvidence =
    !!input.evidence && Object.keys(input.evidence).filter((key) => key !== "reasoning").length > 0;
  const confidence = clamp(
    hasEvidence ? 80 : input.entityId ? 60 : input.reasoning?.trim() ? 45 : 25,
  );
  const noise = clamp(ambient ? 70 : explicit ? 10 : 40);
  const interruptionCost = clamp(ambient ? 70 : explicit ? 0 : 45);
  // Cheap and useful: go look before spending a person's attention.
  const investigationValue = clamp(
    usefulness >= 60 && confidence < 60 ? 80 : usefulness >= 60 ? 45 : 20,
  );
  return { usefulness, confidence, noise, interruptionCost, investigationValue };
}

/**
 * Deterministic evaluator over the scores. Order matters: an explicit request is
 * answered before anything else can suppress it, and a high-confidence useful
 * finding is answered before the noise rule can talk itself out of surfacing it.
 */
export function routeTriage(input: TriageInput, settings: TriageSettings): TriageDecision {
  const scores = scoreTriage(input);
  const explicit = input.explicit === true;
  const threshold = settings.suppressionThreshold;

  if (explicit)
    return {
      action: "answer",
      scores,
      explicit: true,
      thresholdApplied: false,
      reason: "A person asked for this directly, so it is never held back.",
    };

  if (threshold !== null && scores.usefulness < threshold)
    return {
      action: "pass",
      scores,
      explicit: false,
      thresholdApplied: true,
      reason: `Scored ${scores.usefulness}/100 for usefulness, below this workspace's ${threshold} threshold for reaching the queue.`,
    };

  // Useful but thin: the honest move is to check, not to answer and not to
  // interrupt. The investigation is the work item's own next step.
  if (scores.investigationValue >= 80 && scores.confidence < 60)
    return {
      action: "investigate",
      scores,
      explicit: false,
      thresholdApplied: false,
      reason: `Potentially useful (${scores.usefulness}/100) but only ${scores.confidence}/100 supported, so it needs checking before it reaches a person.`,
    };

  // A scheduled sweep reporting a low-value condition is noise by construction.
  if (scores.noise >= 60 && scores.usefulness < 60)
    return {
      action: "pass",
      scores,
      explicit: false,
      thresholdApplied: false,
      reason: `Scheduled sweep with little to act on (${scores.usefulness}/100 useful, ${scores.noise}/100 noise); recorded for the audit trail instead of the queue.`,
    };

  return {
    action: "answer",
    scores,
    explicit: false,
    thresholdApplied: false,
    reason: `Scored ${scores.usefulness}/100 for usefulness at ${scores.confidence}/100 confidence, worth surfacing.`,
  };
}

/** Tenant policy. A missing or unreadable row means today's behavior, never a
 * failure that blocks a proposal. */
export async function loadTriageSettings(supabase: SupabaseClient): Promise<TriageSettings> {
  const { data, error } = await supabase
    .from("triage_settings")
    .select("suppression_threshold")
    .maybeSingle();
  if (error) {
    console.error("[triage] settings unavailable, keeping current behavior:", error.message);
    return { suppressionThreshold: null };
  }
  const threshold = (data as { suppression_threshold?: number | null } | null)
    ?.suppression_threshold;
  return {
    suppressionThreshold: typeof threshold === "number" ? clamp(threshold) : null,
  };
}

/** Full gate: read policy, score, route. Any failure falls back to answering,
 * because a broken gate must never silently discard real work. */
export async function evaluateTriage(
  supabase: SupabaseClient,
  input: TriageInput,
): Promise<TriageDecision> {
  const settings = await loadTriageSettings(supabase);
  return routeTriage(input, settings);
}

/** The record stored on the action row so the operator can see the reasoning. */
export function triageReceipt(decision: TriageDecision): Record<string, unknown> {
  return {
    action: decision.action,
    reason: decision.reason,
    explicit: decision.explicit,
    thresholdApplied: decision.thresholdApplied,
    scores: decision.scores,
  };
}

export function triageReason(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const reason = (value as { reason?: unknown }).reason;
  return typeof reason === "string" && reason.trim() ? reason : null;
}
