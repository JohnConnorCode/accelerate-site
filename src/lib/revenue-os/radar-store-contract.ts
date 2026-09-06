import { z } from "zod";

const id = z.uuid();
const text = (max: number) => z.string().trim().min(1).max(max);
export const radarSourceUrlSchema = z
  .url()
  .max(2000)
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  }, "Use an HTTPS source reference without credentials");
export const RADAR_OPPORTUNITY_STATES = [
  "draft",
  "researched",
  "needs_review",
  "approved",
  "dismissed",
  "in_progress",
  "completed",
  "declined",
  "no_response",
] as const;
export const RADAR_TRANSITIONS: Record<
  (typeof RADAR_OPPORTUNITY_STATES)[number],
  readonly string[]
> = {
  draft: ["researched", "needs_review", "dismissed"],
  researched: ["needs_review", "dismissed"],
  needs_review: ["draft", "approved", "dismissed"],
  approved: ["in_progress", "needs_review", "dismissed"],
  in_progress: ["completed", "declined", "no_response", "needs_review"],
  completed: [],
  dismissed: [],
  declined: [],
  no_response: ["needs_review"],
};
const citation = z
  .object({ sourceVersionId: id, observation: text(1000), evidenceId: id.optional() })
  .strict();
const citations = z
  .array(citation)
  .min(1)
  .max(10)
  .refine(
    (values) => new Set(values.map((value) => value.sourceVersionId)).size === values.length,
    "Source versions must be distinct",
  );
const opportunityFields = {
  title: text(200),
  summary: text(2000),
  recommendedAction: text(1000),
  kind: z.string().regex(/^[a-z][a-z0-9_]{1,59}$/),
  contactId: id.nullable().optional(),
  companyId: id.nullable().optional(),
};
export const radarStoreChangeSchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("ingest_source"),
      url: radarSourceUrlSchema,
      title: text(300),
      bodyText: text(20000),
      author: text(200).optional(),
      publishedAt: z.iso.datetime({ offset: true }).nullable().optional(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("review_source"),
      sourceVersionId: id,
      expectedRevision: z.number().int().positive(),
      verification: z.enum(["verified", "retracted", "supplied"]),
      reason: text(1000),
    })
    .strict(),
  z
    .object({ operation: z.literal("create_opportunity"), ...opportunityFields, citations })
    .strict(),
  z
    .object({
      operation: z.literal("update_opportunity"),
      opportunityId: id,
      expectedRevision: z.number().int().positive(),
      patch: z
        .object(opportunityFields)
        .partial()
        .strict()
        .refine((value) => Object.keys(value).length > 0, "Supply a change"),
      reason: text(1000),
    })
    .strict(),
  z
    .object({
      operation: z.literal("replace_citations"),
      opportunityId: id,
      expectedRevision: z.number().int().positive(),
      citations,
      reason: text(1000),
    })
    .strict(),
  z
    .object({
      operation: z.literal("transition_opportunity"),
      opportunityId: id,
      expectedRevision: z.number().int().positive(),
      state: z.enum(RADAR_OPPORTUNITY_STATES),
      reason: text(1000),
    })
    .strict(),
  z
    .object({
      operation: z.literal("add_asset"),
      opportunityId: id,
      expectedRevision: z.number().int().positive(),
      kind: z.enum(["brief", "outreach_draft", "content_draft", "research_note"]),
      title: text(200),
      bodyText: text(10000),
      sourceVersionIds: z.array(id).min(1).max(10),
    })
    .strict(),
  z
    .object({
      operation: z.literal("record_outcome"),
      opportunityId: id,
      expectedRevision: z.number().int().positive(),
      kind: z.enum(["coverage", "citation", "appearance", "partnership", "referral", "other"]),
      description: text(2000),
      sourceVersionId: id,
    })
    .strict(),
]);
export type RadarStoreChange = z.infer<typeof radarStoreChangeSchema>;
export const radarStorePreviewSchema = z
  .object({ operationId: id, change: radarStoreChangeSchema })
  .strict();
export const radarStoreProposalSchema = z
  .object({
    operationId: id,
    change: radarStoreChangeSchema,
    digest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export const radarStoreReadSchema = z
  .object({
    opportunityId: id.optional(),
    operationId: id.optional(),
    sourceVersionId: id.optional(),
    assetId: id.optional(),
    offset: z.number().int().min(0).max(20000).default(0),
    limit: z.number().int().min(1).max(20).default(10),
  })
  .strict()
  .refine(
    (value) =>
      [value.opportunityId, value.operationId, value.sourceVersionId, value.assetId].filter(Boolean)
        .length <= 1,
    "Choose one record selector",
  );

/** Shared live/demo preconditions. Adapters still own tenant-scoped identity reads. */
export function assertRadarStoreContext(
  change: RadarStoreChange,
  opp: { revision: number; state: string } | null,
  currentSourceIds: string[],
  versions: Array<{ id: string; revision: number; verification: string }>,
) {
  if ("opportunityId" in change) {
    if (!opp) throw new Error("Radar opportunity unavailable");
    if (opp.revision !== change.expectedRevision)
      throw new Error("Stale opportunity revision; read current state first");
    if (
      change.operation === "transition_opportunity" &&
      !RADAR_TRANSITIONS[opp.state as keyof typeof RADAR_TRANSITIONS]?.includes(change.state)
    )
      throw new Error("Invalid Radar lifecycle transition");
    if (
      ["update_opportunity", "replace_citations"].includes(change.operation) &&
      ["completed", "dismissed", "declined"].includes(opp.state)
    )
      throw new Error("Terminal opportunity is retained as history");
    if (
      change.operation === "add_asset" &&
      change.sourceVersionIds.some((id) => !currentSourceIds.includes(id))
    )
      throw new Error("Asset must cite current opportunity evidence");
  }
  const required = [
    ...currentSourceIds,
    ...("citations" in change ? change.citations.map((c) => c.sourceVersionId) : []),
    ...("sourceVersionId" in change ? [change.sourceVersionId] : []),
  ];
  if (required.some((id) => !versions.some((v) => v.id === id)))
    throw new Error("A source version is missing or belongs to another workspace");
  if (change.operation === "review_source") {
    if (versions.find((v) => v.id === change.sourceVersionId)?.revision !== change.expectedRevision)
      throw new Error("Stale source revision; read current state first");
  } else if (versions.some((v) => v.verification === "retracted")) {
    const replacementIds =
      "citations" in change ? change.citations.map((c) => c.sourceVersionId) : [];
    if (
      (change.operation !== "replace_citations" &&
        !(
          change.operation === "transition_opportunity" &&
          ["draft", "needs_review", "dismissed", "declined", "no_response"].includes(change.state)
        )) ||
      versions.some((v) => replacementIds.includes(v.id) && v.verification === "retracted")
    )
      throw new Error("Retracted sources require a reviewed citation replacement");
  }
  if (
    change.operation === "transition_opportunity" &&
    ["approved", "in_progress", "completed"].includes(change.state) &&
    versions.some((v) => v.verification !== "verified")
  )
    throw new Error("Review every source before advancing this opportunity");
}

export function normalizeRadarStoreChange(change: RadarStoreChange): RadarStoreChange {
  if (change.operation !== "ingest_source") return change;
  const url = new URL(change.url);
  url.hash = "";
  // Preserve query identity and order; campaign stripping could merge different documents.
  return { ...change, url: url.toString(), publishedAt: change.publishedAt ?? null };
}
