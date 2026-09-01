import assert from "node:assert/strict";
import {
  classifyRecoveryCandidate,
  RECOVERY_MOTIONS,
  validateRecoveryInput,
} from "../src/lib/revenue-os/recovery";
import { recoveryCopyTemplate } from "../src/lib/revenue-os/recovery-copy";
import { readFileSync } from "node:fs";

assert.equal(RECOVERY_MOTIONS.length, 5, "the recovery catalog stays controlled");
for (const motion of RECOVERY_MOTIONS) {
  const template = recoveryCopyTemplate(motion);
  assert.ok(
    template.subject.trim() && template.body.trim(),
    `${motion} needs a launch-ready copy starting point`,
  );
  assert.match(
    template.body,
    /{{offer_label}}/,
    `${motion} must resolve the founder-approved offer`,
  );
  assert.match(template.body, /{{booking_url}}/, `${motion} must resolve the approved booking URL`);
}
assert.deepEqual(
  classifyRecoveryCandidate({
    email: "lead@example.com",
    communicationStatus: "active",
    hasOpenOrAdvancedOpportunity: false,
    hasExistingRecovery: false,
  }),
  { status: "eligible", reason: null },
);
assert.equal(
  classifyRecoveryCandidate({
    email: null,
    communicationStatus: "active",
    hasOpenOrAdvancedOpportunity: false,
    hasExistingRecovery: false,
  }).reason,
  "No deliverable email",
);
assert.equal(
  classifyRecoveryCandidate({
    email: "lead@example.com",
    communicationStatus: "suppressed",
    hasOpenOrAdvancedOpportunity: false,
    hasExistingRecovery: false,
  }).reason,
  "Contact is suppressed or inactive",
);
assert.equal(
  classifyRecoveryCandidate({
    email: "lead@example.com",
    communicationStatus: "active",
    hasOpenOrAdvancedOpportunity: true,
    hasExistingRecovery: false,
  }).reason,
  "Contact already has an active or advanced opportunity",
);
assert.equal(
  classifyRecoveryCandidate({
    email: "lead@example.com",
    communicationStatus: "active",
    hasOpenOrAdvancedOpportunity: false,
    hasExistingRecovery: true,
  }).reason,
  "Contact is already in a recovery playbook",
);
assert.equal(
  classifyRecoveryCandidate({
    email: "won@example.com",
    communicationStatus: "active",
    hasOpenOrAdvancedOpportunity: false,
    hasExistingRecovery: true,
  }).status,
  "excluded",
  "a previously recovered win must never be re-enrolled",
);
assert.equal(
  classifyRecoveryCandidate({
    email: "queued@example.com",
    communicationStatus: "active",
    hasOpenOrAdvancedOpportunity: false,
    hasExistingRecovery: false,
  }).status,
  "eligible",
  "a playbook must have at least one genuinely eligible contact before it can stage",
);

const input = {
  name: "Estimate recovery",
  sourceBatchId: "batch-1",
  motion: "unsold_estimate",
  relationshipBasis: "Requested an estimate",
  offerLabel: "Book a review",
  bookingUrl: "https://example.com/book",
  timezone: "America/Detroit",
  outcomeWindowDays: 999,
  steps: [{ delayDays: -3, subject: "A useful next step", body: "Hi {{first_name}}" }],
  actorEmail: "founder@example.com",
} as const;
const valid = validateRecoveryInput(input);
assert.equal(valid.outcomeWindowDays, 90);
assert.equal(valid.steps[0]?.delayDays, 0);
assert.throws(
  () => validateRecoveryInput({ ...input, motion: "unknown" as never }),
  /supported recovery motion/,
);
assert.throws(() => validateRecoveryInput({ ...input, bookingUrl: "not a url" }), /booking URL/);
assert.throws(
  () =>
    validateRecoveryInput({
      ...input,
      steps: [{ ...input.steps[0], body: "Book here: {{calendar_link}}" }],
    }),
  /unsupported variable.*calendar_link/i,
  "recovery staging must refuse placeholders the campaign cannot resolve",
);
assert.match(
  readFileSync("migrations/20260830-revenue-recovery.sql", "utf8"),
  /idx_recovery_playbooks_tenant_batch_motion/,
  "recovery staging needs a durable duplicate-launch boundary",
);
const recoveryService = readFileSync("src/lib/revenue-os/recovery.ts", "utf8");
assert.match(
  recoveryService,
  /createRevenueTask/,
  "recovery responses must enter the canonical task queue",
);
assert.match(
  recoveryService,
  /recovery-follow-up:\$\{candidate\.id\}:\$\{next\}/,
  "recovery follow-up tasks need a durable per-outcome dedupe key",
);
assert.match(
  recoveryService,
  /stop_reason === "calendar_booking"/,
  "a governed calendar stop must reconcile as a recovery booking",
);
assert.match(
  recoveryService,
  /calendar_booking/,
  "a Calendly booking receipt must reconcile even after all campaign steps completed",
);
assert.match(
  recoveryService,
  /stop_reason === "gmail_reply"/,
  "a governed Gmail reply stop must reconcile into founder follow-up work",
);
assert.match(
  recoveryService,
  /gmail_reply_received/,
  "a persisted Gmail reply must reconcile even after campaign steps completed",
);
const gmailSync = readFileSync("src/lib/revenue-os/google.ts", "utf8");
assert.match(
  gmailSync,
  /activityType: "gmail_reply_received"/,
  "Gmail sync must keep an idempotent reply receipt for recovery attribution",
);
assert.match(
  gmailSync,
  /activityType: "calendar_booking"/,
  "Google Calendar sync must keep a canonical booking receipt for recovery attribution",
);
const calendlyWebhook = readFileSync("src/app/api/webhooks/calendly/route.ts", "utf8");
assert.match(
  calendlyWebhook,
  /stopCampaignMemberships/,
  "Calendly bookings must halt remaining recovery sends before pipeline work",
);
assert.match(
  calendlyWebhook,
  /recordActivity/,
  "Calendly bookings need a replay-safe canonical activity receipt",
);
const campaignService = readFileSync("src/lib/revenue-os/campaigns.ts", "utf8");
assert.match(
  campaignService,
  /recovery_playbooks/,
  "campaign execution must resolve recovery playbook values",
);
assert.match(
  campaignService,
  /offer_label: recovery\?\.offer_label/,
  "recovery templates must resolve the approved offer at send time",
);
assert.match(
  campaignService,
  /booking_url: recovery\?\.booking_url/,
  "recovery templates must resolve the approved booking URL at send time",
);
assert.match(
  calendlyWebhook,
  /contact \? "\/admin\/recovery" : "\/admin\/bookings"/,
  "a known contact without an opportunity must be surfaced as recovery work",
);

console.log("recovery service contract passed");
