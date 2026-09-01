import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GOOGLE_OAUTH_STATE_TTL_SECONDS,
  createGoogleOAuthStateBinding,
  googleOperatorError,
  googleServerErrorSummary,
  verifyGoogleOAuthStateBinding,
} from "../src/lib/revenue-os/google-oauth";

const previousKey = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "deterministic-test-key-that-never-leaves-this-process";

try {
  const now = Date.parse("2026-08-31T12:00:00.000Z");
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
} finally {
  if (previousKey === undefined) delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  else process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = previousKey;
}

console.log(JSON.stringify({ result: "passed", signedStateFailureModes: 4, safeErrorClasses: 4 }));
