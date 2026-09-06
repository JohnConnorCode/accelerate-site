import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  radarOutreachPreviewSchema,
  reviewRadarOutreachText,
} from "../src/lib/revenue-os/radar-outreach-contract";
const base = {
  subject: "A workshop collaboration",
  body: "Your workshop addresses the problem we study. Could we contribute a practical session?",
  purpose: "partnership" as const,
  approvedFacts: [],
  allowedUrls: [],
  forbiddenPhrases: [],
  hasPriorOutbound: false,
  hasCurrentIntroductionOffer: false,
  hasBothConsents: false,
};
assert.equal(reviewRadarOutreachText(base).blockers.length, 0);
for (const [body, rule] of [
  ["We guarantee huge exposure and massive audience.", "promised_reach"],
  ["We have 40,000 subscribers.", "unsupported_quantity"],
  ["We can pay $100.", "financial_commitment"],
  ["Happy to introduce you both.", "unsupported_introduction"],
  ["Book https://invented.example/meeting", "unreviewed_link"],
] as const)
  assert.ok(
    reviewRadarOutreachText({ ...base, body }).blockers.some((b) => b.rule === rule),
    rule,
  );
assert.equal(
  reviewRadarOutreachText({
    ...base,
    body: "We have 40,000 subscribers.",
    approvedFacts: ["We have 40,000 subscribers."],
  }).blockers.length,
  0,
);
assert.ok(
  reviewRadarOutreachText({
    ...base,
    body: "We can pay $100.",
    approvedFacts: ["We can pay $100."],
  }).blockers.length,
);
assert.equal(
  reviewRadarOutreachText({
    ...base,
    body: "We can pay $100.",
    approvedFacts: ["We can pay $100."],
    allowApprovedTerms: true,
  }).blockers.length,
  0,
);
assert.ok(
  reviewRadarOutreachText({
    ...base,
    body: "I would like to introduce myself.",
    hasPriorOutbound: true,
  }).warnings.some((w) => w.rule === "existing_history"),
);
assert.ok(
  reviewRadarOutreachText({ ...base, forbiddenPhrases: ["practical session"] }).blockers.length,
);
assert.equal(
  radarOutreachPreviewSchema.safeParse({
    assetId: randomUUID(),
    purpose: "introduction",
    reason: "A suggested name",
  }).success,
  false,
);
assert.equal(
  radarOutreachPreviewSchema.safeParse({
    assetId: randomUUID(),
    purpose: "introduction_request",
    reason: "A suggested name",
  }).success,
  false,
);
assert.equal(reviewRadarOutreachText(base).humanReviewRequired, true);
console.log(
  "Radar outreach: configurable quality policy, approved terms, source links, history and introduction requirements passed",
);
