/** Reviewed estimates are judgments, never verified source facts or probabilities. */
import { z } from "zod";
export const RADAR_FACTORS = [
  "relevance",
  "authority",
  "timeliness",
  "reachability",
  "recognition",
  "differentiation",
  "compounding",
] as const;
export type RadarFactor = (typeof RADAR_FACTORS)[number];
export const RADAR_DEFAULT_WEIGHTS: Record<RadarFactor, number> = {
  relevance: 20,
  authority: 15,
  timeliness: 15,
  reachability: 15,
  recognition: 15,
  differentiation: 10,
  compounding: 10,
};
const note = (max: number) => z.string().trim().min(1).max(max);
const estimate = z
  .object({
    value: z.number().min(0).max(100).nullable(),
    confidence: z.enum(["low", "medium", "high"]),
    rationale: note(500),
    sourceVersionIds: z.array(z.uuid()).max(10),
  })
  .strict()
  .refine(
    (v) => v.value === null || v.sourceVersionIds.length > 0,
    "A numerical estimate needs cited evidence",
  );
export const radarAssessmentSchema = z
  .object({
    classification: z.enum(["business", "public_affairs", "unknown"]),
    classificationReason: note(500),
    topicKey: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9][a-z0-9_-]+$/),
    estimates: z
      .object({
        relevance: estimate,
        authority: estimate,
        timeliness: estimate,
        reachability: estimate,
        recognition: estimate,
        differentiation: estimate,
        compounding: estimate,
      })
      .strict(),
    effort: z.number().int().min(1).max(5),
    timeToValue: z.enum(["immediate", "day", "week", "month", "long_term"]),
    nextAction: note(1000),
    alternatives: z.array(note(500)).min(1).max(3),
    expiresAt: z.iso.datetime(),
  })
  .strict();
export type RadarAssessment = z.infer<typeof radarAssessmentSchema>;
export const radarAssessmentPreviewSchema = z
  .object({
    operationId: z.uuid(),
    opportunityId: z.uuid(),
    expectedRevision: z.number().int().positive(),
    assessment: radarAssessmentSchema,
  })
  .strict();
export const radarAssessmentProposalSchema = radarAssessmentPreviewSchema
  .extend({ digest: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
const weightsSchema = z
  .object({
    relevance: z.number().min(0).max(100),
    authority: z.number().min(0).max(100),
    timeliness: z.number().min(0).max(100),
    reachability: z.number().min(0).max(100),
    recognition: z.number().min(0).max(100),
    differentiation: z.number().min(0).max(100),
    compounding: z.number().min(0).max(100),
  })
  .strict()
  .refine(
    (v) => Math.abs(Object.values(v).reduce((s, n) => s + n, 0) - 100) < 0.000001,
    "Weights must sum to 100",
  );
export const radarSelectionSchema = z
  .object({
    weights: weightsSchema.default(RADAR_DEFAULT_WEIGHTS),
    maxTotalEffort: z.number().int().min(1).max(50).default(10),
  })
  .strict();
// Conservative backstop, not a claim of comprehensive semantic classification.
// Human approval of the exact evidence and subject classification remains required.
export const RADAR_PUBLIC_AFFAIRS_PATTERN =
  "\\b(politic[a-z]*|election[a-z]*|government[a-z]*|parliament[a-z]*|congress[a-z]*|senat[a-z]*|president[a-z]*|minister[a-z]*|legislat[a-z]*|referendum[a-z]*|public[ -]affairs|public[ -]policy|political[ -]party)\\b";
export function hasPublicAffairsSignals(text: string) {
  return new RegExp(RADAR_PUBLIC_AFFAIRS_PATTERN, "i").test(text);
}
export function scoreRadarAssessment(
  assessment: RadarAssessment,
  weights: Record<RadarFactor, number>,
) {
  const valid = weightsSchema.parse(weights);
  if (
    assessment.classification !== "business" ||
    hasPublicAffairsSignals(JSON.stringify(assessment)) ||
    RADAR_FACTORS.some((key) => assessment.estimates[key].value === null)
  )
    return null;
  const contributions = Object.fromEntries(
    RADAR_FACTORS.map((key) => [key, (assessment.estimates[key].value! * valid[key]) / 100]),
  );
  return {
    score:
      Math.round(Object.values(contributions).reduce((sum, value) => sum + value, 0) * 100) / 100,
    contributions,
    weights: valid,
    interpretation: "reviewed estimate, not a probability",
  };
}
export type RadarSelectionCandidate = {
  id: string;
  assessment: RadarAssessment | null;
  reviewedAt: string | null;
  deferral: string | null;
};
export function selectRadarCandidates(
  candidates: RadarSelectionCandidate[],
  raw: unknown,
  limit: number,
  now: Date,
) {
  const input = radarSelectionSchema.parse(raw);
  z.number().int().min(1).max(10).parse(limit);
  const deferred: Array<{ id: string; reason: string }> = [],
    unranked: Array<{ id: string; reason: string }> = [];
  const eligible = [];
  for (const candidate of candidates) {
    const a = candidate.assessment;
    if (candidate.deferral) {
      deferred.push({ id: candidate.id, reason: candidate.deferral });
      continue;
    }
    if (!a || a.classification !== "business") {
      unranked.push({ id: candidate.id, reason: "Subject needs neutral manual review" });
      continue;
    }
    const scored = scoreRadarAssessment(a, input.weights);
    if (!scored) {
      unranked.push({ id: candidate.id, reason: "One or more estimates are unknown" });
      continue;
    }
    if (Date.parse(a.expiresAt) <= now.getTime()) {
      deferred.push({ id: candidate.id, reason: "Assessment expired; review again" });
      continue;
    }
    const ageDays = Math.max(0, (now.getTime() - Date.parse(candidate.reviewedAt!)) / 86400000);
    if (!Number.isFinite(ageDays)) {
      deferred.push({ id: candidate.id, reason: "Review timestamp unavailable" });
      continue;
    }
    const urgency = { immediate: 1, day: 0.95, week: 0.8, month: 0.6, long_term: 0.4 }[
      a.timeToValue
    ];
    const decay = Math.pow(0.5, ageDays / 7);
    const priority =
      Math.round(((scored.score * urgency * decay) / Math.sqrt(a.effort)) * 100) / 100;
    eligible.push({
      id: candidate.id,
      ...scored,
      priority,
      decay,
      effort: a.effort,
      timeToValue: a.timeToValue,
      topicKey: a.topicKey,
      nextAction: a.nextAction,
      alternatives: a.alternatives,
    });
  }
  eligible.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  const selected: typeof eligible = [];
  const topics = new Set<string>();
  let effort = 0;
  for (const item of eligible) {
    let reason: string | null = null;
    if (selected.length >= limit) reason = "Daily shortlist limit";
    else if (topics.has(item.topicKey)) reason = "Another selected opportunity covers this topic";
    else if (effort + item.effort > input.maxTotalEffort) reason = "Review effort budget";
    if (reason) {
      deferred.push({ id: item.id, reason });
      continue;
    }
    selected.push(item);
    topics.add(item.topicKey);
    effort += item.effort;
  }
  return {
    selected,
    unranked,
    deferred,
    effortUsed: effort,
    maxTotalEffort: input.maxTotalEffort,
    weights: input.weights,
    formula: "weighted score × time-to-value multiplier × 7-day half-life / sqrt(effort)",
    externalEffects: false,
    modelCalls: 0,
  };
}
