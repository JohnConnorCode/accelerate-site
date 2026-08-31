import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit } from "./audit";
import { findCanonicalContactByEmail } from "./identity";
import { recordActivity } from "./activities";

export const FOUNDER_NOTE_MAX_LENGTH = 5_000;
export const FOUNDER_NOTE_CAPTURE_SOURCES = ["command_palette", "keyboard_shortcut", "ai_answer", "record_context", "unknown"] as const;
export const FOUNDER_NOTE_KNOWLEDGE_CONTRACT = "founder-knowledge-notes.v1";
export type FounderNoteCaptureSource = (typeof FOUNDER_NOTE_CAPTURE_SOURCES)[number];

export interface CaptureFounderNoteInput {
  requestId: string;
  body: string;
  actorEmail: string;
  contactEmail?: string | null;
  contactId?: string | null;
  companyId?: string | null;
  opportunityId?: string | null;
  captureDurationMs?: number | null;
  captureSource?: FounderNoteCaptureSource;
}

export interface FounderNoteReceipt {
  id: string;
  duplicate: boolean;
  title: string;
  occurredAt: string;
  contactId: string | null;
  companyId: string | null;
  opportunityId: string | null;
  actorEmail: string;
  captureDurationMs: number | null;
  captureSource: FounderNoteCaptureSource;
}

export interface FounderKnowledgeNote {
  id: string;
  title: string;
  body: string;
  author: string;
  occurredAt: string;
  contactId: string | null;
  companyId: string | null;
  opportunityId: string | null;
  sourceReceipt: string;
}

export interface FounderNoteAdoptionReport {
  contract: typeof FOUNDER_NOTE_KNOWLEDGE_CONTRACT;
  generatedAt: string;
  observationDays: number;
  noteCount: number;
  measuredCount: number;
  activeDays: number;
  medianCaptureMs: number | null;
  fastCaptureCount: number;
  attachedCount: number;
  standaloneCount: number;
  retrievableCount: number;
  speedEvidenceReady: boolean;
  founderUsefulnessConfirmed: boolean;
  cardReady: boolean;
  reasons: string[];
}

interface FounderNoteQueryFilter {
  contactId?: string;
  companyId?: string;
  opportunityId?: string;
  before?: string;
  limit?: number;
}

const NOTE_COLUMNS = "id,title,summary,actor_email,occurred_at,contact_id,company_id,opportunity_id,external_id,metadata";

function captureMetadata(value: unknown): { durationMs: number | null; source: FounderNoteCaptureSource } {
  const metadata = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const duration = typeof metadata.capture_duration_ms === "number" && Number.isFinite(metadata.capture_duration_ms)
    ? Math.max(0, Math.trunc(metadata.capture_duration_ms))
    : null;
  const source = typeof metadata.capture_source === "string" && FOUNDER_NOTE_CAPTURE_SOURCES.includes(metadata.capture_source as FounderNoteCaptureSource)
    ? metadata.capture_source as FounderNoteCaptureSource
    : "unknown";
  return { durationMs: duration, source };
}

function receiptFromRow(row: Record<string, unknown>, duplicate: boolean): FounderNoteReceipt {
  const capture = captureMetadata(row.metadata);
  return {
    id: String(row.id),
    duplicate,
    title: String(row.title),
    occurredAt: String(row.occurred_at),
    contactId: typeof row.contact_id === "string" ? row.contact_id : null,
    companyId: typeof row.company_id === "string" ? row.company_id : null,
    opportunityId: typeof row.opportunity_id === "string" ? row.opportunity_id : null,
    actorEmail: typeof row.actor_email === "string" ? row.actor_email : "unknown",
    captureDurationMs: capture.durationMs,
    captureSource: capture.source,
  };
}

function noteTitle(body: string): string {
  const firstLine = body.split(/\r?\n/, 1)[0]?.trim() || "Founder note";
  return firstLine.length > 120 ? `${firstLine.slice(0, 117)}…` : firstLine;
}

