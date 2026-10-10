import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  tenantIdForDatabase,
  callDebateMilestoneHostRpc,
  callDebateProductionHostRpc,
} from "@/lib/supabase/server";
import { proposeAction } from "./actions";
import { verifyDebateCalendarEvent } from "./google";
import {
  debateMilestoneSchema,
  nextDebateAction,
  type DebateMilestone,
  type DebateMilestoneStatus,
} from "./debate-booking-contract";
export { debateMilestoneSchema } from "./debate-booking-contract";

const createSchema = z.object({
  requestKey: z.string().trim().min(8).max(180),
  title: z.string().trim().min(3).max(240),
  leadContactId: z.uuid(),
  counterpartContactId: z.uuid().nullable().optional(),
  conversationId: z.uuid().nullable().optional(),
  targetAt: z.iso.datetime({ offset: true }).nullable().optional(),
});
export async function createDebateProduction(db: SupabaseClient, raw: unknown, actorEmail: string) {
  const input = createSchema.parse(raw);
  const { data, error } = await callDebateProductionHostRpc(db, "create", input, actorEmail);
  if (error || !data) throw new Error(error?.message ?? "Could not create debate production");
  return data;
}

export async function updateDebateProduction(db: SupabaseClient, raw: unknown, actorEmail: string) {
  const input = createSchema
    .pick({ counterpartContactId: true, conversationId: true, targetAt: true })
    .extend({ productionId: z.uuid(), expectedRevision: z.number().int().min(0) })
    .parse(raw);
  const { data, error } = await callDebateProductionHostRpc(db, "update", input, actorEmail);
  if (error || !data) throw new Error(error?.message ?? "Could not update debate production");
  return data;
}

