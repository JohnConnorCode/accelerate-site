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

async function post(path: string, options: Parameters<typeof fetch>[1]) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    ...options,
  });
  return response;
}

async function get(path: string, headers?: Record<string, string>) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers,
  });
  return response;
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

  const cronRoutes = ["/api/cron/google-workspace-sync", "/api/cron/revenue-campaigns"];
  for (const cronRoute of cronRoutes) {
    checks.push(`${cronRoute} rejects missing Bearer secret (401)`);
    await expectStatus(get(cronRoute), 401, `${cronRoute} missing authorization`);

    checks.push(`${cronRoute} rejects invalid Bearer secret (401)`);
    await expectStatus(
      get(cronRoute, { authorization: "Bearer invalid-secret" }),
      401,
      `${cronRoute} invalid authorization`,
    );

    checks.push(`${cronRoute} rejects POST method`);
    await expectStatus(post(cronRoute, {}), 405, `${cronRoute} method not allowed`);
  }

  const calendlySecret = process.env.CALENDLY_WEBHOOK_SECRET?.trim();
  const calendlyRoute = "/api/webhooks/calendly";
  if (!calendlySecret) {
    checks.push("calendly webhook returns 503 when CALENDLY_WEBHOOK_SECRET is missing");
    await expectStatus(
      post(`${calendlyRoute}`, {
        body: "{}",
        headers: { "content-type": "application/json" },
      }),
      503,
      `${calendlyRoute} without calendly secret`,
    );
  } else {
    checks.push("calendly webhook rejects invalid query secret (401)");
    await expectStatus(
      post(`${calendlyRoute}?secret=wrong`, {
        body: JSON.stringify({ event: "invitee.created", payload: {} }),
        headers: { "content-type": "application/json" },
      }),
      401,
      `${calendlyRoute}?secret=wrong`,
    );

    checks.push("calendly webhook rejects malformed JSON (400) with valid secret");
    const malformedBody = "{ this-is-not-json }";
    await expectStatus(
      post(`${calendlyRoute}?secret=${encodeURIComponent(calendlySecret)}`, {
        body: malformedBody,
        headers: { "content-type": "application/json" },
      }),
      400,
      `${calendlyRoute}?secret=valid (malformed JSON)`,
    );

    checks.push("calendly webhook rejects unsupported payload (400) with valid secret");
    await expectStatus(
      post(`${calendlyRoute}?secret=${encodeURIComponent(calendlySecret)}`, {
        body: "{}",
        headers: { "content-type": "application/json" },
      }),
      400,
      `${calendlyRoute}?secret=valid (unsupported payload)`,
    );

    checks.push("calendly webhook ignores replayed payload after first receipt");
    const replayToken = `replay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const replayPayload = JSON.stringify({
      event: "invitee.created",
      created_at: new Date().toISOString(),
      payload: {
        uri: `calendly://webhook-demo/${replayToken}`,
        email: `${replayToken}@example.com`,
        event: "https://api.calendly.com/event-types/1",
        scheduled_event: {
          uri: `https://api.calendly.com/event-types/${replayToken}`,
          start_time: new Date(Date.now() + 3600000).toISOString(),
        },
      },
    });
    const replayBody = {
      body: replayPayload,
      headers: { "content-type": "application/json" },
    };
    const replaySecretUrl = `${calendlyRoute}?secret=${encodeURIComponent(calendlySecret)}`;
    const firstReplay = await post(replaySecretUrl, replayBody);
    assert.equal(firstReplay.status, 200, `${replaySecretUrl} first replay attempt`);
    const secondReplay = await post(replaySecretUrl, replayBody);
    assert.equal(secondReplay.status, 200, `${replaySecretUrl} repeated replay`);
    const secondReplayBody = await secondReplay.json();
    assert.equal(
      secondReplayBody.duplicate,
      true,
      `${replaySecretUrl} should report duplicate=true on replay`,
    );

    checks.push("calendly webhook rejects oversized payload (413) with valid secret");
    const oversizedPayload = JSON.stringify({ event: "invitee.created", payload: { marker: "x".repeat(120_000) } });
    await expectStatus(
      post(`${calendlyRoute}?secret=${encodeURIComponent(calendlySecret)}`, {
        body: oversizedPayload,
        headers: { "content-type": "application/json" },
      }),
      413,
      `${calendlyRoute}?secret=valid (oversize payload)`,
    );
  }

  const resendSecret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  const resendRoute = "/api/webhooks/resend";
  if (!resendSecret) {
    checks.push("resend webhook returns 503 when RESEND_WEBHOOK_SECRET is missing");
    await expectStatus(
      post(resendRoute, {
        body: "{}",
        headers: { "content-type": "application/json" },
      }),
      503,
      `${resendRoute} without resend secret`,
    );
  } else {
    checks.push("resend webhook rejects missing signature fields (401)");
    await expectStatus(
      post(resendRoute, {
        body: JSON.stringify({ type: "email.delivered" }),
        headers: { "content-type": "application/json" },
      }),
      401,
      `${resendRoute} missing signature`,
    );

    checks.push("resend webhook rejects invalid signature (401)");
    await expectStatus(
      post(resendRoute, {
        body: JSON.stringify({ type: "email.delivered" }),
        headers: {
          "content-type": "application/json",
          "svix-id": "fake-id",
          "svix-timestamp": String(Date.now()),
          "svix-signature": "v1=bogus",
        },
      }),
      401,
      `${resendRoute} invalid signature`,
    );

    checks.push("resend webhook rejects oversized payload (413 if configured)");
    const oversizedPayload = JSON.stringify({ type: "email.delivered", payload: { marker: "x".repeat(120_000) } });
    const oversizedResult = await post(resendRoute, {
      body: oversizedPayload,
      headers: {
        "content-type": "application/json",
        "svix-id": "fake-id",
        "svix-timestamp": String(Date.now()),
        "svix-signature": "v1=bogus",
      },
    });
    assert.ok(
      oversizedResult.status === 413,
      `resend webhook oversized payload expected 413, got ${oversizedResult.status}`,
    );
  }

  console.log(JSON.stringify({
    result: "webhook-cron-defense focused security checks covered",
    checks,
    baseUrl: BASE_URL,
  }));
})();
