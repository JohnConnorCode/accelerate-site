import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  campaignEngineReadiness,
  resendDeliveryReadiness,
  setupNextRun,
} from "../src/lib/revenue-os/setup-status";

assert.equal(resendDeliveryReadiness({ configured: false }).status, "action");
assert.equal(
  resendDeliveryReadiness({ configured: true, lastOutbound: null }).status,
  "action",
  "keys without a delivery receipt must not read as ready",
);
assert.equal(
  resendDeliveryReadiness({
    configured: true,
    lastOutbound: { status: "sent", sent_at: "2026-08-30T00:00:00.000Z", provider_id: "re_1" },
  }).status,
  "ready",
);
assert.equal(
  resendDeliveryReadiness({
    configured: true,
    lastOutbound: { status: "failed", sent_at: null, provider_id: null },
  }).status,
  "degraded",
);

assert.equal(campaignEngineReadiness({ schemaReady: false, configured: true }).status, "action");
assert.equal(
  campaignEngineReadiness({ schemaReady: true, configured: true, lastJob: null }).status,
  "ready",
);
assert.equal(
  campaignEngineReadiness({
    schemaReady: true,
    configured: true,
    lastJob: {
      status: "failed",
      finished_at: "2026-08-30T00:00:00.000Z",
      error: "provider refused",
    },
  }).status,
  "degraded",
);
assert.equal(
  campaignEngineReadiness({
    schemaReady: true,
    configured: true,
    lastJob: { status: "success", finished_at: "2026-08-30T00:00:00.000Z", error: null },
  }).lastSuccessAt,
  "2026-08-30T00:00:00.000Z",
);

assert.match(setupNextRun("config"), /No scheduled run/);
assert.match(setupNextRun("health-snapshot"), /15 minutes/);

const setupRoute = readFileSync("src/app/api/admin/setup/route.ts", "utf8");
const checkIds = [...setupRoute.matchAll(/id: "([a-z_]+)"/g)].map((match) => match[1]);
assert.ok(checkIds.length >= 18, "Setup Center must keep the full capability list");
const nextRunCount = [...setupRoute.matchAll(/nextRun: setupNextRun\(/g)].length;
assert.equal(nextRunCount, checkIds.length, "every Setup check must declare a next-run receipt");
assert.doesNotMatch(
  setupRoute,
  /process\.env\.(RESEND_API_KEY|CRON_SECRET|SUPABASE_SERVICE_ROLE_KEY|GOOGLE_CLIENT_SECRET|GOOGLE_TOKEN_ENCRYPTION_KEY|OPENROUTER_API_KEY)/,
  "Setup JSON must not interpolate secret environment values",
);

console.log(
  JSON.stringify(
    {
      result: "passed",
      checks: [
        "email-config-not-health",
        "email-receipt-ready",
        "email-failed-degraded",
        "campaign-failed-degraded",
        "next-run-copy",
        "secrets-not-interpolated",
      ],
    },
    null,
    2,
  ),
);
