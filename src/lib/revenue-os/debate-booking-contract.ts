import { z } from "zod";

export const DEBATE_MILESTONES = [
  "topic_interest",
  "counterpart",
  "proposition",
  "perspective",
  "format",
  "date",
  "invitation",
  "production_terms",
  "announcement",
  "recording",
  "publication",
] as const;

// Tool schemas must load without initializing booking services or the AI registry.
export const debateMilestoneSchema = z.object({
  productionId: z.uuid(),
  milestone: z.enum(DEBATE_MILESTONES),
  status: z.enum(["proposed", "verified", "declined", "cancelled"]),
  value: z.string().trim().min(1).max(4000),
  sourceType: z.enum([
    "gmail_message",
    "calendar_event",
    "founder_note",
    "drive_document",
    "uploaded_document",
    "founder_confirmation",
  ]),
  sourceId: z.string().trim().min(1).max(240),
  observedAt: z.iso.datetime({ offset: true }),
});

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

export type DebateMilestone = (typeof DEBATE_MILESTONES)[number];
export type DebateMilestoneStatus = "proposed" | "verified" | "declined" | "cancelled";
export type DebateNextAction =
  | "reply"
  | "research"
  | "joint_introduction"
  | "scheduling"
  | "invitation"
  | "follow_up"
  | "prep"
  | "announcement"
  | "recording"
  | "publication"
  | "escalation"
  | "complete";

export interface DebateBookingState {
  milestones: Partial<Record<DebateMilestone, DebateMilestoneStatus>>;
  event?: {
    status: string | null;
    attendees: Array<{ email: string; responseStatus?: string }>;
    fresh?: boolean;
    integrity?: boolean;
    conferenceReady?: boolean;
  } | null;
  participantEmails: string[];
}

export function nextDebateAction(state: DebateBookingState): {
  kind: DebateNextAction;
  milestone: DebateMilestone | null;
  reason: string;
  booked: boolean;
} {
  for (const milestone of DEBATE_MILESTONES.slice(0, 7)) {
    const status = state.milestones[milestone];
    if (status === "verified") continue;
    if (
      (status === "declined" || status === "cancelled") &&
      !(milestone === "invitation" && status === "cancelled" && !state.event)
    )
      return {
        kind: "escalation",
        milestone,
        reason: `${milestone.replaceAll("_", " ")} was declined or cancelled`,
        booked: false,
      };
    const kind: DebateNextAction =
      milestone === "counterpart"
        ? state.milestones.counterpart === "proposed"
          ? "joint_introduction"
          : "research"
        : milestone === "date"
          ? "scheduling"
          : milestone === "invitation"
            ? "invitation"
            : "reply";
    return {
      kind,
      milestone,
      reason:
        milestone === "invitation" && state.milestones.invitation === "cancelled"
          ? "The canceled invitation needs a reviewed replacement"
          : `${milestone.replaceAll("_", " ")} is not verified`,
      booked: false,
    };
  }
  if (!state.event || state.event.status !== "confirmed")
    return {
      kind: "escalation",
      milestone: "invitation",
      reason: "The verified invitation has no confirmed Google Calendar event",
      booked: false,
    };
  if (state.event.fresh !== true)
    return {
      kind: "escalation",
      milestone: "invitation",
      reason: "The invitation has not been verified against Google Calendar recently",
      booked: false,
    };
  if (state.event.integrity !== true)
    return {
      kind: "escalation",
      milestone: "invitation",
      reason:
        state.event.integrity === false
          ? "The current Google event differs from the approved invitation"
          : "The current Google event has not been checked against the approved invitation",
      booked: false,
    };
  if (state.event.conferenceReady !== true)
    return {
      kind: "follow_up",
      milestone: "invitation",
      reason:
        state.event.conferenceReady === false
          ? "The requested Google Meet link has not been verified on the invitation"
          : "Conference readiness has not been verified on the invitation",
      booked: false,
    };
  const participants = [...new Set(state.participantEmails.map((email) => email.toLowerCase()))];
  if (
    participants.length !== 2 ||
    state.event.attendees.length !== participants.length ||
    participants.some(
      (email) =>
        state.event?.attendees.find((attendee) => attendee.email.toLowerCase() === email)
          ?.responseStatus !== "accepted",
    )
  )
    return {
      kind: "follow_up",
      milestone: "invitation",
      reason: "Both participants have not accepted the current invitation",
      booked: false,
    };
  for (const [milestone, kind] of [
    ["production_terms", "prep"],
    ["announcement", "announcement"],
    ["recording", "recording"],
    ["publication", "publication"],
  ] as const) {
    if (state.milestones[milestone] === "declined" || state.milestones[milestone] === "cancelled")
      return {
        kind: "escalation",
        milestone,
        reason: `${milestone.replaceAll("_", " ")} was declined or cancelled`,
        booked: false,
      };
    if (state.milestones[milestone] !== "verified")
      return {
        kind,
        milestone,
        reason: `${milestone.replaceAll("_", " ")} is not verified`,
        booked: milestone !== "production_terms",
      };
  }
  return { kind: "complete", milestone: null, reason: "Publication is verified", booked: true };
}
