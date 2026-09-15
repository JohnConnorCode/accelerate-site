#!/usr/bin/env tsx
/**
 * External Capability Service Adapter Conformance Tests
 *
 * Validates that every external capability adapter satisfies the
 * EXTSVC_ADAPTER_CONFORMANCE_CHECKLIST. The Stripe adapter is the
 * reference implementation and MUST pass all blocking checks.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  REFERENCE_ADAPTER_ID,
  checkConformance,
  type ExtsvcAdapterContract,
} from "../src/lib/revenue-os/extsvc-adapter-contract";
import { stripeAdapter } from "../src/lib/revenue-os/stripe-adapter";

const __dirname = join(fileURLToPath(import.meta.url), "..");
const repoRoot = join(__dirname, "..");

function loadAdapterSource(id: string): string {
  // The adapters live in src/lib/revenue-os/integration-adapters.ts and stripe-adapter.ts
  const integrationSource = readFileSync(
    join(repoRoot, "src/lib/revenue-os/integration-adapters.ts"),
    "utf8",
  );
  const stripeSource = readFileSync(join(repoRoot, "src/lib/revenue-os/stripe-adapter.ts"), "utf8");
  if (id === "stripe") return stripeSource;
  // For other adapters, extract from integration-adapters.ts
  return integrationSource;
}

function assertNoVendoredCode(adapterId: string): void {
  // Heuristic: check that the adapter doesn't contain large chunks of upstream source
  const source = loadAdapterSource(adapterId);
  const lines = source.split("\n").length;
  assert.ok(
    lines < 2000,
    `${adapterId}: adapter source (${lines} lines) appears to contain vendored upstream code. Keep adapters thin.`,
  );
  // No minified or bundled output
  assert.ok(
    !source.includes("eval(") && !source.includes("Function("),
    `${adapterId}: adapter contains eval/Function - possible bundled code`,
  );
}

function assertCredentialEncryptionPattern(adapterId: string): void {
  const source = loadAdapterSource(adapterId);
  // Credentials must be accessed via resolveTenantProviderSecrets or decryptTenantSecret
  const hasDecrypt =
    source.includes("decryptTenantSecret") || source.includes("resolveTenantProviderSecrets");
  assert.ok(
    hasDecrypt,
    `${adapterId}: adapter must use decryptTenantSecret or resolveTenantProviderSecrets for credentials`,
  );
}

function assertBoundedClientPattern(adapterId: string): void {
  const source = loadFileSource(adapterId);
  // System context paths must use tenant-bound client.
  // Adapters either receive a pre-bound SupabaseClient or use createServiceRoleClient with context.
  const hasServiceClient =
    source.includes("createServiceRoleClient") ||
    source.includes("createPlatformServiceRoleClient");
  const hasTenantBinding =
    source.includes("tenantIdForDatabase") ||
    source.includes("bindTenantDatabase") ||
    source.includes("createServiceRoleClient");
  assert.ok(
    hasTenantBinding || hasServiceClient,
    `${adapterId}: adapter must use tenant-bound client (tenantIdForDatabase, bindTenantDatabase, or createServiceRoleClient)`,
  );
  // Must not use unbound client for writes
  if (source.includes("createPlatformServiceRoleClient")) {
    assert.ok(
      source.includes("createServiceRoleClient"),
      `${adapterId}: adapter uses createPlatformServiceRoleClient but should prefer createServiceRoleClient with context`,
    );
  }
}

function loadFileSource(adapterId: string): string {
  if (adapterId === "stripe") {
    return readFileSync(join(repoRoot, "src/lib/revenue-os/stripe-adapter.ts"), "utf8");
  }
  return readFileSync(join(repoRoot, "src/lib/revenue-os/integration-adapters.ts"), "utf8");
}

function runConformance(adapter: ExtsvcAdapterContract, adapterId: string): void {
  console.log(`\n=== Conformance: ${adapterId} ===`);
  const result = checkConformance(adapter);

  if (result.blockingFailures.length > 0) {
    console.error("BLOCKING FAILURES:");
    for (const f of result.blockingFailures) console.error(`  - ${f}`);
  }
  if (result.warnings.length > 0) {
    console.warn("WARNINGS:");
    for (const w of result.warnings) console.warn(`  - ${w}`);
  }

  if (result.blockingFailures.length > 0) {
    throw new Error(
      `${adapterId} failed ${result.blockingFailures.length} blocking conformance checks`,
    );
  }

  console.log(`✓ ${adapterId} passed all blocking checks`);

  // Static assertions
  assertNoVendoredCode(adapterId);
  console.log(`✓ ${adapterId} no vendored code`);

  assertCredentialEncryptionPattern(adapterId);
  console.log(`✓ ${adapterId} credential encryption pattern`);

  assertBoundedClientPattern(adapterId);
  console.log(`✓ ${adapterId} bounded client pattern`);
}

async function main() {
  console.log("Running External Capability Adapter Conformance Tests...");
  console.log(`Reference adapter: ${REFERENCE_ADAPTER_ID}`);

  // Test reference adapter (Stripe) - MUST pass all blocking
  console.log("\n--- Testing Reference Adapter ---");
  const stripeContract = {
    id: "stripe",
    name: "Stripe",
    category: "crm" as const,
    origin: {
      baseUrl: "https://api.stripe.com/v1",
      apiVersion: "2025-06-30.basil",
      maxResponseBytes: 262144,
      timeoutMs: 12000,
      supportsIdempotencyKeys: true,
    },
    transport: {
      maxResponseBytes: 262144,
      timeoutMs: 12000,
      followRedirects: false,
      cache: "no-store" as const,
    },
    versionPin: {
      project: "stripe-node",
      version: "14.0.0",
      reviewedAt: "2026-01-15T00:00:00.000Z",
    },
    credentialFields: [{ formField: "apiKey", encryptedKey: "api_key", required: true }],
    verify: stripeAdapter.verify,
    connect: stripeAdapter.connect,
    reconcile: stripeAdapter.reconcile,
    health: stripeAdapter.health,
  };

  runConformance(stripeContract, REFERENCE_ADAPTER_ID);
  console.log(`\n✓ ${REFERENCE_ADAPTER_ID} is a valid reference implementation`);

  // If other adapters exist in integration-adapters.ts, test them too
  const integrationSource = readFileSync(
    join(repoRoot, "src/lib/revenue-os/integration-adapters.ts"),
    "utf8",
  );
  const adapterIds = ["whatsApp", "hubSpot"]; // from integration-adapters.ts
  for (const id of adapterIds) {
    if (integrationSource.includes(`id: "${id}"`)) {
      console.log(`\n--- Testing ${id} (basic static checks) ---`);
      assertNoVendoredCode(id);
      assertCredentialEncryptionPattern(id);
      assertBoundedClientPattern(id);
      console.log(`✓ ${id} basic static checks passed`);
    }
  }

  console.log("\n=== All conformance tests passed ===");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
