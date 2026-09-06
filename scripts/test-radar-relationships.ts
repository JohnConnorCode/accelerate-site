import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  radarRelationshipReviewSchema,
  radarRelationshipEdge,
  validateRadarRelationshipReview,
  radarRelationshipPaths,
} from "../src/lib/revenue-os/radar-relationship-contract";
const now = new Date("2026-09-06T12:00:00Z"),
  from = randomUUID(),
  to = randomUUID(),
  message = randomUUID();
const input = radarRelationshipReviewSchema.parse({
  operationId: randomUUID(),
  expectedReviewId: null,
  relationship: {
    kind: "introduction_offer",
    fromContactId: from,
    toContactId: to,
    offer: "Introduce the organizer to the workshop coordinator",
    evidence: {
      kind: "message",
      messageId: message,
      quotation: "I can introduce you to the workshop coordinator.",
    },
  },
  validFrom: now.toISOString(),
  validUntil: "2026-09-20T12:00:00Z",
  reason: "Read the explicit inbound offer and confirm the intended canonical recipient",
});
validateRadarRelationshipReview(
  input,
  now,
  "Hello. I can introduce you to the workshop coordinator. Let me know.",
);
assert.equal(radarRelationshipEdge(input.relationship).linkType, "radar_introduction_offer");
assert.throws(
  () => validateRadarRelationshipReview(input, now, "We both appeared at the workshop."),
  /Quotation/,
);
assert.throws(
  () =>
    validateRadarRelationshipReview(
      { ...input, validUntil: "2027-01-01T00:00:00Z" },
      now,
      input.relationship.evidence.quotation,
    ),
  /within 30 days/,
);
assert.throws(() =>
  radarRelationshipReviewSchema.parse({
    ...input,
    relationship: { kind: "knows", fromContactId: from, toContactId: to },
  }),
);
assert.throws(() =>
  radarRelationshipReviewSchema.parse({
    ...input,
    relationship: { ...input.relationship, email: "guessed@example.test" },
  }),
);
const offer = {
  id: randomUUID(),
  fromContactId: from,
  fromName: "Fictional coordinator",
  communicationStatus: "active",
  identityReviewPending: false,
  validFrom: input.validFrom,
  validUntil: input.validUntil,
  currentEvidence: true,
  explicitOffer: true,
  revoked: false,
};
const context = {
  target: { id: to, communicationStatus: "active", identityReviewPending: false },
  priorConversationCount: 1,
  historyComplete: true,
  offers: [offer],
};
const paths = radarRelationshipPaths(context, now);
assert.deepEqual(
  paths.paths.map((p) => p.kind),
  ["existing_conversation", "introduction_offer"],
);
assert.equal(paths.outreachPermission, false);
for (const patch of [
  { currentEvidence: false },
  { explicitOffer: false },
  { revoked: true },
  { communicationStatus: "unsubscribed" },
  { identityReviewPending: true },
  { validUntil: "2026-09-01T00:00:00Z" },
  { validFrom: "2026-09-10T00:00:00Z" },
]) {
  const result = radarRelationshipPaths(
    { ...context, priorConversationCount: 0, offers: [{ ...offer, ...patch }] },
    now,
  );
  assert.equal(result.paths.length, 0);
  assert.equal(result.blocked.length, 1);
}
for (const patch of [
  { historyComplete: false },
  { target: { ...context.target, communicationStatus: "unknown" } },
  { target: { ...context.target, identityReviewPending: true } },
])
  assert.equal(radarRelationshipPaths({ ...context, ...patch }, now).paths.length, 0);
assert.deepEqual(
  radarRelationshipPaths({ ...context, priorConversationCount: 0, offers: [] }, now).paths,
  [],
  "Cold contacts are not invented warm paths",
);
console.log(
  "PASS: explicit cited offers, bounded validity, no inferred KNOWS or guessed address, suppression, ambiguity, stale evidence and neutral unranked review paths.",
);

const contactPath = {
  id: randomUUID(),
  contactId: to,
  contactUrl: "https://workshop.example/contact",
  validFrom: input.validFrom,
  validUntil: input.validUntil,
  currentEvidence: true,
  revoked: false,
};
const publicContext = {
  ...context,
  priorConversationCount: 0,
  offers: [],
  publicContactPaths: [contactPath],
};
assert.equal(radarRelationshipPaths(publicContext, now).paths[0].kind, "public_business_contact");
assert.equal(radarRelationshipPaths(publicContext, now).outreachPermission, false);
for (const patch of [
  { contactId: from },
  { revoked: true },
  { currentEvidence: false },
  { contactUrl: "javascript:alert(1)" },
  { contactUrl: "https://user:password@workshop.example" },
  { validUntil: "2026-09-01T00:00:00Z" },
  { validFrom: "2026-09-10T00:00:00Z" },
  { validUntil: "unknown" },
]) {
  const result = radarRelationshipPaths(
    { ...publicContext, publicContactPaths: [{ ...contactPath, ...patch }] },
    now,
  );
  assert.equal(result.paths.length, 0);
  assert.equal(result.blocked.length, 1);
}
assert.equal(
  radarRelationshipPaths(
    { ...publicContext, target: { ...context.target, communicationStatus: "unsubscribed" } },
    now,
  ).paths.length,
  0,
);
console.log(
  "PASS: public business paths require current reviewed provenance and matching canonical identity, remain unranked and never authorize outreach.",
);
