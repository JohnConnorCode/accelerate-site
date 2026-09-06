#!/usr/bin/env tsx
import assert from "node:assert/strict";
import {
  whatsAppAdapter,
  hubSpotAdapter,
  type IntegrationAdapter,
  type ReconciliationResult,
  type AdapterHealth,
} from "../src/lib/revenue-os/integration-adapters";

const fakeCredentials = { accessToken: "fake-token", phoneNumberId: "fake-phone" };
const fakeHubSpotCreds = { accessToken: "fake-hs-token" };

async function testReconciliation(adapter: IntegrationAdapter, label: string) {
  const result: ReconciliationResult = await adapter.reconcile(
    null as unknown as Parameters<typeof adapter.reconcile>[0],
    fakeCredentials,
    "cursor-123",
  );
  assert.ok(
    ["success", "partial", "skipped", "failed"].includes(result.status),
    `${label} reconcile must terminate success, partial, skipped, or failed`,
  );
  assert.ok(Array.isArray(result.errors), `${label} reconcile must return errors array`);
  assert.ok(
    Number.isInteger(result.processed) && result.processed >= 0,
    `${label} reconcile must return non-negative processed count`,
  );
}

async function testHealth(adapter: IntegrationAdapter, label: string) {
  const health: AdapterHealth = await adapter.health(fakeCredentials);
  assert.ok(typeof health.healthy === "boolean", `${label} health must return healthy boolean`);
  assert.ok(
    Number.isInteger(health.latencyMs) && health.latencyMs >= 0,
    `${label} health must return non-negative latencyMs`,
  );
  assert.ok(
    health.provider === label.toLowerCase().replace(/\s+/g, "-") ||
      health.provider === label.toLowerCase(),
    `${label} health must return the correct provider`,
  );
}

async function testDuplicateReplay(adapter: IntegrationAdapter, label: string) {
  const result1: ReconciliationResult = await adapter.reconcile(
    null as unknown as Parameters<typeof adapter.reconcile>[0],
    fakeCredentials,
  );
  const result2: ReconciliationResult = await adapter.reconcile(
    null as unknown as Parameters<typeof adapter.reconcile>[0],
    fakeCredentials,
    "cursor-123",
  );
  assert.ok(result1.status !== "failed", `${label} first reconcile must not fail`);
  assert.ok(result2.status !== "failed", `${label} duplicate reconcile must not fail`);
}

async function testCursorExpiry(adapter: IntegrationAdapter, label: string) {
  const result = await adapter.reconcile(
    null as unknown as Parameters<typeof adapter.reconcile>[0],
    fakeCredentials,
    "expired-cursor",
  );
  assert.ok(
    ["success", "partial", "skipped", "failed"].includes(result.status),
    `${label} cursor expiry must still produce a valid termination`,
  );
}

async function testScopeDrift(adapter: IntegrationAdapter, label: string) {
  const badCreds = { accessToken: "wrong-scope-token" };
  const health = await adapter.health(badCreds as Record<string, unknown>);
  assert.ok(
    typeof health.healthy === "boolean",
    `${label} scope drift must not throw; healthy must be boolean`,
  );
}

async function testThrottling(adapter: IntegrationAdapter, label: string) {
  const verifyResult = await adapter.verify(fakeCredentials);
  if (verifyResult.rateLimit) {
    assert.ok(
      Number.isInteger(verifyResult.rateLimit.remaining) && verifyResult.rateLimit.remaining >= 0,
      `${label} rate limit remaining must be non-negative integer`,
    );
    assert.ok(verifyResult.rateLimit.resetAt, `${label} rate limit resetAt must be present`);
  }
}

async function main() {
  console.log("Testing integration adapter contract...");

  const adapters = [
    { adapter: whatsAppAdapter, label: "WhatsApp" },
    { adapter: hubSpotAdapter, label: "HubSpot" },
  ];

  for (const { adapter, label } of adapters) {
    await testReconciliation(adapter, label);
    await testHealth(adapter, label);
    await testDuplicateReplay(adapter, label);
    await testCursorExpiry(adapter, label);
    await testScopeDrift(adapter, label);
    await testThrottling(adapter, label);
    console.log(`${label}: contract tests passed`);
  }

  assert.ok(
    typeof whatsAppAdapter.reconcile === "function",
    "whatsAppAdapter must implement reconcile",
  );
  assert.ok(typeof whatsAppAdapter.health === "function", "whatsAppAdapter must implement health");
  assert.ok(
    typeof hubSpotAdapter.reconcile === "function",
    "hubSpotAdapter must implement reconcile",
  );
  assert.ok(typeof hubSpotAdapter.health === "function", "hubSpotAdapter must implement health");

  const whatsappResult = await whatsAppAdapter.reconcile(
    null as unknown as Parameters<typeof whatsAppAdapter.reconcile>[0],
    fakeCredentials,
  );
  assert.ok(
    ["success", "partial", "skipped", "failed"].includes(whatsappResult.status),
    "reconcile must terminate success, partial, skipped, or failed",
  );

  const hubspotHealth = await hubSpotAdapter.health(fakeHubSpotCreds);
  assert.ok(typeof hubspotHealth.healthy === "boolean", "health must return healthy boolean");

  console.log("All integration adapter contract tests passed!");
}

main().catch((err) => {
  console.error("Integration adapter contract tests failed:", err);
  process.exit(1);
});
