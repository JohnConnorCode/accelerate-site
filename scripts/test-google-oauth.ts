import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GOOGLE_OAUTH_STATE_TTL_SECONDS,
  createGoogleOAuthStateBinding,
  googleOperatorError,
  googleServerErrorSummary,
  verifyGoogleOAuthStateBinding,
} from "../src/lib/revenue-os/google-oauth";
import {
  buildGoogleAuthUrl,
  GOOGLE_GMAIL_DRAFT_SCOPE,
  GOOGLE_SCOPES,
} from "../src/lib/revenue-os/google";

const previousKey = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
const previousClientId = process.env.GOOGLE_CLIENT_ID;
const previousClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "deterministic-test-key-that-never-leaves-this-process";
process.env.GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
process.env.NEXT_PUBLIC_SITE_URL = "https://example.test";

try {
  const now = Date.parse("2026-08-31T12:00:00.000Z");
  const baseScopes = new URL(buildGoogleAuthUrl("state")).searchParams.get("scope")!.split(" ");
  const draftScopes = new URL(
    buildGoogleAuthUrl("state", { includeGmailDrafts: true }),
  ).searchParams
    .get("scope")!
    .split(" ");
  assert.deepEqual(baseScopes, GOOGLE_SCOPES, "ordinary Google consent must not add draft access");
  assert.ok(!baseScopes.includes(GOOGLE_GMAIL_DRAFT_SCOPE));
  assert.deepEqual(draftScopes, [...GOOGLE_SCOPES, GOOGLE_GMAIL_DRAFT_SCOPE]);
  const expected = { state: "state-value", tenantId: "tenant-alpha", tenantSlug: "alpha" };
  const binding = createGoogleOAuthStateBinding(expected, now);
  assert.equal(verifyGoogleOAuthStateBinding(binding, expected, now), true);
  assert.equal(
    verifyGoogleOAuthStateBinding(binding, { ...expected, tenantId: "tenant-beta" }, now),
    false,
  );
  assert.equal(
    verifyGoogleOAuthStateBinding(binding, { ...expected, tenantSlug: "beta" }, now),
    false,
  );
  assert.equal(verifyGoogleOAuthStateBinding(`${binding.slice(0, -1)}x`, expected, now), false);
  assert.equal(
    verifyGoogleOAuthStateBinding(
      binding,
      expected,
      now + GOOGLE_OAUTH_STATE_TTL_SECONDS * 1000 + 1,
    ),
    false,
  );

  assert.equal(
    googleOperatorError(new Error("Google OAuth is not configured"), "authorize").code,
    "not_configured",
  );
  assert.equal(
    googleOperatorError(new Error("invalid_grant: token payload detail"), "connection-test").code,
    "reconnect_required",
  );
  assert.equal(
    googleOperatorError(new Error("database host internal detail"), "callback").code,
    "connection_failed",
  );
  assert.equal(
    googleOperatorError(new Error("provider payload internal detail"), "sync").code,
    "sync_failed",
  );
  const summary = googleServerErrorSummary(
    new Error("provider payload internal detail"),
    "callback",
  );
  assert.deepEqual(summary, {
    operation: "callback",
    code: "connection_failed",
    errorType: "Error",
  });
  assert.equal(JSON.stringify(summary).includes("provider payload"), false);

  const setupSource = readFileSync("src/app/api/admin/setup/route.ts", "utf8");
  assert.match(
    setupSource,
    /createBootstrapServiceRoleClient\("bootstrap-setup-center"\)/,
    "Setup provider receipts must use the bootstrap tenant client",
  );
  assert.match(
    setupSource,
    /platform\s*\.from\("feature_requests"\)/,
    "Setup platform facts must remain on the platform client",
  );
  assert.match(
    setupSource,
    /isEncryptedSecret\(google\.encrypted_refresh_token\)/,
    "Setup health must validate the refresh-token envelope without returning it",
  );
  const setupPage = readFileSync("src/app/admin/setup/page.tsx", "utf8");
  assert.match(setupPage, /Encrypted credential health/, "Setup must render token-envelope health");
  assert.match(
    setupPage,
    /data\.google\.scopes\.map/,
    "Setup must render every granted scope exactly",
  );
  assert.match(setupPage, /Grant Gmail draft access/);
  assert.match(
    readFileSync("src/app/api/admin/google/authorize/route.ts", "utf8"),
    /capability.*gmail-drafts/,
    "draft consent must require the explicit capability route",
  );
} finally {
  if (previousKey === undefined) delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  else process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = previousKey;
  if (previousClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
  else process.env.GOOGLE_CLIENT_ID = previousClientId;
  if (previousClientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
  else process.env.GOOGLE_CLIENT_SECRET = previousClientSecret;
  if (previousSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = previousSiteUrl;
}

console.log(JSON.stringify({ result: "passed", signedStateFailureModes: 4, safeErrorClasses: 4 }));
