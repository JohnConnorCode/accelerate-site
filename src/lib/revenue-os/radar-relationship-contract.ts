/** Relationships remain human-reviewed, source-backed assertions over canonical IDs. */
import { z } from "zod";
import { radarSourceUrlSchema } from "./radar-store-contract";
const note = (max: number) => z.string().trim().min(1).max(max);
const sourceEvidence = z
  .object({ kind: z.literal("source"), sourceVersionId: z.uuid(), quotation: note(1000) })
  .strict();
const messageEvidence = z
  .object({ kind: z.literal("message"), messageId: z.uuid(), quotation: note(1000) })
  .strict();
export const radarRelationshipSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("business_contact_path"),
      contactId: z.uuid(),
      sourceVersionId: z.uuid(),
      contactUrl: radarSourceUrlSchema,
      evidence: sourceEvidence,
    })
    .strict(),
  z
    .object({
      kind: z.literal("authorship"),
      contactId: z.uuid(),
      sourceVersionId: z.uuid(),
      evidence: sourceEvidence,
    })
    .strict(),
  z
    .object({
      kind: z.literal("affiliation"),
      contactId: z.uuid(),
      companyId: z.uuid(),
      role: note(200),
      evidence: sourceEvidence,
    })
    .strict(),
  z
    .object({
      kind: z.literal("publication"),
      companyId: z.uuid(),
      sourceVersionId: z.uuid(),
      evidence: sourceEvidence,
    })
    .strict(),
  z
    .object({
      kind: z.literal("topic_context"),
      contactId: z.uuid(),
      sourceVersionId: z.uuid(),
      topics: z.array(note(80)).min(1).max(6),
      evidence: sourceEvidence,
    })
    .strict(),
  z
    .object({
      kind: z.literal("introduction_offer"),
      fromContactId: z.uuid(),
      toContactId: z.uuid(),
      offer: note(1000),
      evidence: messageEvidence,
    })
    .strict(),
]);
export type RadarRelationship = z.infer<typeof radarRelationshipSchema>;
export const radarRelationshipReviewSchema = z
  .object({
    operationId: z.uuid(),
    expectedReviewId: z.uuid().nullable(),
    relationship: radarRelationshipSchema,
    validFrom: z.iso.datetime(),
    validUntil: z.iso.datetime(),
    reason: note(1000),
  })
  .strict();
export const radarRelationshipRevokeSchema = z
  .object({
    operationId: z.uuid(),
    relationshipId: z.uuid(),
    expectedReviewId: z.uuid(),
    reason: note(1000),
  })
  .strict();
