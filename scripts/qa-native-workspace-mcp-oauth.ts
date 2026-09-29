import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { createRequire } from "node:module";
import {
  authenticateWorkspaceMcp,
  manageWorkspaceMcpDelegation,
} from "../src/lib/revenue-os/workspace-mcp-oauth";
import { createServiceRoleClient } from "../src/lib/supabase/server";
import { runWithTenantRequestContext } from "../src/lib/tenancy/context";
import { POST } from "../src/app/api/public/[tenantSlug]/mcp/oauth/route";
const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");
const root = process.env.RUNNER_TEMP
  ? process.env.RUNNER_TEMP + "/accelerate-native-mcp-oauth"
  : "/tmp/accelerate-native-mcp-oauth";
mkdirSync(root, { recursive: true, mode: 0o700 });
const receipt: { checks: string[]; status: string; nativeVersion?: string; failure?: string } = {
  checks: [],
  status: "running",
};
const check = (name: string) => {
  receipt.checks.push(name);
  console.log("PASS: " + name);
};
async function main() {
  process.loadEnvFile(".env.local");
  assert.equal(
    process.env.SUPABASE_PROJECT_REF,
    "fork-connected-ci",
    "Only the isolated CI fixture may run this proof",
  );
  const status = {
    API_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  };
  assert.equal(new URL(status.API_URL).origin, "http://127.0.0.1:54321");
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    ADMIN_EMAIL: "owner@fictional.example",
    MCP_WORKSPACE_OAUTH_CLIENTS: "{}",
  });
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const platform = createClient(status.API_URL, status.SERVICE_ROLE_KEY, options);
  const human = createClient(status.API_URL, status.ANON_KEY, options);
  const email = "admin@fictional.example";
  const password = randomBytes(32).toString("base64url");
  const user = await platform.auth.admin.createUser({ email, password, email_confirm: true });
  assert.equal(user.error, null, "native user creation");
  const login = await human.auth.signInWithPassword({ email, password });
  assert.equal(login.error, null, "native password session");
  const nativeClient = await platform.auth.admin.oauth.createClient({
    client_name: "Fictional MCP review",
    redirect_uris: ["http://localhost:3000/callback"],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    scope: "openid email",
    token_endpoint_auth_method: "none",
  });
  assert.equal(nativeClient.error, null, "native client registration");
  const clientId = nativeClient.data.client_id;
  assert.equal(typeof clientId, "string");
  process.env.MCP_WORKSPACE_OAUTH_CLIENTS = JSON.stringify({ "native-review": clientId });
  const tenant = {
    id: randomUUID(),
    slug: "native-review",
    name: "Fictional native review",
    status: "active" as const,
    config: { modules: {} },
  };
  assert.equal((await platform.from("tenants").insert(tenant)).error, null, "fictional workspace");
  assert.equal(
    (
      await platform.from("tenant_memberships").insert({
        tenant_id: tenant.id,
        user_id: user.data.user.id,
        invited_email: email,
        role: "admin",
        status: "active",
      })
    ).error,
    null,
    "fictional membership",
  );
  const database = createServiceRoleClient({
    kind: "system",
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    source: "native-oauth-verification",
  });
  const actor = {
    kind: "actor" as const,
    tenant,
    user: { id: user.data.user.id, email },
    role: "admin" as const,
    isPlatformAdmin: false,
    database,
  };
  const grant = await runWithTenantRequestContext(actor, () =>
    manageWorkspaceMcpDelegation(actor, { operation: "grant" }),
  );
  check("Canonical fictional workspace delegation");
  const resource = process.env.NEXT_PUBLIC_SITE_URL + "/api/public/native-review/mcp/oauth";
  const issuer = status.API_URL + "/auth/v1";
  let refreshToken = "";
  const health = await fetch(issuer + "/health");
  if (health.ok) receipt.nativeVersion = (await health.json()).version;
  async function authorize(approve: boolean) {
    const verifier = randomBytes(48).toString("base64url");
    const state = randomUUID();
    const url = new URL(issuer + "/oauth/authorize");
    url.search = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: process.env.NEXT_PUBLIC_SITE_URL + "/callback",
      scope: "openid email",
      state,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
      resource,
    }).toString();
    const start = await fetch(url, { redirect: "manual" });
    assert.equal(start.status, 302, "native OAuth authorization redirect");
    const authorizationId = new URL(start.headers.get("location")!).searchParams.get(
      "authorization_id",
    );
    assert.ok(authorizationId, "native authorization ID");
    const details = await human.auth.oauth.getAuthorizationDetails(authorizationId);
    assert.equal(details.error, null, "native authorization details");
    const consent = approve
      ? await human.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
      : await human.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
    assert.equal(consent.error, null, "native consent");
    const redirect = new URL(consent.data.redirect_url);
    assert.equal(redirect.searchParams.get("state"), state);
    if (!approve) {
      assert.equal(redirect.searchParams.get("error"), "access_denied");
      check("Native OAuth refusal preserves state");
      return "";
    }
    const code = redirect.searchParams.get("code");
    assert.ok(code, "native authorization code");
    const exchange = await fetch(issuer + "/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", apikey: status.ANON_KEY },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        redirect_uri: process.env.NEXT_PUBLIC_SITE_URL + "/callback",
        code,
        code_verifier: verifier,
        resource,
      }),
    });
    assert.equal(exchange.status, 200, "native PKCE token exchange");
    const tokens = await exchange.json();
    assert.equal(typeof tokens.access_token, "string");
    refreshToken = tokens.refresh_token;
    check("Native OAuth approval and PKCE exchange");
    return tokens.access_token as string;
  }
  await authorize(false);
  const token = await authorize(true);
  const claims = await human.auth.getClaims(token);
  assert.equal(claims.error, null, "native signed JWT");
  assert.equal(claims.data.claims.aud, resource);
  assert.equal(claims.data.claims.role, "mcp_workspace");
  assert.equal(claims.data.claims.client_id, clientId);
  check("Native hook limits role and audience to the workspace");
  const authenticated = await authenticateWorkspaceMcp(token, tenant.slug);
  assert.equal(authenticated.grant.id, grant.id);
  check("Canonical verifier accepts native user, grant, session and delegation");
  const rpc = async (method: string, params = {}) =>
    POST(
      new Request(resource, {
        method: "POST",
        headers: { authorization: "Bearer " + token, "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      }),
      { params: Promise.resolve({ tenantSlug: tenant.slug }) },
    );
  const initialized = await rpc("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "fictional native test", version: "1" },
  });
  assert.equal(initialized.status, 200);
  assert.equal((await initialized.json()).result.protocolVersion, "2025-06-18");
  const listed = await rpc("tools/list");
  assert.equal(listed.status, 200);
  assert.ok((await listed.json()).result.tools.length > 0);
  check("Real native OAuth reaches canonical MCP initialize and discovery");
  const staged = await rpc("tools/call", {
    name: "propose_task",
    arguments: { title: "Fictional native OAuth task", priority: "low" },
  });
  assert.equal(staged.status, 200);
  assert.equal((await staged.json()).result.isError, false, "native OAuth proposal");
  const pending = await platform
    .from("action_queue")
    .select("id,status")
    .eq("tenant_id", tenant.id);
  assert.equal(pending.error, null);
  assert.equal(pending.data.length, 1);
  assert.equal(pending.data[0].status, "pending");
  const tasks = await platform.from("tasks").select("id").eq("tenant_id", tenant.id);
  assert.equal(tasks.error, null);
  assert.equal(tasks.data.length, 0);
  check("Native MCP stages one task proposal without applying the task");
  const direct = createClient(status.API_URL, status.ANON_KEY, {
    ...options,
    global: { headers: { Authorization: "Bearer " + token } },
  });
  assert.ok(
    (await direct.from("tenant_memberships").select("id")).error,
    "OAuth has no direct Data API privilege",
  );
  check("Workspace OAuth token cannot read the Data API");
  await runWithTenantRequestContext(actor, () =>
    manageWorkspaceMcpDelegation(actor, { operation: "revoke", grantId: grant.id }),
  );
  await assert.rejects(authenticateWorkspaceMcp(token, tenant.slug), /delegation.*revoked/);
  check("Local delegation revocation refuses an existing native token");
  const refreshed = await fetch(issuer + "/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", apikey: status.ANON_KEY },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: refreshToken,
      resource,
    }),
  });
  assert.equal(refreshed.status, 200, "native refresh exchange");
  const refreshedTokens = await refreshed.json();
  await assert.rejects(
    authenticateWorkspaceMcp(refreshedTokens.access_token, tenant.slug),
    /delegation.*revoked/,
  );
  check("Native refresh cannot restore revoked workspace authority");
  await runWithTenantRequestContext(actor, () =>
    manageWorkspaceMcpDelegation(actor, { operation: "grant" }),
  );
  assert.equal(
    (
      await platform
        .from("tenant_memberships")
        .update({ status: "revoked" })
        .eq("tenant_id", tenant.id)
    ).error,
    null,
  );
  await assert.rejects(authenticateWorkspaceMcp(token, tenant.slug), /delegation/);
  check("Live membership revocation refuses an existing native token");
  assert.equal(
    (
      await platform
        .from("tenant_memberships")
        .update({ status: "active" })
        .eq("tenant_id", tenant.id)
    ).error,
    null,
  );
  assert.equal((await human.auth.oauth.revokeGrant({ clientId })).error, null);
  await assert.rejects(authenticateWorkspaceMcp(token, tenant.slug));
  check("Native OAuth revocation refuses an existing token");
  receipt.status = "passed";
}
main()
  .catch((error) => {
    receipt.status = "failed";
    receipt.failure = error.message;
    console.error("Native verification failed: " + error.message);
    process.exitCode = 1;
  })
  .finally(() => {
    writeFileSync(root + "/native-result.json", JSON.stringify(receipt, null, 2), { mode: 0o600 });
  });
