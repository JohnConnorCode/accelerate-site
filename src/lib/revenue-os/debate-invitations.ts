import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { tenantIdForDatabase, callDebateProductionHostRpc } from "@/lib/supabase/server";
import { proposeAction } from "./actions";
import { loadDebateProduction, recordDebateMilestone } from "./debate-bookings";
import { createVerifiedCalendarInvitation, readGmailReplyTarget } from "./google";

export const debateInvitationSchema = z.object({
  productionId: z.uuid(),
  expectedRevision: z.number().int().min(0),
  summary: z.string().trim().min(3).max(240),
  description: z.string().trim().min(10).max(4000),
  startAt: z.iso.datetime({ offset: true }),
  endAt: z.iso.datetime({ offset: true }),
  timeZone: z.string().trim().min(3).max(80),
  location: z.string().trim().max(300).nullable().optional(),
  createMeet: z.boolean(),
  acceptanceMessageIds: z.tuple([z.uuid(), z.uuid()]),
});

type Invitation = z.infer<typeof debateInvitationSchema>;
type Acceptance = {
  messageId: string;
  providerMessageId: string;
  conversationId: string;
  sender: string;
  excerpt: string;
  bodyHash: string;
  threadId: string;
  latestMessageId: string;
};

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function verifyInvitationContext(db: SupabaseClient, input: Invitation) {
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("Debate invitation requires an explicit workspace");
  if (
    Date.parse(input.endAt) <= Date.parse(input.startAt) ||
    Date.parse(input.endAt) - Date.parse(input.startAt) > 4 * 60 * 60 * 1000
  )
    throw new Error("Invitation end must follow start by no more than four hours");
  try {
    new Intl.DateTimeFormat("en", { timeZone: input.timeZone });
  } catch {
    throw new Error("Invitation timezone is invalid");
  }
  const booking = await loadDebateProduction(db, input.productionId);
  const row = booking.production;
  if (row.revision !== input.expectedRevision)
    throw new Error("Debate production changed; prepare a new invitation");
  if (
    row.calendar_event_id ||
    booking.milestones.some((item) => item.milestone === "invitation" && item.status === "verified")
  )
    throw new Error("This production already has an invitation; reconcile it before another send");
  if (Date.parse(row.target_at ?? "") !== Date.parse(input.startAt))
    throw new Error("Invitation time differs from the verified debate date");
  const required = [
    "topic_interest",
    "counterpart",
    "proposition",
    "perspective",
    "format",
    "date",
  ];
  const statuses = new Map(booking.milestones.map((item) => [item.milestone, item.status]));
  const claims = new Map(booking.claims.map((item) => [item.id, item.status]));
  const missing = required.find((key) => {
    const milestone = booking.milestones.find((item) => item.milestone === key);
    return (
      !milestone ||
      statuses.get(key) !== "verified" ||
      claims.get(milestone.claim_id) !== "verified"
    );
  });
  if (missing)
    throw new Error(`Verify ${missing.replaceAll("_", " ")} before inviting participants`);
  const contacts = [row.lead_contact_id, row.counterpart_contact_id].map((id) =>
    booking.contacts.find((contact) => contact.id === id),
  );
  const emails = contacts
    .map((contact) => contact?.primary_email?.toLowerCase())
    .filter(Boolean) as string[];
  if (emails.length !== 2 || new Set(emails).size !== 2)
    throw new Error("Both debate participants need distinct verified email addresses");
  const { data: messages, error } = await db
    .from("messages")
    .select("id,external_id,conversation_id,sender_email,body_text,direction,status")
    .eq("tenant_id", tenantId)
    .in("id", input.acceptanceMessageIds);
  if (error || !messages || messages.length !== 2)
    throw new Error("Two participant acceptance messages are required");
  const acceptances: Acceptance[] = [];
  for (let index = 0; index < 2; index++) {
    const email = emails[index]!;
    const message = messages.find((candidate) => candidate.sender_email?.toLowerCase() === email);
    if (
      !message ||
      !input.acceptanceMessageIds.includes(message.id) ||
      message.direction !== "inbound" ||
      !["received", "unread"].includes(message.status) ||
      !message.external_id ||
      !message.body_text?.trim()
    )
      throw new Error(`A current inbound acceptance message from ${email} is required`);
    const live = await readGmailReplyTarget(db, message.conversation_id);
    acceptances.push({
      messageId: message.id,
      providerMessageId: message.external_id,
      conversationId: message.conversation_id,
      sender: email,
      excerpt: message.body_text.trim().slice(0, 500),
      bodyHash: digest(message.body_text.trim()),
      threadId: live.threadId,
      latestMessageId: live.latestMessageId,
    });
  }
  return { booking, emails, acceptances };
}