export const radarRelationshipChangeSchema = z.discriminatedUnion("operation", [
  radarRelationshipReviewSchema.extend({ operation: z.literal("review") }).strict(),
  radarRelationshipRevokeSchema.extend({ operation: z.literal("revoke") }).strict(),
]);
export const radarRelationshipProposalSchema = z
  .object({ change: radarRelationshipChangeSchema, digest: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
export const radarRelationshipReadSchema = z
  .object({ contactId: z.uuid(), limit: z.number().int().min(1).max(20).default(10) })
  .strict();
export type RadarRelationshipChange = z.infer<typeof radarRelationshipChangeSchema>;
export function radarRelationshipEdge(r: RadarRelationship) {
  switch (r.kind) {
    case "business_contact_path":
      return {
        sourceType: "contact",
        sourceId: r.contactId,
        targetType: "radar_source_version",
        targetId: r.sourceVersionId,
        linkType: "radar_business_contact_path",
      };
    case "authorship":
      return {
        sourceType: "contact",
        sourceId: r.contactId,
        targetType: "radar_source_version",
        targetId: r.sourceVersionId,
        linkType: "radar_authorship",
      };
    case "affiliation":
      return {
        sourceType: "contact",
        sourceId: r.contactId,
        targetType: "company",
        targetId: r.companyId,
        linkType: "radar_affiliation",
      };
    case "publication":
      return {
        sourceType: "company",
        sourceId: r.companyId,
        targetType: "radar_source_version",
        targetId: r.sourceVersionId,
        linkType: "radar_publication",
      };
    case "topic_context":
      return {
        sourceType: "contact",
        sourceId: r.contactId,
        targetType: "radar_source_version",
        targetId: r.sourceVersionId,
        linkType: "radar_topic_context",
      };
    case "introduction_offer":
      return {
        sourceType: "contact",
        sourceId: r.fromContactId,
        targetType: "contact",
        targetId: r.toContactId,
        linkType: "radar_introduction_offer",
      };
  }
}
export function validateRadarRelationshipReview(
  input: z.infer<typeof radarRelationshipReviewSchema>,
  now: Date,
  evidenceText: string,
) {
  const r = input.relationship;
  if (r.kind === "introduction_offer" && r.fromContactId === r.toContactId)
    throw new Error("An introduction needs two distinct canonical contacts");
  if (
    r.evidence.kind === "source" &&
    "sourceVersionId" in r &&
    r.sourceVersionId !== r.evidence.sourceVersionId
  )
    throw new Error("The assertion must cite the same source version");
  if (r.kind === "business_contact_path" && !r.evidence.quotation.includes(r.contactUrl))
    throw new Error("The exact public business contact URL must appear in the cited quotation");
  if (!evidenceText.includes(r.evidence.quotation))
    throw new Error(
      "Quotation is not present in the cited evidence; do not invent or paraphrase a quotation",
    );
  const from = Date.parse(input.validFrom),
    until = Date.parse(input.validUntil),
    maxDays = r.kind === "introduction_offer" ? 30 : 365;
  if (from >= until || until <= now.getTime() || until > now.getTime() + maxDays * 86400000)
    throw new Error(`Relationship validity must end within ${maxDays} days and after its start`);
}
export type RadarRelationshipPathInput = {
  target: { id: string; communicationStatus: string; identityReviewPending: boolean };
  priorConversationCount: number;
  historyComplete: boolean;
  publicContactPaths?: Array<{
    id: string;
    contactId: string;
    contactUrl: string;
    validFrom: string;
    validUntil: string;
    currentEvidence: boolean;
    revoked: boolean;
  }>;
  offers: Array<{
    id: string;
    fromContactId: string;
    fromName: string;
    communicationStatus: string;
    identityReviewPending: boolean;
    validFrom: string;
    validUntil: string;
    currentEvidence: boolean;
    explicitOffer: boolean;
    revoked: boolean;
  }>;
};
/** Neutral review choices, never ranked people, contact permission or inferred KNOWS. */
export function radarRelationshipPaths(input: RadarRelationshipPathInput, now: Date) {
  const paths: Array<{
    kind: "existing_conversation" | "introduction_offer" | "public_business_contact";
    contactUrl?: string;
    viaContactId: string;
    relationshipId: string | null;
    reason: string;
  }> = [];
  const blocked: Array<{ relationshipId: string | null; reason: string }> = [];
  if (!input.historyComplete)
    return {
      paths,
      blocked: [
        {
          relationshipId: null,
          reason: "Relationship history is incomplete; manual review required",
        },
      ],
      outreachPermission: false,
    };
  if (input.target.communicationStatus !== "active" || input.target.identityReviewPending)
    return {
      paths,
      blocked: [
        {
          relationshipId: null,
          reason: "Target is restricted, unresolved or has unknown communication status",
        },
      ],
      outreachPermission: false,
    };
  if (input.priorConversationCount > 0)
    paths.push({
      kind: "existing_conversation",
      viaContactId: input.target.id,
      relationshipId: null,
      reason: "Read the existing canonical conversation before preparing another ask",
    });
  for (const offer of input.offers) {
    let reason: string | null = null;
    if (offer.revoked || !offer.explicitOffer) reason = "No current explicit introduction offer";
    else if (!offer.currentEvidence) reason = "Introduction evidence changed or is unavailable";
    else if (
      !Number.isFinite(Date.parse(offer.validFrom)) ||
      !Number.isFinite(Date.parse(offer.validUntil)) ||
      Date.parse(offer.validFrom) > now.getTime() ||
      Date.parse(offer.validUntil) <= now.getTime()
    )
      reason = "Introduction offer is not currently valid";
    else if (offer.communicationStatus !== "active" || offer.identityReviewPending)
      reason = "Introducing contact is restricted or unresolved";
    if (reason) blocked.push({ relationshipId: offer.id, reason });
    else
      paths.push({
        kind: "introduction_offer",
        viaContactId: offer.fromContactId,
        relationshipId: offer.id,
        reason: `${offer.fromName} made an explicit, currently evidenced introduction offer. Review the conversation and exact ask.`,
      });
  }
  for (const contactPath of input.publicContactPaths ?? []) {
    let reason: string | null = null;
    if (contactPath.contactId !== input.target.id)
      reason = "The public contact path belongs to another canonical contact";
    else if (contactPath.revoked || !contactPath.currentEvidence)
      reason = "Public business contact evidence changed, was revoked or is unavailable";
    else if (!radarSourceUrlSchema.safeParse(contactPath.contactUrl).success)
      reason = "Public business contact URL is invalid";
    else if (
      !Number.isFinite(Date.parse(contactPath.validFrom)) ||
      !Number.isFinite(Date.parse(contactPath.validUntil)) ||
      Date.parse(contactPath.validFrom) > now.getTime() ||
      Date.parse(contactPath.validUntil) <= now.getTime()
    )
      reason = "Public business contact path is not currently valid";
    if (reason) blocked.push({ relationshipId: contactPath.id, reason });
    else
      paths.push({
        kind: "public_business_contact",
        viaContactId: input.target.id,
        relationshipId: contactPath.id,
        contactUrl: contactPath.contactUrl,
        reason:
          "Review the source-backed public business contact page and its instructions. Public availability is not consent or permission to send.",
      });
  }
  return { paths, blocked, outreachPermission: false };
}
