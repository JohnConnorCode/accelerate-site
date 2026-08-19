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
      process.env[key] = value.startsWith('"') && value.endsWith('"')
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

async function expectStatus(responsePromise: Promise<Response>, expected: number | number[], label: string) {
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
  await expectStatus(get("/api/proposal/test-token-does-not-exist-01"), 404, "/api/proposal/:token unknown token");

  checks.push("proposal public POST unknown token rejected with 404");
  const unknownProposalDecisionResponse = post("/api/proposal/test-token-does-not-exist-01", {
    body: JSON.stringify({ decision: "accepted" }),
    headers: { "content-type": "application/json" },
  });
  await expectStatus(unknownProposalDecisionResponse, 404, "/api/proposal/:token unknown token response");

  checks.push("proposal public POST malformed payload rejected with 400");
  const malformedProposalResponse = post("/api/proposal/known-token-mock", {
    body: malformedBody,
    headers: { "content-type": "application/json" },
  });
  await expectStatus(malformedProposalResponse, 400, "/api/proposal/:token malformed decision payload");

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

  console.log(JSON.stringify({
    result: "api-contract-basics checks covered",
    checks,
    baseUrl: BASE_URL,
  }));
})();
