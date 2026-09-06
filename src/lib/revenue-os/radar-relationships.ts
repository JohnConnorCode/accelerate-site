import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { callRadarRelationshipRpc, tenantIdForDatabase } from "@/lib/supabase/server";
import { proposeAction } from "./actions";
import { findEntityLink, getEntityType } from "./entity-registry";
import { isModuleEnabled } from "./modules";
import { readRadarRelationshipEvidence } from "./radar-relationship-evidence";
import {
  radarRelationshipChangeSchema,
  radarRelationshipProposalSchema,
  radarRelationshipEdge,
  validateRadarRelationshipReview,
} from "./radar-relationship-contract";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, v]) => [key, canonical(v)]),
    );
  return value;
}
function digest(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}
const edgeSchema = z
  .object({
    sourceType: z.enum(["contact", "company"]),
    sourceId: z.uuid(),
    targetType: z.enum(["contact", "company", "radar_source_version"]),
    targetId: z.uuid(),
    linkType: z.string().regex(/^radar_[a-z_]+$/),
  })
  .strict();
const evidenceSchema = z
  .object({
    kind: z.enum(["source", "message"]),
    id: z.uuid(),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    revision: z.number().int().positive().nullable(),
    verification: z.string(),
    conversationId: z.uuid().nullable(),
    contactId: z.uuid().nullable(),
    senderEmail: z.string().nullable(),
  })
  .strict();
const factsSchema = z
  .object({
    version: z.literal(1),
    tenantId: z.uuid(),
    change: radarRelationshipChangeSchema,
    edge: edgeSchema,
    evidence: evidenceSchema,
    configRevision: z.string().length(64),
  })
  .strict();
