#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  bookingModeSummary,
  bookingModeTitle,
  resolveBookingMode,
  showsPublicEmbed,
} from "../src/lib/booking";
import {
  CALENDLY_ATTRIBUTION_FRESHNESS_HOURS,
  calendlyAttributionReadiness,
} from "../src/lib/revenue-os/setup-status";

const now = new Date("2026-09-04T12:00:00.000Z");

assert.equal(
  resolveBookingMode({
    publicBooking: true,
    schedulerUrl: "https://calendly.com/example/30min",
  }),
  "embed",
);
assert.equal(
  resolveBookingMode({
    publicBooking: true,
    schedulerUrl: "https://calendly.com/example/30min",
    calendlyEnabledEnv: "true",
  }),
  "embed",
  "CALENDLY_ENABLED=true is not an activation switch and must not change tenant-owned embed",
);
assert.equal(
  resolveBookingMode({
    publicBooking: true,
    schedulerUrl: "https://calendly.com/example/30min",
    calendlyEnabledEnv: "false",
  }),
  "disabled",
);
assert.equal(
  resolveBookingMode({ publicBooking: false, schedulerUrl: "https://calendly.com/example/30min" }),
  "manual",
);
assert.equal(resolveBookingMode({ publicBooking: true, schedulerUrl: null }), "manual");
assert.equal(resolveBookingMode({ publicBooking: true, schedulerUrl: "   " }), "manual");
assert.equal(showsPublicEmbed("embed"), true);
assert.equal(showsPublicEmbed("calendly"), true, "legacy qualifier value still shows the embed");
assert.equal(showsPublicEmbed("manual"), false);
assert.equal(showsPublicEmbed("disabled"), false);
assert.equal(bookingModeTitle("embed"), "Public scheduler embed");
assert.equal(bookingModeTitle("disabled"), "Public booking paused");
assert.equal(bookingModeTitle("manual"), "Manual scheduling");
assert.match(bookingModeSummary("embed", "Mara"), /not implied by the embed/);
assert.match(bookingModeSummary("disabled", "Mara"), /paused/);
assert.match(bookingModeSummary("manual", "Mara"), /Mara/);

const signed = {
  event_type: "invitee.created",
  processed_at: "2026-09-04T11:00:00.000Z",
};
assert.equal(
  calendlyAttributionReadiness({
    bookingMode: "disabled",
    webhookConfigured: true,
    lastSignedReceipt: signed,
    now,
  }).status,
  "disabled",
);
assert.equal(
  calendlyAttributionReadiness({
    bookingMode: "manual",
    webhookConfigured: true,
    lastSignedReceipt: signed,
    now,
  }).status,
  "optional",
);
assert.equal(
  calendlyAttributionReadiness({
    bookingMode: "embed",
    webhookConfigured: false,
    lastSignedReceipt: signed,
    now,
  }).status,
  "action",
  "embed availability is not attribution readiness",
);
assert.equal(
  calendlyAttributionReadiness({
    bookingMode: "embed",
    webhookConfigured: true,
    lastSignedReceipt: null,
    now,
  }).status,
  "action",
  "a webhook secret without a signed receipt is not Ready",
);
assert.equal(
  calendlyAttributionReadiness({
    bookingMode: "embed",
    webhookConfigured: true,
    lastSignedReceipt: { event_type: "invitee.updated", processed_at: signed.processed_at },
    now,
  }).status,
  "action",
  "only booking and cancellation receipts count",
);
assert.equal(
  calendlyAttributionReadiness({
    bookingMode: "embed",
    webhookConfigured: true,
    lastSignedReceipt: signed,
    now,
  }).status,
  "ready",
);
assert.equal(
  calendlyAttributionReadiness({
    bookingMode: "embed",
    webhookConfigured: true,
    lastSignedReceipt: {
      event_type: "invitee.canceled",
      processed_at: "2026-08-01T00:00:00.000Z",
    },
    now,
  }).status,
  "degraded",
  "stale signed evidence is degraded, not Ready",
);
assert.ok(CALENDLY_ATTRIBUTION_FRESHNESS_HOURS >= 24);

