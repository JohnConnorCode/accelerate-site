#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { openRouterChat, OpenRouterError } from "../src/lib/ai/openrouter";
import {
  OpenRouterCredentialError,
  resolveOpenRouterCredentialPolicy,
  validateOpenRouterApiKey,
} from "../src/lib/ai/openrouter-credentials";
import { decryptTenantSecret, encryptTenantSecret, isTenantEncryptedSecret } from "../src/lib/revenue-os/encryption";
import { ACCELERATE_TENANT_ID } from "../src/lib/tenancy/context";

const original = {
  fetch: globalThis.fetch,
  encryptionKey: process.env.GOOGLE_TOKEN_ENCRYPTION_KEY,
  openRouterKey: process.env.OPENROUTER_API_KEY,
  nodeEnv: process.env.NODE_ENV,
};
const mutableEnv = process.env as Record<string, string | undefined>;
process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "tenant-openrouter-test-encryption-key";

async function main() {
  const alpha = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const beta = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const secret = "sk-or-v1-tenant-key-abcdefghijklmnopqrstuvwxyz";
  const envelope = encryptTenantSecret(secret, alpha, "openrouter", "api_key");
  assert.equal(isTenantEncryptedSecret(envelope), true);
  assert.equal(decryptTenantSecret(envelope, alpha, "openrouter", "api_key"), secret);
  assert.throws(() => decryptTenantSecret(envelope, beta, "openrouter", "api_key"), /authenticate|Unsupported|unable/i, "ciphertext copied to another tenant must fail authentication");
  assert.throws(() => decryptTenantSecret(envelope, alpha, "resend", "api_key"), /authenticate|Unsupported|unable/i, "ciphertext copied to another provider must fail authentication");

  const tenantCredential = resolveOpenRouterCredentialPolicy({ tenantId: alpha, connection: { status: "connected", encrypted_credentials: { api_key: envelope }, environment_fallback_allowed: false }, platformKey: "platform-secret" });
  assert.equal(tenantCredential?.source, "tenant");
  assert.equal(tenantCredential?.apiKey, secret);
  assert.equal(resolveOpenRouterCredentialPolicy({ tenantId: beta, connection: null, platformKey: "platform-secret" }), null, "client tenants must never inherit the platform key");
  assert.equal(resolveOpenRouterCredentialPolicy({ tenantId: ACCELERATE_TENANT_ID, connection: null, platformKey: "platform-secret" })?.source, "platform", "bootstrap may use the explicit migration fallback");
  assert.equal(resolveOpenRouterCredentialPolicy({ tenantId: ACCELERATE_TENANT_ID, connection: { status: "revoked", encrypted_credentials: {}, environment_fallback_allowed: false }, platformKey: "platform-secret" }), null, "disconnect must override bootstrap fallback");
  assert.throws(() => resolveOpenRouterCredentialPolicy({ tenantId: beta, connection: { status: "connected", encrypted_credentials: { api_key: envelope }, environment_fallback_allowed: false }, platformKey: null }), OpenRouterCredentialError, "a tenant-bound envelope cannot be replayed under another tenant ID");

  let verificationCalls = 0;
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    verificationCalls += 1;
    assert.match(String(new Headers(init?.headers).get("authorization")), /^Bearer sk-or-v1-/);
    return new Response(JSON.stringify({ data: { label: "tenant-prod…123", limit: 50, limit_remaining: 42.5, limit_reset: "monthly", usage: 7.5, is_free_tier: false, expires_at: "2027-01-01T00:00:00Z" } }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  const metadata = await validateOpenRouterApiKey(secret);
  assert.deepEqual({ label: metadata.label, limit: metadata.limit, remaining: metadata.limitRemaining, usage: metadata.usage }, { label: "tenant-prod…123", limit: 50, remaining: 42.5, usage: 7.5 });
  assert.equal(verificationCalls, 1);
  await assert.rejects(() => validateOpenRouterApiKey("not-a-key"), (error: unknown) => error instanceof OpenRouterCredentialError && error.status === 400);
  assert.equal(verificationCalls, 1, "invalid key shape must fail before provider traffic");

  globalThis.fetch = (async () => new Response(JSON.stringify({ error: { message: "Unauthorized" } }), { status: 401 })) as typeof fetch;
  await assert.rejects(() => validateOpenRouterApiKey(secret), (error: unknown) => error instanceof OpenRouterCredentialError && error.status === 400);

  mutableEnv.NODE_ENV = "production";
  process.env.OPENROUTER_API_KEY = secret;
  let providerCalled = false;
  globalThis.fetch = (async () => { providerCalled = true; return new Response(); }) as typeof fetch;
  await assert.rejects(() => openRouterChat({ messages: [{ role: "user", content: "hello" }] }), (error: unknown) => error instanceof OpenRouterError && /tenant context/i.test(error.message));
  assert.equal(providerCalled, false, "production gateway must reject unscoped calls before provider traffic");

  const providerApi = readFileSync("src/app/api/admin/tenant/providers/route.ts", "utf8");
  assert.ok(providerApi.indexOf("const metadata = await validateOpenRouterApiKey") < providerApi.indexOf("encrypted_credentials: { api_key: encryptTenantSecret"), "key verification must precede the OpenRouter connection write");
  assert.ok(providerApi.includes('environment_fallback_allowed: false'));
  assert.ok(providerApi.includes('encrypted_credentials: { api_key: encryptTenantSecret'));
  assert.doesNotMatch(providerApi, /NextResponse\.json\([^)]*apiKey/, "plaintext API keys must never be returned");

  const productCallers = [
    "src/app/api/chat/route.ts",
    "src/app/api/generate-plan/route.ts",
    "src/app/api/admin/proposals/generate/route.ts",
    "src/app/api/admin/ai-content-brief/route.ts",
    "src/app/api/admin/settings/test/route.ts",
    "src/lib/revenue-os/ai-agent.ts",
    "src/lib/revenue-os/auto-responder.ts",
    "src/lib/revenue-os/contact-imports.ts",
  ];
  for (const file of productCallers) assert.match(readFileSync(file, "utf8"), /database:/, `${file} must pass explicit tenant database context to OpenRouter`);

  console.log(JSON.stringify({ result: "passed", checks: 16, productCallers: productCallers.length }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => {
  globalThis.fetch = original.fetch;
  if (original.encryptionKey === undefined) delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY; else process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = original.encryptionKey;
  if (original.openRouterKey === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = original.openRouterKey;
  if (original.nodeEnv === undefined) delete mutableEnv.NODE_ENV; else mutableEnv.NODE_ENV = original.nodeEnv;
});
