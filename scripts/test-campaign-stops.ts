import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { campaignStopStatus, type CampaignStopReason } from "../src/lib/revenue-os/campaign-stops";

const cases: Array<[CampaignStopReason, string]> = [
  ["public_unsubscribe", "unsubscribed"],
  ["resend_bounced", "bounced"],
  ["resend_suppressed", "bounced"],
  ["resend_complained", "stopped"],
  ["opportunity_converted", "stopped"],
  ["opportunity_progressed", "stopped"],
  ["manual_pause", "stopped"],
  ["policy_invalidated", "stopped"],
];
for (const [reason, expected] of cases) assert.equal(campaignStopStatus(reason), expected, reason);

const resendRoute = readFileSync(
  new URL("../src/app/api/webhooks/resend/route.ts", import.meta.url),
  "utf8",
);
const unsubscribeRoute = readFileSync(
  new URL("../src/lib/revenue-os/public-unsubscribe.ts", import.meta.url),
  "utf8",
);
for (const [label, source] of [
  ["Resend", resendRoute],
  ["unsubscribe", unsubscribeRoute],
] as const) {
  assert.match(
    source,
    /suppressContactFromCampaignEmail/,
    `${label} must use the canonical contact suppression service`,
  );
  assert.doesNotMatch(
    source,
    /from\("contacts"\)\.update\(/,
    `${label} must not write campaign eligibility directly`,
  );
}

console.log(
  JSON.stringify({
    cases: cases.length,
    result: "campaign stop state and adapter ownership contract passed",
  }),
);