async function ensureFounderNoteAudit(
  supabase: SupabaseClient,
  note: Record<string, unknown>,
  input: Pick<CaptureFounderNoteInput, "actorEmail" | "requestId">,
): Promise<void> {
  const { data, error } = await supabase.from("audit_log").select("id")
    .eq("action", "founder_note_created")
    .eq("entity_type", "activity")
    .eq("entity_id", String(note.id))
    .maybeSingle();
  if (error) throw new Error(`Audit receipt lookup failed: ${error.message}`);
  if (data) return;
  await recordAudit(supabase, {
    actorEmail: input.actorEmail,
    action: "founder_note_created",
    entityType: "activity",
    entityId: String(note.id),
    source: "admin",
    after: {
      activityType: "founder_note",
      title: String(note.title),
      contactId: note.contact_id ?? null,
      companyId: note.company_id ?? null,
      opportunityId: note.opportunity_id ?? null,
    },
    metadata: { request_id: input.requestId },
  });
}

export async function captureFounderNote(supabase: SupabaseClient, input: CaptureFounderNoteInput): Promise<FounderNoteReceipt> {
  const body = input.body.trim();
  if (!body) throw new Error("Write something before saving the note");
  if (body.length > FOUNDER_NOTE_MAX_LENGTH) throw new Error(`Notes are limited to ${FOUNDER_NOTE_MAX_LENGTH.toLocaleString()} characters`);
  if (!input.requestId.trim()) throw new Error("A note request ID is required");
  if (input.captureDurationMs !== undefined && input.captureDurationMs !== null && (!Number.isFinite(input.captureDurationMs) || input.captureDurationMs < 0 || input.captureDurationMs > 3_600_000)) {
    throw new Error("Capture duration must be between zero and one hour");
  }
  const captureSource = input.captureSource ?? "unknown";
  if (!FOUNDER_NOTE_CAPTURE_SOURCES.includes(captureSource)) throw new Error("Capture source is not recognized");

  const externalId = `founder-note:${input.requestId.trim()}`;
  const { data: existing, error: existingError } = await supabase.from("activities")
    .select(NOTE_COLUMNS)
    .eq("source", "admin_note")
    .eq("external_id", externalId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) {
    await ensureFounderNoteAudit(supabase, existing as Record<string, unknown>, input);
    return receiptFromRow(existing as Record<string, unknown>, true);
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
    metadata: {
      note_version: 2,
      capture_source: captureSource,
      ...(input.captureDurationMs === undefined || input.captureDurationMs === null
        ? {}
        : { capture_duration_ms: Math.trunc(input.captureDurationMs) }),
    },
  });
  const note = receipt.activity;

  await ensureFounderNoteAudit(supabase, note as unknown as Record<string, unknown>, input);

  return receiptFromRow(note as unknown as Record<string, unknown>, receipt.duplicate);
}

/**
 * Bounded reader for future knowledge workflows. It reads the canonical
 * activity receipts directly, preserving author, date, and exact attachment;
 * no parallel note index is introduced here.
 */
