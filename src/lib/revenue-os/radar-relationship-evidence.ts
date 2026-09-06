import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import { findCanonicalContactByEmail } from "./identity";
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
const messageSchema = z.object({
  id: z.uuid(),
  conversation_id: z.uuid(),
  direction: z.enum(["inbound", "outbound"]),
  sender_email: z.string().nullable(),
  status: z.string(),
  body_excerpt: z.string().max(20000),
  body_hash: z.string().regex(/^[a-f0-9]{64}$/),
  created_at: z.string(),
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
  const read = await db
    .from("message_evidence_context")
    .select("id,conversation_id,direction,sender_email,status,body_excerpt,body_hash,created_at")
    .eq("tenant_id", tenantId)
    .eq("id", r.evidence.messageId)
    .single();
  if (read.error || !read.data) throw new Error("Introduction message evidence unavailable");
  const message = messageSchema.parse(read.data);
  if (message.direction !== "inbound" || message.status !== "received" || !message.sender_email)
    throw new Error("An introduction offer needs an identified, received inbound message");
  const conversation = await db
    .from("conversations")
    .select("id,contact_id,subject")
    .eq("tenant_id", tenantId)
    .eq("id", message.conversation_id)
    .single();
  if (conversation.error || conversation.data?.contact_id !== r.fromContactId)
    throw new Error("The cited conversation must be linked to the introducing contact");
  const sender = await findCanonicalContactByEmail(db, message.sender_email);
  if (sender?.id !== r.fromContactId)
    throw new Error(
      "Message author identity is unavailable or does not match the canonical contact; resolve identity first",
    );
  const snapshot: RadarRelationshipEvidenceSnapshot = {
    kind: "message",
    id: message.id,
    contentHash: message.body_hash,
    revision: null,
    verification: message.status,
    conversationId: message.conversation_id,
    contactId: r.fromContactId,
    senderEmail: message.sender_email,
  };
  return {
    snapshot,
    text: message.body_excerpt,
    title: String(conversation.data.subject ?? "Canonical conversation"),
    url: null,
    conversationId: message.conversation_id,
  };
}
