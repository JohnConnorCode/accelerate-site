import assert from "node:assert/strict";
import { MemorySupabase } from "./lib/memory-supabase";
import { bindTenantDatabaseForTest } from "../src/lib/supabase/server";
import { ACCELERATE_TENANT_ID } from "../src/lib/tenancy/constants";
import {
  buildXeroAuthUrl,
  exchangeXeroCode,
  getXeroAccessToken,
  saveXeroConnection,
  verifyXeroConnection,
} from "../src/lib/revenue-os/xero";
import {
  createXeroOAuthStateBinding,
  verifyXeroOAuthStateBinding,
  XERO_OAUTH_STATE_TTL_SECONDS,
} from "../src/lib/revenue-os/xero-oauth";

// Deterministic fixture credentials. No real Xero account or network is used.
process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "xero-fixture-encryption-key-not-real";
process.env.XERO_CLIENT_ID = "xero-client-id";
process.env.XERO_CLIENT_SECRET = "xero-client-secret";
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";

type Call = { url: string; method: string; auth: string | null; body: string | null };
const realFetch = globalThis.fetch;
const calls: Call[] = [];
let tokenQueue: Array<{ status?: number; body: Record<string, unknown> }> = [];
let connectionsQueue: Array<{ status?: number; body: unknown }> = [];

function stubProvider() {
  globalThis.fetch = (async (url: string | URL, init: RequestInit = {}) => {
    const target = String(url);
    const headers = new Headers(init.headers as HeadersInit);
    calls.push({
      url: target,
      method: (init.method ?? "GET").toUpperCase(),
      auth: headers.get("authorization"),
      body: init.body === undefined ? null : String(init.body),
    });
    if (target.includes("identity.xero.com/connect/token")) {
      const next: { status?: number; body: Record<string, unknown> } = tokenQueue.shift() ?? {
        body: { access_token: "unexpected", expires_in: 1800, token_type: "Bearer" },
      };
      return Response.json(next.body, { status: next.status ?? 200 });
    }
    if (target.includes("api.xero.com/connections")) {
      const next = connectionsQueue.shift() ?? { body: [] };
      return Response.json(next.body as Record<string, unknown>, { status: next.status ?? 200 });
    }
    return new Response("unexpected provider call", { status: 404 });
  }) as typeof fetch;
}

const checks: string[] = [];

function connectionRow(memory: MemorySupabase) {
  const row = memory.rows("integration_connections")[0];
  assert.ok(row, "expected a stored Xero connection row");
  return row;
}

