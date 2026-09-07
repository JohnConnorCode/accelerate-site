import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import { readInboundContactEvidence } from "./conversations";
import type { RadarRelationship } from "./radar-relationship-contract";

const sourceSchema = z.object({
  id: z.uuid(),
  source_id: z.uuid(),
  title: z.string().max(300),
  body_text: z.string().max(20000),
  content_hash: z.string().regex(/^[a-f0-9]{64}$/),
  revision: z.number().int().positive(),
  verification: z.enum(["supplied", "verified", "retracted"]),
});
export type RadarRelationshipEvidenceSnapshot = {
  kind: "source" | "message";
  id: string;
  contentHash: string;
  revision: number | null;
  verification: string;
  conversationId: string | null;
  contactId: string | null;
  senderEmail: string | null;
};
/** Bounded evidence only; never fetches a supplied URL or resolves a person by name. */
export async function readRadarRelationshipEvidence(db: SupabaseClient, r: RadarRelationship) {
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("Relationship evidence requires an explicit workspace");
  if (r.evidence.kind === "source") {
    const read = await db
      .from("radar_source_versions")
      .select("id,source_id,title,body_text,content_hash,revision,verification")
      .eq("tenant_id", tenantId)
      .eq("id", r.evidence.sourceVersionId)
      .single();
    if (read.error || !read.data) throw new Error("Relationship source unavailable");
    const source = sourceSchema.parse(read.data);
    if (source.verification !== "verified")
      throw new Error("Review the source before confirming a relationship assertion");
    const reference = await db
      .from("radar_sources")
      .select("canonical_url")
      .eq("tenant_id", tenantId)
      .eq("id", source.source_id)
      .single();
    if (reference.error || typeof reference.data?.canonical_url !== "string")
      throw new Error("Relationship source reference unavailable");
    const snapshot: RadarRelationshipEvidenceSnapshot = {
      kind: "source",
      id: source.id,
      contentHash: source.content_hash,
      revision: source.revision,
      verification: source.verification,
      conversationId: null,
      contactId: null,
      senderEmail: null,
    };
    return {
      snapshot,
      text: source.body_text,
      title: source.title,
      url: reference.data.canonical_url,
      conversationId: null,
    };
  }
  if (r.kind !== "introduction_offer")
    throw new Error("Message evidence is reserved for explicit introduction offers");
  return readInboundContactEvidence(db, {
    contactId: r.fromContactId,
    messageId: r.evidence.messageId,
  });
}
