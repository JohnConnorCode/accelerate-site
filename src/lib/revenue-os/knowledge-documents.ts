import "server-only";
import { z } from "zod";
import { proposeAction } from "./actions";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import { createWorkItem } from "./work-items";
import { registerWorkKindHandler } from "./work-executor";
import { recordAudit } from "./audit";
import { DOCUMENT_MAX_BYTES, DOCUMENT_MIME_TYPES, extractDocument } from "./document-extraction";

const BUCKET = "workspace-knowledge";
const COLUMNS =
  "id,title,mime_type,content_hash,status,extraction_error,created_at,indexed_at,owner_email";
export async function listKnowledgeDocuments(db: SupabaseClient) {
  const { data, error } = await db
    .from("knowledge_documents")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Documents could not be loaded");
  return data ?? [];
}
export async function queueDocumentIndex(db: SupabaseClient, id: string, actor: string) {
  const { data, error } = await db
    .from("knowledge_documents")
    .select("id,title,status,content_hash")
    .eq("id", id)
    .single();
  if (error || !data || data.status === "archived") throw new Error("Document is unavailable");
  if (data.status === "indexed") return { documentId: id, alreadyIndexed: true };
  const result = await createWorkItem(db, {
    kind: "index_knowledge_document",
    objective: `Index ${data.title}`,
    reason: "Extract uploaded reference text for cited workspace retrieval",
    source: "knowledge-upload",
    entityType: "knowledge_document",
    entityId: id,
    dedupeKey: `knowledge-index:${id}:${data.content_hash}`,
    actorEmail: actor,
  });
  return { documentId: id, workItemId: result.workItem.id, alreadyIndexed: false };
}
export async function uploadKnowledgeDocument(
  db: SupabaseClient,
  input: { title: string; mime: string; bytes: Uint8Array; actor: string },
) {
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("Upload requires a tenant workspace");
  if (
    !input.title.trim() ||
    input.title.length > 240 ||
    !input.bytes.length ||
    input.bytes.length > DOCUMENT_MAX_BYTES ||
    !DOCUMENT_MIME_TYPES.includes(input.mime as (typeof DOCUMENT_MIME_TYPES)[number])
  )
    throw new Error("Upload PDF, DOCX, plain text or Markdown up to 4 MB");
  const hash = createHash("sha256").update(input.bytes).digest("hex");
  const path = `${tenantId}/${hash}`;
  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(path, input.bytes, { contentType: input.mime, upsert: false });
  if (uploadError && !("statusCode" in uploadError && String(uploadError.statusCode) === "409"))
    throw new Error("The document could not be stored privately");
  const { error } = await db.from("knowledge_documents").upsert(
    {
      title: input.title.trim(),
      mime_type: input.mime,
      content_hash: hash,
      storage_path: path,
      owner_email: input.actor,
      tenant_id: tenantId,
    },
    { onConflict: "tenant_id,content_hash", ignoreDuplicates: true },
  );
  if (error) throw new Error("Document stored but registration failed; retry the same upload");
  const { data, error: readError } = await db
    .from("knowledge_documents")
    .select("id,status")
    .eq("content_hash", hash)
    .single();
  if (readError || !data) throw new Error("Document registration could not be verified");
  if (data.status === "archived")
    throw new Error("This document was archived; retain its history and upload a revised document");
  const receipt = await queueDocumentIndex(db, String(data.id), input.actor);
  await recordAudit(db, {
    actorEmail: input.actor,
    action: "knowledge.uploaded",
    entityType: "knowledge_document",
    entityId: String(data.id),
    metadata: { contentHash: hash, mime: input.mime },
  });
  return receipt;
}
export async function archiveKnowledgeDocument(db: SupabaseClient, id: string, actor: string) {
  const { data, error } = await db
    .from("knowledge_documents")
    .update({ status: "archived" })
    .eq("id", id)
    .select("id")
    .single();
  if (error || !data) throw new Error("Document could not be archived");
  await recordAudit(db, {
    actorEmail: actor,
    action: "knowledge.archived",
    entityType: "knowledge_document",
    entityId: id,
  });
  return { id, status: "archived" };
}
export function registerKnowledgeHandlers() {
  registerWorkKindHandler("index_knowledge_document", async (db, item, signal) => {
    const id = item.entity_id;
    if (!id || item.entity_type !== "knowledge_document")
      throw new Error("Document work has no source reference");
    const { data: document, error } = await db
      .from("knowledge_documents")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !document) throw new Error("Document is unavailable");
    if (document.status === "archived")
      return { status: "skipped", outcome: "Document was archived" };
    if (document.status === "indexed")
      return { status: "completed", outcome: "Document revision already indexed" };
    try {
      const { data: file, error: downloadError } = await db.storage
        .from(BUCKET)
        .download(document.storage_path);
      if (downloadError || !file) throw new Error("Private document could not be read");
      if (file.size > DOCUMENT_MAX_BYTES) throw new Error("Stored document exceeds the size limit");
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (createHash("sha256").update(bytes).digest("hex") !== document.content_hash)
        throw new Error("Document revision changed; upload it again");
      const extracted = await extractDocument(bytes, document.mime_type, signal);
      signal?.throwIfAborted();
      const { data: saved, error: saveError } = await db
        .from("knowledge_documents")
        .update({
          extracted_text: extracted.text,
          locations: extracted.locations,
          status: "indexed",
          extraction_error: null,
          indexed_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("content_hash", document.content_hash)
        .neq("status", "archived")
        .select("id")
        .maybeSingle();
      if (saveError) throw new Error("Extracted text could not be saved");
      if (!saved)
        return { status: "skipped", outcome: "Document changed or was archived during extraction" };
      return {
        status: "completed",
        outcome: "Document text indexed for cited retrieval",
        value: {
          documentId: id,
          revision: document.content_hash,
          locations: extracted.locations.length,
        },
      };
    } catch (error) {
      signal?.throwIfAborted();
      const message = error instanceof Error ? error.message : "Document extraction failed";
      const { error: saveError } = await db
        .from("knowledge_documents")
        .update({ status: "failed", extraction_error: message.slice(0, 500) })
        .eq("id", id)
        .in("status", ["pending", "failed"]);
      if (saveError) throw new Error("Extraction failed and its status could not be saved");
      return { status: "failed", outcome: message };
    }
  });
}

export const knowledgeChangeSchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("add_text"),
      title: z.string().trim().min(1).max(240),
      text: z.string().trim().min(1).max(50000),
    })
    .strict(),
  z
    .object({
      operation: z.enum(["retry", "archive"]),
      id: z.string().uuid(),
      revision: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict(),
]);
export async function proposeKnowledgeChange(db: SupabaseClient, raw: unknown, actor: string) {
  const change = knowledgeChangeSchema.parse(raw);
  if (change.operation !== "add_text") {
    const { data, error } = await db
      .from("knowledge_documents")
      .select("id")
      .eq("id", change.id)
      .eq("content_hash", change.revision)
      .maybeSingle();
    if (error || !data) throw new Error("Document revision is unavailable");
  }
  return proposeAction(db, {
    actionType: "knowledge_document_change",
    title:
      change.operation === "add_text"
        ? `Add workspace reference: ${change.title}`
        : `${change.operation === "archive" ? "Archive" : "Retry indexing"} workspace document`,
    payload: change,
    proposedBy: actor,
    sourceContext: "knowledge",
    dedupeKey: `knowledge-change:${createHash("sha256").update(JSON.stringify(change)).digest("hex")}`,
  });
}
export async function executeKnowledgeChange(db: SupabaseClient, raw: unknown, actor: string) {
  const change = knowledgeChangeSchema.parse(raw);
  if (change.operation === "add_text")
    return uploadKnowledgeDocument(db, {
      title: change.title,
      mime: "text/plain",
      bytes: new TextEncoder().encode(change.text),
      actor,
    });
  const { data, error } = await db
    .from("knowledge_documents")
    .select("id")
    .eq("id", change.id)
    .eq("content_hash", change.revision)
    .maybeSingle();
  if (error || !data) throw new Error("Document revision changed; review a new proposal");
  return change.operation === "archive"
    ? archiveKnowledgeDocument(db, change.id, actor)
    : queueDocumentIndex(db, change.id, actor);
}