export async function proposeDebateInvitation(
  db: SupabaseClient,
  raw: unknown,
  actorEmail: string,
) {
  const input = debateInvitationSchema.parse(raw);
  const { booking, emails, acceptances } = await verifyInvitationContext(db, input);
  const fingerprint = digest({ input, emails, acceptances });
  return proposeAction(db, {
    actionType: "create_debate_invitation",
    title: `Invite ${booking.contacts.map((contact) => contact.full_name).join(" and ")} to ${booking.production.title}`,
    description: `Send one Google Calendar invitation for ${input.startAt} to ${emails.join(" and ")}. Review each participant's cited acceptance before approving.`,
    urgency: "high",
    payload: { ...input, attendees: emails, acceptances, fingerprint },
    reasoning:
      "The debate's question, pairing, format and date are verified; both participants have inbound acceptance messages.",
    sourceContext: "admin",
    entityType: "debate_production",
    entityId: input.productionId,
    dedupeKey: `debate-invitation:${input.productionId}:${fingerprint}`,
    proposedBy: actorEmail,
    expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    evidence: {
      acceptanceMessages: acceptances.map(
        ({ messageId, sender, excerpt, threadId, latestMessageId }) => ({
          messageId,
          sender,
          quote: excerpt,
          threadId,
          latestMessageId,
        }),
      ),
      milestoneClaimIds: booking.milestones
        .filter((item) => item.status === "verified")
        .map((item) => ({ milestone: item.milestone, claimId: item.claim_id })),
    },
    explicit: true,
  });
}

export async function executeDebateInvitation(
  db: SupabaseClient,
  raw: unknown,
  actorEmail: string,
) {
  const payload = raw as Record<string, unknown>;
  const input = debateInvitationSchema.parse(payload);
  const { emails, acceptances } = await verifyInvitationContext(db, input);
  if (
    digest({ input, emails, acceptances }) !== payload.fingerprint ||
    JSON.stringify(emails) !== JSON.stringify(payload.attendees)
  )
    throw new Error("Participant, acceptance or invitation details changed after approval");
  const receipt = await createVerifiedCalendarInvitation(db, {
    productionId: input.productionId,
    attemptKey: String(input.expectedRevision),
    summary: input.summary,
    description: input.description,
    startAt: input.startAt,
    endAt: input.endAt,
    timeZone: input.timeZone,
    attendees: emails,
    location: input.location,
    createMeet: input.createMeet,
  });
  const { data: updated, error } = await callDebateProductionHostRpc(
    db,
    "link_invitation",
    {
      productionId: input.productionId,
      calendarEventId: receipt.calendarEventId,
      expectedRevision: input.expectedRevision,
    },
    actorEmail,
  );
  if (error || !updated)
    throw new Error(
      "Google accepted the invitation, but the booking link needs reconciliation; do not resend",
    );
  await recordDebateMilestone(
    db,
    {
      productionId: input.productionId,
      milestone: "invitation",
      status: "verified",
      value: receipt.providerEventId,
      sourceType: "calendar_event",
      sourceId: receipt.calendarEventId,
      observedAt: new Date().toISOString(),
    },
    actorEmail,
  );
  return {
    ...receipt,
    productionId: input.productionId,
    acceptanceMessageIds: input.acceptanceMessageIds,
    nextAction: "Check each participant's response to the current invitation",
  };
}
