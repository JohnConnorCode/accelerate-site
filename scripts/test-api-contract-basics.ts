import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

function hydrateEnvFromLocalFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const body = readFileSync(filePath, "utf8");
  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const key = match[1];
    const value = match[2];
    if (key === undefined || value === undefined) continue;
    if (process.env[key] === undefined) {
      process.env[key] =
        value.startsWith('"') && value.endsWith('"')
          ? value.slice(1, -1)
          : value.startsWith("'") && value.endsWith("'")
            ? value.slice(1, -1)
            : value;
    }
  }
}

hydrateEnvFromLocalFile(".env.local");

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "https://www.acceleratewith.us";

async function get(path: string) {
  return fetch(`${BASE_URL}${path}`, { method: "GET" });
}

async function post(path: string, options: Parameters<typeof fetch>[1]) {
  return fetch(`${BASE_URL}${path}`, {
    method: "POST",
    ...options,
  });
}

async function expectStatus(
  responsePromise: Promise<Response>,
  expected: number | number[],
  label: string,
) {
  const response = await responsePromise;
  const status = response.status;
  if (Array.isArray(expected)) {
    assert.ok(
      expected.includes(status),
      `${label}: expected one of [${expected.join(", ")}], got ${status}`,
    );
    return status;
  }
  assert.equal(status, expected, `${label}: expected ${expected}, got ${status}`);
  return status;
}