const payloadSchema = factsSchema.extend({ digest: z.string().length(64) }).strict();
async function workspace(db: SupabaseClient, requireEnabled = true) {
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("Radar relationships require an explicit workspace");
  const read = await db.from("tenants").select("status,config").eq("id", tenantId).single();
  if (read.error || read.data?.status !== "active")
    throw new Error("Relationship workspace unavailable");
  if (requireEnabled && !isModuleEnabled("opportunity-radar", read.data.config))
    throw new Error("Radar is disabled");
  return { tenantId, config: read.data.config as Record<string, unknown> };
}
export async function previewRadarRelationship(db: SupabaseClient, raw: unknown, now = new Date()) {
  const change = radarRelationshipChangeSchema.parse(raw);
  const { tenantId, config } = await workspace(db);
  let edge: z.infer<typeof edgeSchema>, evidence: z.infer<typeof evidenceSchema>;
  let sourceTitle: string, sourceUrl: string | null;
  if (change.operation === "revoke") {
    const read = await db
      .from("radar_current_relationships")
      .select("id,state,edge_snapshot,evidence_snapshot")
      .eq("tenant_id", tenantId)
      .eq("link_id", change.relationshipId)
      .single();
    if (read.error || read.data?.id !== change.expectedReviewId || read.data.state === "revoked")
      throw new Error("Relationship review changed or unavailable");
    edge = edgeSchema.parse(read.data.edge_snapshot);
    evidence = evidenceSchema.parse(read.data.evidence_snapshot);
    sourceTitle = "Retained relationship review";
    sourceUrl = null;
  } else {
    edge = edgeSchema.parse(radarRelationshipEdge(change.relationship));
    for (const type of new Set([edge.sourceType, edge.targetType])) {
      const declaration = await getEntityType(db, tenantId, type);
      const table =
        type === "contact"
          ? "contacts"
          : type === "company"
            ? "companies"
            : "radar_source_versions";
      if (
        declaration &&
        (declaration.isDisabled ||
          declaration.backingTable !== table ||
          declaration.idColumn !== "id")
      )
        throw new Error("Canonical relationship entity type is disabled or conflicting");
    }
    // Both endpoints are exact canonical IDs. A same-name record is never a substitute.
    for (const [type, id] of [
      [edge.sourceType, edge.sourceId],
      [edge.targetType, edge.targetId],
    ] as const) {
      if (type === "radar_source_version") continue;
      const read = await db
        .from(type === "contact" ? "contacts" : "companies")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("id", id)
        .single();
      if (read.error || !read.data) throw new Error("Canonical relationship endpoint unavailable");
    }
    const currentLink = await findEntityLink(db, { tenantId, ...edge });
    const read = currentLink
      ? await db
          .from("radar_current_relationships")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("link_id", currentLink.id)
          .maybeSingle()
      : { data: null, error: null };
    if (read.error || (read.data?.id ?? null) !== change.expectedReviewId)
      throw new Error("Relationship review changed; read and preview again");
    const cited = await readRadarRelationshipEvidence(db, change.relationship);
    validateRadarRelationshipReview(change, now, cited.text);
    evidence = evidenceSchema.parse(cited.snapshot);
    sourceTitle = cited.title;
    sourceUrl = cited.url;
  }
  const facts = factsSchema.parse({
    version: 1,
    tenantId,
    change,
    edge,
    evidence,
    configRevision: digest(config),
  });
  return {
    ...facts,
    digest: digest(facts),
    sourceTitle,
    sourceUrl,
    requiresHumanApproval: true,
    interpretation:
      "Human-reviewed assertion, not an inferred relationship or permission to contact. Confirm the exact quotation supports the named canonical people and claim.",
  };
}
export async function proposeRadarRelationship(
  db: SupabaseClient,
  raw: unknown,
  actorEmail: string,
) {
  const input = radarRelationshipProposalSchema.parse(raw);
  const preview = await previewRadarRelationship(db, input.change);
  if (preview.digest !== input.digest)
    throw new Error("Relationship preview changed; review current evidence");
  return proposeAction(db, {
    actionType: "review_radar_relationship",
    title:
      input.change.operation === "revoke"
        ? "Revoke Radar relationship review"
        : "Review sourced Radar relationship",
    description:
      "Records the exact cited assertion or revocation over canonical CRM links. Missing core type declarations are installed with ID-only read fields; existing policies are preserved. It does not send outreach or create consent.",
    payload: payloadSchema.strip().parse(preview),
    entityType: "entity_link",
    entityId: input.change.operation === "revoke" ? input.change.relationshipId : undefined,
    sourceContext: "admin_ai",
    proposedBy: actorEmail,
    dedupeKey: `radar-relationship:${preview.tenantId}:${input.change.operationId}:${input.digest}`,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  });
}
export async function executeRadarRelationship(
  db: SupabaseClient,
  raw: unknown,
  actorEmail: string,
) {
  const payload = payloadSchema.parse(raw),
    { digest: expected, ...facts } = payload;
  if (tenantIdForDatabase(db) !== facts.tenantId || digest(facts) !== expected)
    throw new Error("Relationship approval does not match its tenant and exact inputs");
  const prior = await db
    .from("radar_relationship_reviews")
    .select("id")
    .eq("tenant_id", facts.tenantId)
    .eq("operation_key", facts.change.operationId)
    .maybeSingle();
  if (prior.error) throw new Error("Relationship receipt unavailable");
  if (!prior.data && (await previewRadarRelationship(db, facts.change)).digest !== expected)
    throw new Error("Relationship facts changed; preview and approve again");
  const { config } = await workspace(db, !prior.data);
  if (!prior.data && digest(config) !== facts.configRevision)
    throw new Error("Radar configuration changed before dispatch");
  const result = await callRadarRelationshipRpc(db, {
    p_operation_key: facts.change.operationId,
    p_change: facts.change,
    p_expected_edge: facts.edge,
    p_expected_evidence: facts.evidence,
    p_expected_config: config,
    p_actor_email: actorEmail,
  });
  if (result.error) throw new Error(`Radar relationship refused: ${result.error.message}`);
  return result.data;
}
