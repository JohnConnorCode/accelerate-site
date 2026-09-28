import assert from "node:assert/strict";
import {
  nextDebateAction,
  type DebateBookingState,
} from "../src/lib/revenue-os/debate-booking-contract";

const agreed: DebateBookingState["milestones"] = {
  topic_interest: "verified",
  counterpart: "verified",
  proposition: "verified",
  perspective: "verified",
  format: "verified",
  date: "verified",
  invitation: "verified",
  production_terms: "verified",
};
const participants = ["pedro@example.test", "martin@example.test"];

assert.deepEqual(
  nextDebateAction({
    milestones: agreed,
    participantEmails: participants,
    event: { status: "cancelled", attendees: [] },
  }),
  {
    kind: "escalation",
    milestone: "invitation",
    reason: "The verified invitation has no confirmed Google Calendar event",
    booked: false,
  },
  "a cancelled or missing invitation cannot count as a booking",
);

assert.equal(
  nextDebateAction({
    milestones: { ...agreed, proposition: "proposed", format: "proposed" },
    participantEmails: participants,
  }).milestone,
  "proposition",
  "a discussed question cannot become an agreed proposition",
);

assert.equal(
  nextDebateAction({
    milestones: { topic_interest: "verified", counterpart: "proposed" },
    participantEmails: ["manling@example.test"],
  }).kind,
  "joint_introduction",
  "a proposed counterpart must not become confirmed",
);
assert.equal(
  nextDebateAction({
    milestones: { topic_interest: "verified", proposition: "declined" },
    participantEmails: participants,
  }).milestone,
  "counterpart",
  "a later dispute must not hide the first missing commitment",
);

const acceptedEvent = {
  status: "confirmed",
  attendees: participants.map((email) => ({ email, responseStatus: "accepted" })),
  fresh: true,
  integrity: true,
  conferenceReady: true,
};
assert.equal(
  nextDebateAction({ milestones: agreed, participantEmails: participants, event: acceptedEvent })
    .booked,
  true,
);
for (const proof of ["fresh", "integrity", "conferenceReady"] as const) {
  assert.equal(
    nextDebateAction({
      milestones: agreed,
      participantEmails: participants,
      event: { ...acceptedEvent, [proof]: undefined },
    }).booked,
    false,
    `missing ${proof} proof cannot confirm a booking`,
  );
}
assert.equal(
  nextDebateAction({
    milestones: { ...agreed, invitation: "cancelled" },
    participantEmails: participants,
  }).kind,
  "invitation",
  "a reconciled cancellation should ask for a replacement",
);
assert.equal(
  nextDebateAction({
    milestones: agreed,
    participantEmails: participants,
    event: { ...acceptedEvent, fresh: false },
  }).booked,
  false,
  "a stale calendar observation cannot confirm a booking",
);
assert.equal(
  nextDebateAction({
    milestones: agreed,
    participantEmails: participants,
    event: { ...acceptedEvent, integrity: false },
  }).booked,
  false,
  "a changed provider event cannot confirm a booking",
);
assert.equal(
  nextDebateAction({
    milestones: agreed,
    participantEmails: participants,
    event: { ...acceptedEvent, conferenceReady: false },
  }).booked,
  false,
  "a requested but missing conference link cannot confirm a booking",
);
assert.equal(
  nextDebateAction({
    milestones: agreed,
    participantEmails: participants,
    event: {
      ...acceptedEvent,
      attendees: [
        ...acceptedEvent.attendees,
        { email: "unexpected@example.test", responseStatus: "accepted" },
      ],
    },
  }).booked,
  false,
  "an unapproved extra attendee cannot be part of a confirmed booking",
);
assert.equal(
  nextDebateAction({
    milestones: agreed,
    participantEmails: participants,
    event: {
      ...acceptedEvent,
      attendees: [{ email: participants[0]!, responseStatus: "accepted" }],
    },
  }).booked,
  false,
  "both participants must accept",
);

console.log("Debate booking regressions passed");
