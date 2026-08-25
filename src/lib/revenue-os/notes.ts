import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit } from "./audit";
import { findCanonicalContactByEmail } from "./identity";
import { recordActivity } from "./activities";

export const FOUNDER_NOTE_MAX_LENGTH = 5_000;

export interface CaptureFounderNoteInput {
  requestId: string;
  body: string;
  actorEmail: string;
  contactEmail?: string | null;
  contactId?: string | null;
  companyId?: string | null;
  opportunityId?: string | null;
}

export interface FounderNoteReceipt {
  id: string;
  duplicate: boolean;
  title: string;
  occurredAt: string;
  contactId: string | null;
  companyId: string | null;
  opportunityId: string | null;
}

function noteTitle(body: string): string {
  const firstLine = body.split(/\r?\n/, 1)[0]?.trim() || "Founder note";
  return firstLine.length > 120 ? `${firstLine.slice(0, 117)}…` : firstLine;
}

export async function captureFounderNote(supabase: SupabaseClient, input: CaptureFounderNoteInput): Promise<FounderNoteReceipt> {
  const body = input.body.trim();
  if (!body) throw new Error("Write something before saving the note");
  if (body.length > FOUNDER_NOTE_MAX_LENGTH) throw new Error(`Notes are limited to ${FOUNDER_NOTE_MAX_LENGTH.toLocaleString()} characters`);
  if (!input.requestId.trim()) throw new Error("A note request ID is required");

  const externalId = `founder-note:${input.requestId.trim()}`;
  const { data: existing, error: existingError } = await supabase.from("activities")
    .select("id,title,occurred_at,contact_id,company_id,opportunity_id")
    .eq("source", "admin_note")
    .eq("external_id", externalId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) {
    return {
      id: existing.id,
      duplicate: true,
      title: existing.title,
      occurredAt: existing.occurred_at,
      contactId: existing.contact_id ?? null,
      companyId: existing.company_id ?? null,
      opportunityId: existing.opportunity_id ?? null,
    };
  }

  let contactId = input.contactId ?? null;
  let companyId = input.companyId ?? null;
  const opportunityId = input.opportunityId ?? null;

  if (input.contactEmail) {
    const contact = await findCanonicalContactByEmail(supabase, input.contactEmail);
    if (!contact) throw new Error("No canonical contact matches that email");
    if (contactId && contactId !== contact.id) throw new Error("The selected contact does not match the supplied contact ID");
    contactId = contact.id;
  }

  if (opportunityId) {
    const { data: opportunity, error } = await supabase.from("opportunities")
      .select("id,contact_id,company_id")
      .eq("id", opportunityId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!opportunity) throw new Error("The selected opportunity no longer exists");
    if (contactId && opportunity.contact_id && contactId !== opportunity.contact_id) throw new Error("The selected contact and opportunity do not match");
    if (companyId && opportunity.company_id && companyId !== opportunity.company_id) throw new Error("The selected company and opportunity do not match");
    contactId = contactId ?? opportunity.contact_id ?? null;
    companyId = companyId ?? opportunity.company_id ?? null;
  }

  if (contactId && !companyId) {
    const { data: contact, error } = await supabase.from("contacts").select("id,company_id").eq("id", contactId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!contact) throw new Error("The selected contact no longer exists");
    companyId = contact.company_id ?? null;
  }

  const title = noteTitle(body);
  const occurredAt = new Date().toISOString();
  const receipt = await recordActivity(supabase, {
    activityType: "founder_note",
    title,
    summary: body,
    contactId,
    companyId,
    opportunityId,
    source: "admin_note",
    actorEmail: input.actorEmail,
    externalId,
    occurredAt,
    metadata: { note_version: 1 },
  });
  const note = receipt.activity;

  if (!receipt.duplicate) await recordAudit(supabase, {
    actorEmail: input.actorEmail,
    action: "founder_note_created",
    entityType: "activity",
    entityId: note.id,
    source: "admin",
    after: { activityType: "founder_note", title, contactId, companyId, opportunityId },
    metadata: { request_id: input.requestId },
  });

  return { id: note.id, duplicate: receipt.duplicate, title: note.title, occurredAt: note.occurred_at, contactId: note.contact_id ?? null, companyId: note.company_id ?? null, opportunityId: note.opportunity_id ?? null };
}
