import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import {
  authenticateSiteEditor,
  isVerifiedSiteDelegation,
} from "../src/lib/site-studio/delegation";
import { ACCELERATE_TENANT_ID } from "../src/lib/tenancy/constants";

async function main() {
  const oldEnvironment = { ...process.env },
    originalFetch = globalThis.fetch;
  const user = "11111111-1111-4111-8111-111111111111",
    client = "22222222-2222-4222-8222-222222222222";
  const session = "33333333-3333-4333-8333-333333333333",
    grantId = "44444444-4444-4444-8444-444444444444";
  const issuer = "https://controlled-auth.example.test/auth/v1",
    resource = "https://controlled-site.example.test/api/mcp/site-studio";
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "https://controlled-auth.example.test",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "controlled-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "controlled-host-key",
    NEXT_PUBLIC_SITE_URL: "https://controlled-site.example.test",
    SITE_STUDIO_OAUTH_CLIENT_IDS: client,
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
    const body = `${encode({ alg: "ES256", kid: "controlled", typ: "JWT" })}.${encode({ iss: issuer, aud: resource, role: "mcp_site_editor", sub: user, session_id: session, client_id: client, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300, ...changes })}`;
    return `${body}.${sign("sha256", Buffer.from(body), { key, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
  };
  let email = "owner@example.test",
    nativeGrant = true,
    membership = true,
    enabled = true,
    localGrant = true,
    sessionActive = true;
  let hostCalls = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(
      url.origin,
      "https://controlled-auth.example.test",
      "test never contacts a live provider",
    );
    if (url.pathname.endsWith("/.well-known/jwks.json")) return Response.json({ keys: [jwk] });
    if (url.pathname === "/auth/v1/user")
      return Response.json({
        id: user,
        email,
        aud: resource,
        role: "mcp_site_editor",
        is_anonymous: false,
      });
    if (url.pathname === "/auth/v1/user/oauth/grants") {
      assert.equal(init?.cache, "no-store");
      return Response.json(nativeGrant ? [{ client: { id: client } }] : []);
    }
    hostCalls++;
    assert.equal(new Headers(init?.headers).get("x-tenant-id"), ACCELERATE_TENANT_ID);
    if (url.pathname === "/rest/v1/tenants")
      return Response.json({
        id: ACCELERATE_TENANT_ID,
        status: "active",
        config: { modules: { "site-studio": enabled } },
      });
    if (url.pathname === "/rest/v1/tenant_memberships")
      return Response.json(membership ? { role: "admin", status: "active" } : null);
    if (url.pathname === "/rest/v1/site_editor_delegations")
      return Response.json(
        localGrant
          ? {
              id: grantId,
              tenant_id: ACCELERATE_TENANT_ID,
              user_id: user,
              client_id: client,
              resource,
              created_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 3600000).toISOString(),
              revoked_at: null,
            }
          : null,
      );
    if (url.pathname === "/rest/v1/rpc/authorize_site_editor_delegation")
      return sessionActive
        ? Response.json({ id: grantId })
        : Response.json({ message: "revoked" }, { status: 403 });
    throw new Error(`Unexpected controlled request: ${url.pathname}`);
  };
  try {
    assert.equal(isVerifiedSiteDelegation(await authenticateSiteEditor(token())), true);
    for (const changes of [
      { iss: "https://wrong.test/auth/v1" },
      { aud: "authenticated" },
      { role: "authenticated" },
      { client_id: session },
      { session_id: "" },
      { sub: "" },
      { exp: 1 },
    ]) {
      const before = hostCalls;
      await assert.rejects(authenticateSiteEditor(token(changes)));
      assert.equal(hostCalls, before, "invalid claims never get a privileged database client");
    }
    const forgedKey = generateKeyPairSync("ec", { namedCurve: "prime256v1" }).privateKey;
    await assert.rejects(authenticateSiteEditor(token({}, forgedKey)));
    email = "tenant-admin@example.test";
    await assert.rejects(authenticateSiteEditor(token()), /owner/);
    email = "owner@example.test";
    nativeGrant = false;
    await assert.rejects(authenticateSiteEditor(token()), /revoked/);
    nativeGrant = true;
    membership = false;
    await assert.rejects(authenticateSiteEditor(token()), /delegation/);
    membership = true;
    enabled = false;
    await assert.rejects(authenticateSiteEditor(token()), /disabled/);
    enabled = true;
    localGrant = false;
    await assert.rejects(authenticateSiteEditor(token()), /delegation/);
    localGrant = true;
    sessionActive = false;
    await assert.rejects(authenticateSiteEditor(token()), /revoked/);
    console.log(
      "PASS: real SDK signed-JWT verification, signature/issuer/audience/client/expiry checks, owner identity, live native grant, membership, module and session revocation.",
    );
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env))
      if (!(key in oldEnvironment)) delete process.env[key];
    Object.assign(process.env, oldEnvironment);
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