const sources = {
  booking: readFileSync("src/lib/booking.ts", "utf8"),
  setupRoute: readFileSync("src/app/api/admin/setup/route.ts", "utf8"),
  setupPage: readFileSync("src/app/admin/setup/page.tsx", "utf8"),
  qualify: readFileSync("src/app/api/qualify/route.ts", "utf8"),
  resume: readFileSync("src/app/api/qualify/resume/route.ts", "utf8"),
  qualifier: readFileSync("src/components/roofing/RoofingQualifier.tsx", "utf8"),
  contact: readFileSync("src/components/sections/ContactPage.tsx", "utf8"),
  catalogLoad: readFileSync("src/lib/revenue-os/integrations.ts", "utf8"),
  bookingMachine: readFileSync("docs/internal/BOOKING-MACHINE.md", "utf8"),
  setupDoc: readFileSync("docs/self-hosting/REVENUE-OS-SETUP.md", "utf8"),
  envExample: readFileSync(".env.example", "utf8"),
};

assert.match(sources.booking, /export function resolveBookingMode/);
assert.match(sources.booking, /Public booking paused/);
assert.match(sources.setupRoute, /bookingMode: publicBookingMode/);
assert.doesNotMatch(
  sources.setupRoute,
  /bookingMode: publicBookingMode === "embed" \? "calendly"/,
  "Setup JSON must return the canonical embed|manual|disabled mode",
);
assert.match(sources.setupPage, /bookingMode: BookingMode/);
assert.match(sources.setupPage, /bookingModeTitle\(data\.bookingMode\)/);
assert.match(sources.setupPage, /PauseCircle/);
assert.doesNotMatch(sources.setupPage, /Leave CALENDLY_ENABLED unset/);
assert.match(sources.qualify, /bookingMode: publicBookingMode/);
assert.match(sources.resume, /bookingMode: bookingMode\(\)/);
assert.match(sources.qualifier, /showsPublicEmbed/);
assert.match(sources.contact, /hasScheduler\(\)/);
assert.match(sources.catalogLoad, /calendly_webhook_receipts/);
assert.doesNotMatch(sources.bookingMachine, /Set `CALENDLY_ENABLED=true`/);
assert.match(sources.bookingMachine, /src\/lib\/booking\.ts/);
assert.match(sources.setupDoc, /tenant\.capabilities\.publicBooking/);
assert.doesNotMatch(
  sources.setupDoc,
  /active booking path when `CALENDLY_ENABLED` is not `false`/,
);
assert.doesNotMatch(
  sources.envExample,
  /^CALENDLY_ENABLED=false$/m,
  ".env.example must not pause public booking by default",
);
assert.doesNotMatch(sources.envExample, /^CALENDLY_PERSONAL_ACCESS_TOKEN=/m);

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git" || entry === "coverage") {
      continue;
    }
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, acc);
    else if (/\.(ts|tsx|md|example)$/.test(entry)) acc.push(path);
  }
  return acc;
}

const activationInstruction = /Set `CALENDLY_ENABLED=true`/;
for (const file of [...walk("src"), ...walk("docs"), ".env.example"]) {
  const body = readFileSync(file, "utf8");
  assert.doesNotMatch(
    body,
    activationInstruction,
    `${file} still tells operators to set CALENDLY_ENABLED=true`,
  );
}

console.log(
  JSON.stringify(
    {
      result: "passed",
      checks: [
        "tenant-owned-mode",
        "emergency-pause",
        "true-is-not-activation",
        "manual-without-scheduler",
        "embed-not-attribution",
        "fresh-signed-receipt-ready",
        "stale-receipt-degraded",
        "catalog-loads-calendly-receipts",
        "docs-and-env-agree",
        "no-calendly-enabled-true-activation",
      ],
    },
    null,
    2,
  ),
);