export async function loadFounderKnowledgeNotes(
  supabase: SupabaseClient,
  filter: FounderNoteQueryFilter = {},
): Promise<FounderKnowledgeNote[]> {
  const limit = Math.min(100, Math.max(1, Math.trunc(filter.limit ?? 25)));
  let query = supabase.from("activities").select(NOTE_COLUMNS)
    .eq("activity_type", "founder_note")
    .eq("source", "admin_note");
  if (filter.contactId) query = query.eq("contact_id", filter.contactId);
  if (filter.companyId) query = query.eq("company_id", filter.companyId);
  if (filter.opportunityId) query = query.eq("opportunity_id", filter.opportunityId);
  if (filter.before) {
    if (Number.isNaN(Date.parse(filter.before))) throw new Error("Founder note cursor is invalid");
    query = query.lt("occurred_at", new Date(filter.before).toISOString());
  }
  const { data, error } = await query.order("occurred_at", { ascending: false }).order("id", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    if (typeof row.summary !== "string" || !row.summary.trim() || typeof row.actor_email !== "string" || Number.isNaN(Date.parse(String(row.occurred_at)))) {
      throw new Error("Founder note provenance is incomplete");
    }
    return {
      id: String(row.id),
      title: String(row.title),
      body: row.summary,
      author: row.actor_email,
      occurredAt: new Date(String(row.occurred_at)).toISOString(),
      contactId: typeof row.contact_id === "string" ? row.contact_id : null,
      companyId: typeof row.company_id === "string" ? row.company_id : null,
      opportunityId: typeof row.opportunity_id === "string" ? row.opportunity_id : null,
      sourceReceipt: String(row.external_id),
    };
  });
}

/** Privacy-safe adoption evidence: this query never selects note title/body. */
export async function loadFounderNoteAdoptionReport(
  supabase: SupabaseClient,
  options: { now?: Date; founderUsefulnessConfirmed?: boolean } = {},
): Promise<FounderNoteAdoptionReport> {
  const now = options.now ?? new Date();
  const { data, error } = await supabase.from("activities")
    .select("id,actor_email,occurred_at,contact_id,company_id,opportunity_id,metadata")
    .eq("activity_type", "founder_note")
    .eq("source", "admin_note")
    .order("occurred_at", { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const measured = rows.map((row) => ({ row, capture: captureMetadata(row.metadata) })).filter((entry) => entry.capture.durationMs !== null);
  const durations = measured.map((entry) => entry.capture.durationMs as number).sort((left, right) => left - right);
  const medianCaptureMs = durations.length ? durations[Math.floor((durations.length - 1) / 2)]! : null;
  const firstMeasuredAt = measured.length ? Date.parse(String(measured[0]!.row.occurred_at)) : Number.NaN;
  const observationDays = Number.isFinite(firstMeasuredAt) ? Math.max(0, (now.getTime() - firstMeasuredAt) / 86_400_000) : 0;
  const activeDays = new Set(measured.map((entry) => String(entry.row.occurred_at).slice(0, 10))).size;
  const fastCaptureCount = durations.filter((duration) => duration <= 10_000).length;
  const speedEvidenceReady = observationDays >= 7 && measured.length >= 3 && activeDays >= 3 && medianCaptureMs !== null && medianCaptureMs <= 10_000;
  const founderUsefulnessConfirmed = options.founderUsefulnessConfirmed === true;
  const reasons = [
    observationDays < 7 && "Seven days have not elapsed since the first measured capture.",
    measured.length < 3 && "At least three measured founder captures are required.",
    activeDays < 3 && "Measured captures must span at least three distinct days.",
    medianCaptureMs !== null && medianCaptureMs > 10_000 && "Median open-to-save time is above ten seconds.",
    !founderUsefulnessConfirmed && "Founder usefulness confirmation is still required.",
  ].filter(Boolean) as string[];
  const attachedCount = rows.filter((row) => row.contact_id || row.company_id || row.opportunity_id).length;
  return {
    contract: FOUNDER_NOTE_KNOWLEDGE_CONTRACT,
    generatedAt: now.toISOString(),
    observationDays: Number(observationDays.toFixed(2)),
    noteCount: rows.length,
    measuredCount: measured.length,
    activeDays,
    medianCaptureMs,
    fastCaptureCount,
    attachedCount,
    standaloneCount: rows.length - attachedCount,
    retrievableCount: rows.filter((row) => typeof row.actor_email === "string" && !Number.isNaN(Date.parse(String(row.occurred_at)))).length,
    speedEvidenceReady,
    founderUsefulnessConfirmed,
    cardReady: speedEvidenceReady && founderUsefulnessConfirmed,
    reasons,
  };
}
