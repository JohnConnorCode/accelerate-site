#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildIntegrationCatalog, type IntegrationEvidence } from "../src/lib/revenue-os/integrations";
import { INTEGRATION_REGISTRY_VERSION, integrationRegistry } from "../src/lib/revenue-os/integration-registry";

const now = new Date("2026-08-23T18:00:00.000Z");

function evidence(overrides: Partial<IntegrationEvidence> = {}): IntegrationEvidence {
  return {
    schemaAvailable: true,
    configured: { supabase: true, google: false, resend: false, resend_webhooks: false, openrouter: false },
    runtime: {
      supabase: { status: "success", checkedAt: now.toISOString() },
      resend: { status: "unknown", checkedAt: now.toISOString() },
      openrouter: { status: "unknown", checkedAt: now.toISOString() },
      "first-party": { status: "success", checkedAt: now.toISOString() },
    },
    connections: [],
    sourceRuns: [],
    jobRuns: [],
    webhooks: [],
    ...overrides,
  };
}

function provider(catalog: ReturnType<typeof buildIntegrationCatalog>, id: string) {
  const found = catalog.providers.find((item) => item.id === id);
  assert.ok(found, `provider ${id} must exist`);
  return found;
}

const baseline = buildIntegrationCatalog(evidence(), now);
assert.equal(baseline.registryVersion, INTEGRATION_REGISTRY_VERSION);
assert.equal(baseline.providers.length, integrationRegistry.length, "the API projection must not silently omit registry providers");
assert.equal(provider(baseline, "supabase").status, "action", "a missing scheduler receipt keeps the overall foundation from claiming full readiness");
assert.equal(provider(baseline, "supabase").capabilities.find((item) => item.id === "canonical-data")?.status, "ready", "runtime behavior, not environment presence, makes canonical data ready");
assert.equal(provider(baseline, "google").status, "available", "an unconfigured native connector is available, not healthy or broken");
assert.equal(provider(baseline, "microsoft").status, "planned", "a roadmap provider must never appear installed");

const configuredOnly = buildIntegrationCatalog(evidence({
  configured: { supabase: true, google: true, resend: false, resend_webhooks: false, openrouter: false },
}), now);
assert.equal(provider(configuredOnly, "google").status, "action", "OAuth environment variables without a live connection require action");

const connected = buildIntegrationCatalog(evidence({
  configured: { supabase: true, google: true, resend: false, resend_webhooks: false, openrouter: false },
  connections: [{
    provider: "google",
    account_email: "founder@example.com",
    status: "connected",
    scopes: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
    last_sync_at: "2026-08-23T17:00:00.000Z",
    last_success_at: "2026-08-23T17:00:00.000Z",
    last_error: null,
  }],
  sourceRuns: [
    { key: "gmail", status: "success", startedAt: "2026-08-23T17:00:00.000Z", finishedAt: "2026-08-23T17:01:00.000Z", error: null },
    { key: "google_calendar", status: "success", startedAt: "2026-08-23T17:00:00.000Z", finishedAt: "2026-08-23T17:01:00.000Z", error: null },
    { key: "google_drive", status: "success", startedAt: "2026-08-23T17:00:00.000Z", finishedAt: "2026-08-23T17:01:00.000Z", error: null },
  ],
}), now);
const google = provider(connected, "google");
assert.equal(google.status, "action", "a send capability with no behavioral receipt keeps the provider from claiming full readiness");
assert.equal(google.capabilities.find((item) => item.id === "gmail-read")?.status, "ready");
assert.equal(google.capabilities.find((item) => item.id === "gmail-send")?.status, "action");
assert.equal(google.accountLabel, "founder@example.com");

const stale = buildIntegrationCatalog(evidence({
  configured: { supabase: true, google: true, resend: false, resend_webhooks: false, openrouter: false },
  connections: connected.providers.find((item) => item.id === "google") ? [{
    provider: "google", account_email: "founder@example.com", status: "connected",
    scopes: ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/drive.readonly"],
    last_sync_at: "2026-08-20T10:00:00.000Z", last_success_at: "2026-08-20T10:00:00.000Z", last_error: null,
  }] : [],
  sourceRuns: [{ key: "gmail", status: "success", startedAt: "2026-08-20T10:00:00.000Z", finishedAt: "2026-08-20T10:01:00.000Z", error: null }],
}), now);
assert.equal(provider(stale, "google").capabilities.find((item) => item.id === "gmail-read")?.status, "degraded", "stale success is degraded, not green forever");

const failed = buildIntegrationCatalog(evidence({
  configured: { supabase: true, google: false, resend: true, resend_webhooks: true, openrouter: false },
  runtime: { ...evidence().runtime, resend: { status: "success", checkedAt: now.toISOString() } },
  webhooks: [{ provider: "resend", status: "failed", receivedAt: now.toISOString(), error: "token=super-secret provider rejection" }],
}), now);
const resendFeedback = provider(failed, "resend").capabilities.find((item) => item.id === "feedback");
assert.equal(resendFeedback?.status, "degraded");
assert.ok(!resendFeedback?.statusReason.includes("super-secret"), "operator diagnostics must redact token-like values");

const missingSchema = buildIntegrationCatalog(evidence({ schemaAvailable: false }), now);
assert.equal(missingSchema.evidenceAvailable, false);
assert.equal(provider(missingSchema, "google").status, "degraded", "missing receipt tables must never produce a healthy integration");

for (const definition of integrationRegistry) {
  assert.ok(definition.capabilities.length > 0, `${definition.id} needs at least one bounded capability`);
  assert.ok(definition.cost.detail.length > 0, `${definition.id} must declare cost posture`);
  assert.ok(definition.guardrail.length > 0, `${definition.id} must declare its ownership/safety boundary`);
  assert.ok(definition.transports.length > 0, `${definition.id} must declare how evidence moves`);
}

const route = readFileSync("src/app/api/admin/integrations/route.ts", "utf8");
assert.match(route, /requireAdmin\(\)/, "the catalog API must fail closed through founder authorization");
assert.match(route, /loadIntegrationCatalog/, "the route must remain a thin adapter over the authoritative read model");

console.log(JSON.stringify({
  result: "passed",
  registryVersion: INTEGRATION_REGISTRY_VERSION,
  providers: integrationRegistry.length,
  checks: ["registry completeness", "behavioral readiness", "configuration-only", "planned truth", "scope gate", "freshness", "failure redaction", "missing schema", "route authorization"],
}, null, 2));