async function main() {
  // Signed, tenant-bound state binding, namespaced away from the Google one.
  const binding = createXeroOAuthStateBinding({
    state: "state-1",
    tenantId: ACCELERATE_TENANT_ID,
    tenantSlug: "accelerate",
  });
  const expected = {
    state: "state-1",
    tenantId: ACCELERATE_TENANT_ID,
    tenantSlug: "accelerate",
  };
  assert.equal(verifyXeroOAuthStateBinding(binding, expected), true);
  assert.equal(
    verifyXeroOAuthStateBinding(binding, { ...expected, state: "state-2" }),
    false,
    "a different state must not verify",
  );
  assert.equal(
    verifyXeroOAuthStateBinding(binding, { ...expected, tenantId: "other-tenant" }),
    false,
    "a binding for another tenant must not verify",
  );
  assert.equal(verifyXeroOAuthStateBinding(`${binding}x`, expected), false);
  assert.equal(verifyXeroOAuthStateBinding(undefined, expected), false);
  assert.equal(
    verifyXeroOAuthStateBinding(
      binding,
      expected,
      Date.now() + XERO_OAUTH_STATE_TTL_SECONDS * 1000 + 1,
    ),
    false,
    "an expired binding must not verify",
  );
  checks.push("OAuth state binding is signed, tenant-bound and expiring");

  stubProvider();

  // Authorize URL targets Xero identity with offline access for a refresh token.
  const url = new URL(buildXeroAuthUrl("state-1"));
  assert.equal(`${url.origin}${url.pathname}`, "https://login.xero.com/identity/connect/authorize");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("client_id"), "xero-client-id");
  assert.equal(url.searchParams.get("state"), "state-1");
  assert.match(url.searchParams.get("scope") ?? "", /\boffline_access\b/);
  assert.match(url.searchParams.get("redirect_uri") ?? "", /\/api\/admin\/xero\/callback$/);
  checks.push("authorize URL requests offline access from Xero identity");

  tokenQueue = [
    {
      body: {
        access_token: "access-1",
        refresh_token: "refresh-1",
        expires_in: 1800,
        scope: "offline_access accounting.transactions.read",
        token_type: "Bearer",
      },
    },
  ];
  calls.length = 0;
  const tokens = await exchangeXeroCode("code-abc");
  assert.equal(tokens.access_token, "access-1");
  const exchangeCall = calls.at(-1)!;
  assert.match(exchangeCall.auth ?? "", /^Basic /);
  assert.equal(
    Buffer.from((exchangeCall.auth ?? "").slice(6), "base64").toString("utf8"),
    "xero-client-id:xero-client-secret",
    "Xero requires client credentials on the token exchange",
  );
  const exchangeBody = new URLSearchParams(exchangeCall.body ?? "");
  assert.equal(exchangeBody.get("grant_type"), "authorization_code");
  assert.equal(exchangeBody.get("code"), "code-abc");
  checks.push("code exchange uses Basic client auth and the authorisation code");

  const memory = new MemorySupabase({
    tenants: [{ id: ACCELERATE_TENANT_ID, status: "active" }],
  });
  const database = bindTenantDatabaseForTest(memory.client, ACCELERATE_TENANT_ID);

  connectionsQueue = [
    {
      body: [
        { id: "conn-1", tenantId: "org-1", tenantName: "Buckley & Co", tenantType: "ORGANISATION" },
        { id: "conn-2", tenantId: "org-2", tenantName: "Second Org", tenantType: "ORGANISATION" },
      ],
    },
  ];
  await assert.rejects(
    () => saveXeroConnection(database, tokens),
    /explicit organisation selection/i,
  );
  assert.equal(memory.rows("integration_connections").length, 0);
  checks.push("an ambiguous initial organisation is refused without saving credentials");

  connectionsQueue = [
    {
      body: [
        { id: "conn-1", tenantId: "org-1", tenantName: "Buckley & Co", tenantType: "ORGANISATION" },
      ],
    },
  ];
  const saved = await saveXeroConnection(database, tokens);
  assert.equal(saved.tenantId, "org-1");
  assert.equal(saved.tenantName, "Buckley & Co");
  const row = connectionRow(memory);
  assert.equal(row.provider, "xero");
  assert.equal(row.status, "connected");
  assert.equal(row.account_email, "Buckley & Co");
  assert.match(String(row.encrypted_access_token), /^v2\./);
  assert.notEqual(row.encrypted_access_token, "access-1", "the access token must be encrypted");
  assert.match(String(row.encrypted_refresh_token), /^v2\./);
  const settings = row.settings as Record<string, unknown>;
  assert.equal(settings.xero_tenant_id, "org-1");
  assert.deepEqual(settings.xero_authorised_organisations, [
    { tenantId: "org-1", tenantName: "Buckley & Co" },
  ]);
  checks.push("connection save encrypts tokens and records the chosen organisation");

  connectionsQueue = [
    {
      body: [
        { id: "conn-2", tenantId: "org-2", tenantName: "Second Org" },
        { id: "conn-1", tenantId: "org-1", tenantName: "Buckley & Co" },
      ],
    },
  ];
  assert.equal((await saveXeroConnection(database, tokens)).tenantId, "org-1");
  checks.push(
    "reconnection preserves the recorded organisation rather than choosing the first result",
  );

  // A connection save without any refresh token would silently break offline
  // access, so it must be refused.
  const empty = new MemorySupabase({ tenants: [{ id: ACCELERATE_TENANT_ID, status: "active" }] });
  const emptyDb = bindTenantDatabaseForTest(empty.client, ACCELERATE_TENANT_ID);
  connectionsQueue = [{ body: [{ id: "conn-1", tenantId: "org-1" }] }];
  await assert.rejects(
    () =>
      saveXeroConnection(emptyDb, { access_token: "a", expires_in: 1800, token_type: "Bearer" }),
    /refresh token/i,
  );
  checks.push("a connection without a refresh token is refused");

  // Refresh must persist the rotated token before reporting success.
  connectionRow(memory).token_expires_at = new Date(Date.now() - 1000).toISOString();
  tokenQueue = [
    {
      body: {
        access_token: "access-2",
        refresh_token: "refresh-2",
        expires_in: 1800,
        token_type: "Bearer",
      },
    },
  ];
  const previousRefresh = row.encrypted_refresh_token;
  const access = await getXeroAccessToken(database);
  assert.equal(access.token, "access-2");
  assert.equal(access.tenantId, "org-1");
  const rotated = connectionRow(memory);
  assert.notEqual(
    rotated.encrypted_refresh_token,
    previousRefresh,
    "the rotated refresh token must replace the old one",
  );
  assert.match(String(rotated.encrypted_refresh_token), /^v2\./);
  checks.push("token refresh rotates and persists the new refresh token");

  const otherTenantId = "99999999-9999-4999-8999-999999999999";
  const copied = new MemorySupabase({
    tenants: [{ id: otherTenantId, status: "active" }],
    integration_connections: [{ ...rotated, tenant_id: otherTenantId }],
  });
  await assert.rejects(() =>
    getXeroAccessToken(bindTenantDatabaseForTest(copied.client, otherTenantId)),
  );
  checks.push("copied credentials cannot be decrypted in another workspace");

  for (const failure of ["save-error", "disconnect", "rotation"] as const) {
    const broken = new MemorySupabase({
      tenants: [{ id: ACCELERATE_TENANT_ID, status: "active" }],
      integration_connections: [{ ...rotated, token_expires_at: new Date(0).toISOString() }],
    });
    const brokenDb = bindTenantDatabaseForTest(broken.client, ACCELERATE_TENANT_ID);
    tokenQueue = [
      {
        body: {
          access_token: "unsaved-access",
          refresh_token: "unsaved-refresh",
          expires_in: 1800,
          token_type: "Bearer",
        },
      },
    ];
    const providerFetch = globalThis.fetch;
    globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
      const response = await providerFetch(...args);
      if (failure === "save-error")
        broken.fail("integration_connections", { message: "simulated save failure" });
      if (failure === "disconnect") connectionRow(broken).status = "disconnected";
      if (failure === "rotation")
        connectionRow(broken).encrypted_refresh_token = "newer-connection";
      return response;
    }) as typeof fetch;
    try {
      await assert.rejects(() => getXeroAccessToken(brokenDb), /could not be saved/i, failure);
      if (failure === "disconnect") assert.equal(connectionRow(broken).status, "disconnected");
      if (failure === "rotation") {
        assert.equal(connectionRow(broken).encrypted_refresh_token, "newer-connection");
        assert.equal(connectionRow(broken).status, "connected");
      }
    } finally {
      globalThis.fetch = providerFetch;
      broken.recover("integration_connections");
    }
  }
  checks.push(
    "failed saves, disconnection and newer credentials cannot produce a successful refresh receipt",
  );

  // A cached, still-valid access token must not trigger another refresh.
  calls.length = 0;
  const cached = await getXeroAccessToken(database);
  assert.equal(cached.token, "access-2");
  assert.equal(calls.length, 0, "a valid cached token must not call the provider");
  checks.push("a valid cached access token is reused");

  // Verification probes Xero and rejects an organisation that is no longer
  // authorised.
  connectionsQueue = [{ body: [{ id: "conn-1", tenantId: "org-1", tenantName: "Buckley & Co" }] }];
  const verified = await verifyXeroConnection(database);
  assert.equal(verified.tenantId, "org-1");
  checks.push("connection verification confirms the recorded organisation");

  connectionsQueue = [{ body: [{ id: "conn-2", tenantId: "org-9", tenantName: "Other" }] }];
  await assert.rejects(() => verifyXeroConnection(database), /no longer authorises/i);
  checks.push("verification rejects an unauthorised organisation");

  // An invalid grant is a permanent failure: mark the connection revoked so the
  // operator is told to reconnect rather than retrying forever.
  connectionRow(memory).token_expires_at = new Date(Date.now() - 1000).toISOString();
  tokenQueue = [
    { status: 400, body: { error: "invalid_grant", error_description: "refresh token expired" } },
  ];
  await assert.rejects(() => getXeroAccessToken(database), /invalid_grant/i);
  assert.equal(connectionRow(memory).status, "revoked");
  checks.push("an invalid grant marks the connection revoked");

  // An organisation that was never authorised cannot be saved.
  const blank = new MemorySupabase({ tenants: [{ id: ACCELERATE_TENANT_ID, status: "active" }] });
  const blankDb = bindTenantDatabaseForTest(blank.client, ACCELERATE_TENANT_ID);
  connectionsQueue = [{ body: [] }];
  await assert.rejects(
    () =>
      saveXeroConnection(blankDb, {
        access_token: "a",
        refresh_token: "r",
        expires_in: 1800,
        token_type: "Bearer",
      }),
    /no authorised organisation/i,
  );
  checks.push("a connection with no authorised organisation is refused");

  console.log(JSON.stringify({ checks, result: "passed" }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    globalThis.fetch = realFetch;
  });
