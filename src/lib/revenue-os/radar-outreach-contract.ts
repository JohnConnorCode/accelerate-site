import { z } from "zod";
const text = (max: number) => z.string().trim().min(1).max(max);
export const radarOutreachPurposeSchema = z.enum([
  "media_pitch",
  "participant_invitation",
  "partnership",
  "follow_up",
  "introduction_request",
  "introduction",
]);
export const radarOutreachPrepareSchema = z
  .object({
    operationId: z.uuid(),
    opportunityId: z.uuid(),
    expectedRevision: z.number().int().positive(),
    purpose: radarOutreachPurposeSchema.exclude(["introduction"]),
    sourceVersionIds: z.array(z.uuid()).min(1).max(5),
    approvedClaimIds: z.array(z.uuid()).max(10).default([]),
    useModel: z.boolean().default(false),
    usefulContribution: text(600),
    exactAsk: text(600),
  })
  .strict();
/** Consent is cited received inbound evidence, never a model-supplied boolean. */
export const radarIntroductionConsentSchema = z
  .object({
    contactId: z.uuid(),
    messageId: z.uuid(),
    quotation: text(1000),
    validUntil: z.iso.datetime(),
  })
  .strict();
export const radarOutreachPreviewSchema = z
  .object({
    assetId: z.uuid(),
    approvedClaimIds: z.array(z.uuid()).max(10).default([]),
    purpose: radarOutreachPurposeSchema,
    relationshipId: z.uuid().nullable().default(null),
    introductionContactId: z.uuid().nullable().default(null),
    consents: z.array(radarIntroductionConsentSchema).max(2).default([]),
    reason: text(1000),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.purpose === "introduction") {
      if (
        !input.introductionContactId ||
        input.consents.length !== 2 ||
        new Set(input.consents.map((c) => c.contactId)).size !== 2
      )
        ctx.addIssue({
          code: "custom",
          message:
            "An introduction requires two distinct canonical parties and their documented consent",
        });
    } else if (input.introductionContactId || input.consents.length) {
      ctx.addIssue({
        code: "custom",
        message: "Additional parties and consent records belong only to an introduction",
      });
    }
    if (input.purpose === "introduction_request" && !input.relationshipId)
      ctx.addIssue({
        code: "custom",
        message: "Read a current explicit offer before requesting its introduction",
      });
  });
export const radarOutreachProposalSchema = z
  .object({ input: radarOutreachPreviewSchema, digest: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
export const radarOutreachReadSchema = z
  .object({
    opportunityId: z.uuid().optional(),
    actionId: z.uuid().optional(),
    limit: z.number().int().min(1).max(20).default(10),
  })
  .strict();
export type RadarOutreachPurpose = z.infer<typeof radarOutreachPurposeSchema>;
export type RadarOutreachPreviewInput = z.infer<typeof radarOutreachPreviewSchema>;
export type RadarOutreachQuality = {
  blockers: Array<{ rule: string; message: string }>;
  warnings: Array<{ rule: string; message: string }>;
  humanReviewRequired: true;
};

/** Generic deterministic quality checks, informed by SD's policy-driven message lint.
 * These catch specific mistakes; they do not claim semantic fact verification. */
export function reviewRadarOutreachText(input: {
  subject: string;
  body: string;
  purpose: RadarOutreachPurpose;
  approvedFacts: string[];
  allowedUrls: string[];
  forbiddenPhrases: string[];
  allowApprovedTerms?: boolean;
  hasPriorOutbound: boolean;
  hasCurrentIntroductionOffer: boolean;
  hasBothConsents: boolean;
}): RadarOutreachQuality {
  const blockers: RadarOutreachQuality["blockers"] = [],
    warnings: RadarOutreachQuality["warnings"] = [];
  const combined = `${input.subject}\n${input.body}`,
    facts = input.approvedFacts.join("\n");
  for (const phrase of input.forbiddenPhrases.filter(Boolean))
    if (combined.toLocaleLowerCase().includes(phrase.toLocaleLowerCase()))
      blockers.push({
        rule: "forbidden_phrase",
        message: `Remove the configured forbidden phrase: ${phrase}`,
      });
  if (
    /\b(guaranteed?|massive|huge)\s+(audience|reach|exposure|coverage)|\bwe will get you\b/i.test(
      combined,
    )
  )
    blockers.push({
      rule: "promised_reach",
      message: "Do not promise an audience, coverage or exposure",
    });
  const quantitative =
    combined.match(
      /\b\d[\d,.]*\s*(?:k|m|million|thousand)?\s*(?:viewers|listeners|subscribers|followers|attendees|downloads|votes)\b/gi,
    ) ?? [];
  if (quantitative.some((claim) => !facts.toLocaleLowerCase().includes(claim.toLocaleLowerCase())))
    blockers.push({
      rule: "unsupported_quantity",
      message: "An audience or participation figure is absent from the current approved facts",
    });
  const financial = /\b(?:honorarium|speaking fee|we (?:will|can) pay)\b|[$€£]\s?\d/i;
  const terms = combined
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter((part) => financial.test(part));
  if (
    terms.some(
      (term) =>
        !input.allowApprovedTerms || !facts.toLocaleLowerCase().includes(term.toLocaleLowerCase()),
    )
  )
    blockers.push({
      rule: "financial_commitment",
      message:
        "Financial terms require an enabled policy and a verbatim current approved fact; do not invent a commitment",
    });

  if (
    /\b(?:introduced us|introduced me|asked me to introduce|happy to introduce|pleased to introduce)\b/i.test(
      combined,
    ) &&
    !input.hasBothConsents
  )
    blockers.push({
      rule: "unsupported_introduction",
      message: "A suggestion or offer is not consent from both parties to this introduction",
    });
  if (input.purpose === "introduction" && !input.hasBothConsents)
    blockers.push({
      rule: "introduction_consent",
      message: "Read current explicit consent from both canonical parties",
    });
  if (input.purpose === "introduction_request" && !input.hasCurrentIntroductionOffer)
    blockers.push({
      rule: "introduction_offer",
      message: "Read the current quoted introduction offer before referring to it",
    });
  const urls = combined.match(/https?:\/\/[^\s<>"')]+/g) ?? [];
  const normalizeUrl = (value: string) => value.replace(/[.,;!?]+$/, "");
  if (
    urls.some(
      (url) => !input.allowedUrls.some((allowed) => normalizeUrl(allowed) === normalizeUrl(url)),
    )
  )
    blockers.push({
      rule: "unreviewed_link",
      message: "Every message URL must match a current cited source or approved business link",
    });
  if (
    input.hasPriorOutbound &&
    /\b(?:pleasure to meet|introduce myself|never spoken|first time reaching out)\b/i.test(combined)
  )
    warnings.push({
      rule: "existing_history",
      message: "There is prior outbound history; review whether this cold opener is appropriate",
    });
  if (/\b(?:just checking in|touching base|loved your fascinating)\b/i.test(combined))
    warnings.push({
      rule: "generic_pitch",
      message: "Lead with substantive context, useful contribution and a specific ask",
    });
  if (input.body.split(/\s+/).length > 220)
    warnings.push({
      rule: "length",
      message: "Consider shortening this message to one clear contribution and ask",
    });
  return { blockers, warnings, humanReviewRequired: true };
}