(async () => {
  const checks: string[] = [];
  // Anything this run could not cover, or a configuration gap it discovered.
  // Reporting only passes would let an unconfigured endpoint read as healthy.
  const notes: string[] = [];

  const unauthorizedRoutes = [
    "/api/admin/settings",
    "/api/admin/revenue-os/pipeline",
    "/api/admin/revenue-os/overview",
    "/api/admin/analytics",
  ];

  for (const route of unauthorizedRoutes) {
    checks.push(`unauthenticated admin API rejects with 401: ${route}`);
    await expectStatus(get(route), 401, `${route} (unauthenticated)`);
  }

  const malformedBody = "{ this-is-not-json }";
  checks.push("qualify endpoint rejects malformed JSON");
  await expectStatus(
    post("/api/qualify", {
      body: malformedBody,
      headers: { "content-type": "application/json" },
    }),
    400,
    "/api/qualify malformed request",
  );

  checks.push("qualify endpoint rejects invalid enum payload");
  const invalidQualify = {
    email: "demo@example.com",
    companyWebsite: "https://acme.example",
    role: "unknown-role",
    revenueBand: "1m_3m",
    primaryLeak: "visibility",
  };
  const invalidQualifyResponse = await post("/api/qualify", {
    body: JSON.stringify(invalidQualify),
    headers: { "content-type": "application/json" },
  });
  assert.equal(invalidQualifyResponse.status, 400, "/api/qualify invalid field set");

  checks.push("proposal public GET returns 404 for unknown token");
  await expectStatus(
    get("/api/proposal/test-token-does-not-exist-01"),
    404,
    "/api/proposal/:token unknown token",
  );

  checks.push("proposal public POST unknown token rejected with 404");
  const unknownProposalDecisionResponse = post("/api/proposal/test-token-does-not-exist-01", {
    body: JSON.stringify({ decision: "accepted" }),
    headers: { "content-type": "application/json" },
  });
  await expectStatus(
    unknownProposalDecisionResponse,
    404,
    "/api/proposal/:token unknown token response",
  );

  checks.push("proposal public POST malformed payload rejected with 400");
  const malformedProposalResponse = post("/api/proposal/known-token-mock", {
    body: malformedBody,
    headers: { "content-type": "application/json" },
  });
  await expectStatus(
    malformedProposalResponse,
    400,
    "/api/proposal/:token malformed decision payload",
  );

  checks.push("qualify route rejects unsupported method");
  await expectStatus(get("/api/qualify"), 405, "/api/qualify method gate");

  checks.push("proposal route rejects unsupported method");
  await expectStatus(
    fetch(`${BASE_URL}/api/proposal/test-token-does-not-exist-01`, { method: "DELETE" }),
    405,
    "/api/proposal/:token method gate",
  );

  checks.push("resend webhook route rejects GET before signature checks");
  await expectStatus(get("/api/webhooks/resend"), 405, "/api/webhooks/resend method gate");

  checks.push("calendly webhook route rejects GET before signature checks");
  await expectStatus(get("/api/webhooks/calendly"), 405, "/api/webhooks/calendly method gate");

  checks.push("qualify route rejects malformed website URL");
  const malformedWebsite = post("/api/qualify", {
    body: JSON.stringify({
      email: "dev@example.com",
      role: "owner",
      revenueBand: "1m_3m",
      primaryLeak: "visibility",
      companyWebsite: "not-a-url",
    }),
    headers: { "content-type": "application/json" },
  });
  await expectStatus(malformedWebsite, 400, "/api/qualify invalid companyWebsite");

  // --- Slice 2026-09-03: auth-before-mutation, replay, error-shape -----------
  // Every probe below is rejected before any write path, so this stays safe to
  // run against production (the default BASE_URL). Nothing here creates,
  // mutates, or sends anything: admin probes carry no session, and every
  // public payload is invalid by construction so it fails validation before
  // the ingestion service is reached.

  // Auth runs before transition validation: even a well-formed stage move
  // without a session is a 401, never a 400 or a mutation.
  const unauthWrites: Array<{ path: string; method: string; body: unknown; label: string }> = [
    {
      path: "/api/admin/revenue-os/pipeline",
      method: "POST",
      body: { name: "No Session", email: "nosession@example.invalid" },
      label: "pipeline create without session",
    },
    {
      path: "/api/admin/revenue-os/pipeline",
      method: "PATCH",
      body: { id: "00000000-0000-4000-8000-000000000000", stage: "contacted" },
      label: "pipeline transition without session",
    },
    {
      path: "/api/admin/settings",
      method: "PUT",
      body: {},
      label: "settings write without session",
    },
  ];
  for (const probe of unauthWrites) {
    checks.push(`unauthenticated ${probe.method} ${probe.path} rejected with 401: ${probe.label}`);
    await expectStatus(
      fetch(`${BASE_URL}${probe.path}`, {
        method: probe.method,
        body: JSON.stringify(probe.body),
        headers: { "content-type": "application/json" },
      }),
      401,
      `${probe.method} ${probe.path} (${probe.label})`,
    );
  }

  // Unimplemented mutating methods never reach auth or domain logic.
  const methodGates: Array<{ path: string; method: string; label: string }> = [
    { path: "/api/admin/revenue-os/pipeline", method: "DELETE", label: "pipeline DELETE" },
    { path: "/api/admin/revenue-os/overview", method: "POST", label: "overview POST" },
    { path: "/api/admin/revenue-os/overview", method: "PATCH", label: "overview PATCH" },
    { path: "/api/admin/analytics", method: "PUT", label: "analytics PUT" },
    { path: "/api/admin/settings", method: "PATCH", label: "settings PATCH" },
    { path: "/api/send-contact-email", method: "GET", label: "contact GET" },
  ];
  for (const gate of methodGates) {
    checks.push(`${gate.label} rejected with 405`);
    await expectStatus(
      fetch(`${BASE_URL}${gate.path}`, { method: gate.method }),
      405,
      `${gate.method} ${gate.path}`,
    );
  }

  // Replayed invalid payloads are byte-identical rejections: deterministic,
  // with no mutation and no new receipt on either attempt.
  checks.push("replayed invalid qualify payload is a deterministic 400 twice");
  const replayPayload = JSON.stringify(invalidQualify);
  const firstReplay = await post("/api/qualify", {
    body: replayPayload,
    headers: { "content-type": "application/json" },
  });
  const secondReplay = await post("/api/qualify", {
    body: replayPayload,
    headers: { "content-type": "application/json" },
  });
  assert.equal(firstReplay.status, 400, "first replayed qualify");
  assert.equal(secondReplay.status, 400, "second replayed qualify");
  assert.equal(
    await firstReplay.text(),
    await secondReplay.text(),
    "replayed qualify rejections must be identical",
  );

  // Oversized public payloads fail closed without a 500. The payload stays
  // invalid (unknown role) so it is rejected at validation, before ingestion.
  checks.push("oversized qualify payload fails closed (400), never 500");
  const oversized = await post("/api/qualify", {
    body: JSON.stringify({ ...invalidQualify, padding: "x".repeat(300_000) }),
    headers: { "content-type": "application/json" },
  });
  assert.ok(
    [400, 413].includes(oversized.status),
    `/api/qualify oversized payload expected 400/413, got ${oversized.status}`,
  );

  // Error bodies are JSON with a string error and no stack-trace leakage.
  async function expectJsonErrorBody(responsePromise: Promise<Response>, label: string) {
    const response = await responsePromise;
    const contentType = response.headers.get("content-type") || "";
    assert.ok(
      contentType.includes("application/json"),
      `${label}: error must be JSON, got content-type ${contentType || "(missing)"}`,
    );
    const body = (await response.json()) as Record<string, unknown>;
    assert.equal(typeof body.error, "string", `${label}: body.error must be a string`);
    assert.ok(
      !/at\s+[\w$.<]+\s*\(/.test(JSON.stringify(body)),
      `${label}: error body must not leak a stack trace`,
    );
    return response.status;
  }
  checks.push("401 body is JSON with a string error and no stack trace");
  await expectJsonErrorBody(get("/api/admin/revenue-os/pipeline"), "pipeline 401");
  checks.push("404 body is JSON with a string error and no stack trace");
  await expectJsonErrorBody(get("/api/proposal/test-token-does-not-exist-01"), "proposal 404");
  checks.push("400 body is JSON with a string error and no stack trace");
  await expectJsonErrorBody(
    post("/api/qualify", {
      body: JSON.stringify(invalidQualify),
      headers: { "content-type": "application/json" },
    }),
    "qualify 400",
  );

  notes.push(
    "not covered: authenticated non-founder authorization (needs a second-user session fixture; must not run against production with real accounts)",
  );
  notes.push(
    "not covered: stale-version transition rejection (needs an authenticated opportunity fixture with a version conflict; see test:pipeline-transition for the service-level rule)",
  );

  console.log(
    JSON.stringify({
      result: "api-contract-basics checks covered",
      checks,
      notes,
      baseUrl: BASE_URL,
    }),
  );
})();