export async function recordDebateMilestone(db: SupabaseClient, raw: unknown, actorEmail: string) {
  const input = debateMilestoneSchema.parse(raw);
  if (input.sourceType === "founder_confirmation" && input.sourceId !== actorEmail)
    throw new Error("Founder confirmation must identify the reviewer");
  const { data, error } = await callDebateMilestoneHostRpc(db, {
    p_production_id: input.productionId,
    p_milestone: input.milestone,
    p_status: input.status,
    p_value: input.value,
    p_source_type: input.sourceType,
    p_source_id: input.sourceId,
    p_observed_at: input.observedAt,
    p_actor_email: actorEmail,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function loadDebateProduction(db: SupabaseClient, id: string) {
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("Debate booking requires an explicit workspace");
  const production = await db
    .from("debate_productions")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  if (production.error || !production.data) throw new Error("Debate production is unavailable");
  const row = production.data;
  const [contacts, milestones, event] = await Promise.all([
    db
      .from("contacts")
      .select("id,full_name,primary_email")
      .eq("tenant_id", tenantId)
      .in("id", [row.lead_contact_id, row.counterpart_contact_id].filter(Boolean)),
    db.from("debate_milestones").select("*").eq("tenant_id", tenantId).eq("production_id", id),
    row.calendar_event_id
      ? db
          .from("calendar_events")
          .select("id,external_id,status,attendees,metadata,synced_at,html_link,start_at,end_at")
          .eq("tenant_id", tenantId)
          .eq("id", row.calendar_event_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (contacts.error || milestones.error || event.error)
    throw new Error("Debate evidence could not be loaded");
  const contactRows = contacts.data ?? [];
  const milestoneRows = milestones.data ?? [];
  const claimIds = milestoneRows.map((milestone) => milestone.claim_id);
  const claims = claimIds.length
    ? await db.from("claims").select("id,status").eq("tenant_id", tenantId).in("id", claimIds)
    : { data: [], error: null };
  if (claims.error) throw new Error("Debate claim status could not be loaded");
  const claimStatus = new Map((claims.data ?? []).map((claim) => [claim.id, claim.status]));
  const state = Object.fromEntries(
    milestoneRows.map((milestone) => [
      milestone.milestone,
      claimStatus.get(milestone.claim_id) === "verified" ? milestone.status : "proposed",
    ]),
  ) as Partial<Record<DebateMilestone, DebateMilestoneStatus>>;
  const participantEmails = [row.lead_contact_id, row.counterpart_contact_id]
    .map((contactId) => contactRows.find((contact) => contact.id === contactId)?.primary_email)
    .filter((email): email is string => Boolean(email));
  const calendar = event.data;
  const nextAction = nextDebateAction({
    milestones: state,
    participantEmails,
    event: calendar
      ? {
          status: calendar.status,
          attendees: Array.isArray(calendar.attendees) ? calendar.attendees : [],
          fresh:
            Date.parse(calendar.metadata?.debate_verified_at ?? "") >
            Date.now() - 24 * 60 * 60 * 1000,
          integrity:
            calendar.metadata?.debate_integrity === "verified" &&
            Date.parse(calendar.start_at ?? "") === Date.parse(row.target_at ?? "") &&
            (calendar.metadata?.organizer?.self === true ||
              calendar.metadata?.organizer?.email?.toLowerCase() ===
                calendar.metadata?.debate_expected_organizer?.toLowerCase()),
          conferenceReady:
            calendar.metadata?.debate_conference_required !== true ||
            calendar.metadata?.debate_conference_ready === true,
        }
      : null,
  });
  return {
    production: row,
    contacts: contactRows,
    milestones: milestoneRows,
    claims: claims.data ?? [],
    calendar,
    nextAction,
  };
}

export async function listDebateProductions(db: SupabaseClient, limit = 30) {
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("Debate booking requires an explicit workspace");
  const { data, error } = await db
    .from("debate_productions")
    .select("id")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false })
    .limit(Math.min(30, Math.max(1, limit)));
  if (error) throw new Error(error.message);
  return Promise.all((data ?? []).map((row) => loadDebateProduction(db, row.id)));
}

export async function refreshDebateInvitation(db: SupabaseClient, productionId: string) {
  const booking = await loadDebateProduction(db, z.uuid().parse(productionId));
  if (!booking.calendar || !booking.production.calendar_event_id)
    throw new Error("This production has no linked invitation");
  const emails = [booking.production.lead_contact_id, booking.production.counterpart_contact_id]
    .map((id) => booking.contacts.find((contact) => contact.id === id)?.primary_email)
    .filter((email): email is string => Boolean(email));
  if (emails.length !== 2 || !booking.production.target_at)
    throw new Error("Participant addresses or approved date are missing");
  return verifyDebateCalendarEvent(db, {
    calendarEventId: booking.production.calendar_event_id,
    participantEmails: emails,
    startAt: booking.production.target_at,
  });
}

export async function reopenCancelledDebateInvitation(
  db: SupabaseClient,
  productionId: string,
  expectedRevision: number,
  actorEmail: string,
) {
  const { data, error } = await callDebateProductionHostRpc(
    db,
    "reopen_cancelled_invitation",
    {
      productionId: z.uuid().parse(productionId),
      expectedRevision: z.number().int().min(0).parse(expectedRevision),
    },
    actorEmail,
  );
  if (error || !data) throw new Error(error?.message ?? "Could not reopen canceled invitation");
  return data;
}

async function milestoneSource(db: SupabaseClient, input: z.infer<typeof debateMilestoneSchema>) {
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("Milestone source requires an explicit workspace");
  if (input.sourceType === "gmail_message") {
    const { data, error } = await db
      .from("messages")
      .select("id,body_text,sender_email,received_at,conversation_id,direction")
      .eq("tenant_id", tenantId)
      .eq("id", input.sourceId)
      .maybeSingle();
    if (error || !data?.body_text) throw new Error("Gmail evidence is unavailable");
    return {
      kind: "gmail_message" as const,
      text: data.body_text,
      observedAt: data.received_at,
      source: data,
    };
  }
  if (input.sourceType === "drive_document") {
    const { data, error } = await db
      .from("drive_documents")
      .select("id,name,extracted_text,modified_at,synced_at,web_view_link")
      .eq("tenant_id", tenantId)
      .eq("id", input.sourceId)
      .maybeSingle();
    if (error || !data?.extracted_text) throw new Error("Drive transcript text is unavailable");
    return {
      kind: "drive_document" as const,
      text: data.extracted_text,
      observedAt: data.modified_at,
      source: data,
    };
  }
  throw new Error("Agent booking proposals require a Gmail message or indexed Drive transcript");
}

function sourceDigest(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

function googleDocumentHref(value: string | null | undefined) {
  if (!value || !URL.canParse(value)) return null;
  const url = new URL(value);
  return url.protocol === "https:" &&
    (url.hostname === "google.com" || url.hostname.endsWith(".google.com"))
    ? url.toString()
    : null;
}

/** Prepare a sourced booking assertion. Approval is the human confirmation. */
export async function proposeDebateMilestone(db: SupabaseClient, raw: unknown, actorEmail: string) {
  const input = debateMilestoneSchema.parse(raw);
  if (input.milestone === "invitation")
    throw new Error("Invitation status comes from a verified Google Calendar receipt");
  const booking = await loadDebateProduction(db, input.productionId);
  const source = await milestoneSource(db, input);
  if (
    source.kind === "gmail_message" &&
    input.status === "verified" &&
    ["topic_interest", "counterpart", "perspective", "format", "date"].includes(input.milestone)
  ) {
    const participantEmails = new Set(
      booking.contacts.map((contact) => contact.primary_email?.toLowerCase()),
    );
    if (
      source.source.direction !== "inbound" ||
      !participantEmails.has(source.source.sender_email?.toLowerCase())
    )
      throw new Error(
        "A confirmed participant commitment needs an inbound message from that participant",
      );
  }
  const hash = sourceDigest(source.text);
  const proposal = {
    ...input,
    observedAt: source.observedAt ?? input.observedAt,
    sourceHash: hash,
    productionRevision: booking.production.revision,
  };
  return proposeAction(db, {
    actionType: "record_debate_milestone",
    title: `${booking.production.title}: ${input.milestone.replaceAll("_", " ")} ${input.status}`,
    description: input.value,
    urgency: "normal",
    payload: proposal,
    reasoning: `Review the cited ${input.sourceType.replaceAll("_", " ")} before confirming this commitment.`,
    sourceContext: "admin_ai",
    entityType: "debate_production",
    entityId: input.productionId,
    dedupeKey: `debate-milestone:${input.productionId}:${input.milestone}:${sourceDigest(JSON.stringify(proposal))}`,
    proposedBy: actorEmail,
    expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    evidence: {
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      observedAt: source.observedAt,
      excerpt: source.text.slice(0, 1000),
      sourceHref:
        source.kind === "gmail_message"
          ? `/admin/conversations?thread=${source.source.conversation_id}`
          : googleDocumentHref(source.source.web_view_link),
    },
  });
}

export async function executeProposedDebateMilestone(
  db: SupabaseClient,
  raw: unknown,
  actorEmail: string,
) {
  const input = debateMilestoneSchema
    .extend({
      sourceHash: z.string().length(64),
      productionRevision: z.number().int().min(0),
    })
    .parse(raw);
  if (input.milestone === "invitation") throw new Error("Invitation needs a provider receipt");
  const booking = await loadDebateProduction(db, input.productionId);
  if (booking.production.revision !== input.productionRevision)
    throw new Error("Debate production changed after approval; prepare a new commitment");
  const source = await milestoneSource(db, input);
  if (
    sourceDigest(source.text) !== input.sourceHash ||
    (source.observedAt && source.observedAt !== input.observedAt)
  )
    throw new Error("Booking source changed after approval; prepare a new milestone");
  if (
    source.kind === "gmail_message" &&
    input.status === "verified" &&
    ["topic_interest", "counterpart", "perspective", "format", "date"].includes(input.milestone)
  ) {
    const participantEmails = new Set(
      booking.contacts.map((contact) => contact.primary_email?.toLowerCase()),
    );
    if (
      source.source.direction !== "inbound" ||
      !participantEmails.has(source.source.sender_email?.toLowerCase())
    )
      throw new Error("The cited commitment is no longer from a current participant");
  }
  return recordDebateMilestone(db, input, actorEmail);
}
