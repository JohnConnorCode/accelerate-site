import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import {
  authenticateWorkspaceMcp,
  workspaceMcpOAuthConfig,
} from "../src/lib/revenue-os/workspace-mcp-oauth";

async function main() {
  const previous = { ...process.env };
  const previousFetch = globalThis.fetch;
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const userId = "22222222-2222-4222-8222-222222222222";
  const clientId = "33333333-3333-4333-8333-333333333333";
  const sessionId = "44444444-4444-4444-8444-444444444444";
  const grantId = "55555555-5555-4555-8555-555555555555";
  const issuer = "https://controlled-auth.example.test/auth/v1";
  const resource = "https://controlled-site.example.test/api/public/northline/mcp/oauth";
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "https://controlled-auth.example.test",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "controlled-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "controlled-host-key",
    NEXT_PUBLIC_SITE_URL: "https://controlled-site.example.test",
    MCP_WORKSPACE_OAUTH_CLIENTS: JSON.stringify({ northline: clientId }),
    ADMIN_EMAIL: "owner@example.test",
  });
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = {
    ...publicKey.export({ format: "jwk" }),
    kid: "controlled",
    alg: "ES256",
    use: "sig",
  };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = (changes = {}, key = privateKey) => {
    const body = `${encode({ alg: "ES256", kid: "controlled", typ: "JWT" })}.${encode({ iss: issuer, aud: resource, role: "mcp_workspace", sub: userId, session_id: sessionId, client_id: clientId, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300, ...changes })}`;
    return `${body}.${sign("sha256", Buffer.from(body), { key, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
  };
  let nativeGrant = true;
  let membership = true;
  let localGrant = true;
  let sessionActive = true;
  let hostCalls = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://controlled-auth.example.test");
    if (url.pathname.endsWith("/.well-known/jwks.json")) return Response.json({ keys: [jwk] });
    if (url.pathname === "/auth/v1/user")
      return Response.json({ id: userId, email: "admin@example.test", is_anonymous: false });
    if (url.pathname === "/auth/v1/user/oauth/grants") {
      assert.equal(init?.cache, "no-store");
      return Response.json(nativeGrant ? [{ client: { id: clientId } }] : []);
    }
    hostCalls++;
    const headers = new Headers(init?.headers);
    if (url.pathname === "/rest/v1/tenants") {
      assert.equal(headers.get("x-tenant-id"), null);
      return Response.json({
        id: tenantId,
        slug: "northline",
        name: "Northline",
        status: "active",
        config: { modules: {} },
      });
    }
    assert.equal(headers.get("x-tenant-id"), tenantId);
    if (url.pathname === "/rest/v1/tenant_memberships")
      return Response.json(membership ? { role: "admin", status: "active" } : null);
    if (url.pathname === "/rest/v1/workspace_mcp_delegations")
      return Response.json(
        localGrant
          ? {
              id: grantId,
              tenant_id: tenantId,
              user_id: userId,
              client_id: clientId,
              resource,
              created_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 3600000).toISOString(),
              revoked_at: null,
            }
          : null,
      );
    if (url.pathname === "/rest/v1/rpc/authorize_workspace_mcp_delegation")
      return sessionActive
        ? Response.json({ id: grantId })
        : Response.json({ message: "revoked" }, { status: 403 });
    throw new Error(`Unexpected controlled request: ${url.pathname}`);
  };
  try {
    assert.equal(workspaceMcpOAuthConfig("northline").resource, resource);
    const { GET: metadata } = await import(
      "../src/app/.well-known/oauth-protected-resource/api/public/[tenantSlug]/mcp/oauth/route"
    );
    const meta = await metadata(new Request(resource), {
      params: Promise.resolve({ tenantSlug: "northline" }),
    });
    assert.equal(meta.status, 200);
    assert.equal((await meta.json()).resource, resource);
    const { POST } = await import("../src/app/api/public/[tenantSlug]/mcp/oauth/route");
    const challenge = await POST(new Request(resource, { method: "POST" }), {
      params: Promise.resolve({ tenantSlug: "northline" }),
    });
    assert.equal(challenge.status, 401);
    assert.match(challenge.headers.get("www-authenticate") ?? "", /resource_metadata=/);
    const accepted = await authenticateWorkspaceMcp(token(), "northline");
    assert.equal(accepted.auth.tenant.id, tenantId);
    assert.equal(accepted.auth.user.email, "admin@example.test");
    for (const changes of [
      { iss: "https://wrong.test/auth/v1" },
      { aud: "authenticated" },
      { role: "authenticated" },
      { client_id: sessionId },
      { session_id: "" },
      { sub: "" },
      { exp: 1 },
    ]) {
      const before = hostCalls;
      await assert.rejects(authenticateWorkspaceMcp(token(changes), "northline"));
      assert.equal(hostCalls, before, "invalid claims never reach the host database");
    }
    const forged = generateKeyPairSync("ec", { namedCurve: "prime256v1" }).privateKey;
    await assert.rejects(authenticateWorkspaceMcp(token({}, forged), "northline"));
    nativeGrant = false;
    await assert.rejects(authenticateWorkspaceMcp(token(), "northline"), /revoked/);
    nativeGrant = true;
    membership = false;
    await assert.rejects(authenticateWorkspaceMcp(token(), "northline"), /delegation/);
    membership = true;
    localGrant = false;
    await assert.rejects(authenticateWorkspaceMcp(token(), "northline"), /delegation/);
    localGrant = true;
    sessionActive = false;
    await assert.rejects(authenticateWorkspaceMcp(token(), "northline"), /revoked/);
    process.env.SITE_STUDIO_OAUTH_CLIENT_IDS = clientId;
    assert.throws(() => workspaceMcpOAuthConfig("northline"), /unique/);
    console.log(
      "PASS: signed workspace OAuth token, tenant binding, client/audience checks, native and local grant, membership, and session revocation.",
    );
  } finally {
    globalThis.fetch = previousFetch;
    for (const key of Object.keys(process.env))
      if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
