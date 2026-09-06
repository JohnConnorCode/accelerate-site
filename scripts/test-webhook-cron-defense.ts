import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHmac, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

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

  const healthCronRoute = "/api/cron/system-health-snapshot";
  // GET and POST both serve the snapshot behind the same Bearer gate (GET
  // exists because Vercel Cron only issues GET). Both must 401, never 405.
  checks.push(`${healthCronRoute} GET rejects missing Bearer secret (401)`);
  await expectStatus(get(healthCronRoute), 401, `${healthCronRoute} GET missing auth`);
  checks.push(`${healthCronRoute} GET rejects invalid Bearer secret (401)`);
  await expectStatus(
    get(healthCronRoute, { authorization: "Bearer invalid-secret" }),
    401,
    `${healthCronRoute} GET invalid auth`,
  );
  checks.push(`${healthCronRoute} POST rejects missing Bearer secret (401)`);
  await expectStatus(
    post(healthCronRoute, { headers: { "content-type": "application/json" }, body: "{}" }),
    401,
    `${healthCronRoute} POST missing auth`,
  );
  checks.push(`${healthCronRoute} POST rejects invalid Bearer secret (401)`);
  await expectStatus(
    post(healthCronRoute, {
      headers: { authorization: "Bearer invalid-secret", "content-type": "application/json" },
      body: "{}",
    }),
    401,
    `${healthCronRoute} POST invalid auth`,
  );

  const workEngineRoute = "/api/cron/work-engine";
  checks.push(`${workEngineRoute} rejects missing Bearer secret (401)`);
  await expectStatus(get(workEngineRoute), 401, `${workEngineRoute} missing authorization`);
  checks.push(`${workEngineRoute} rejects invalid Bearer secret (401)`);
  await expectStatus(
    get(workEngineRoute, { authorization: "Bearer invalid-secret" }),
    401,
    `${workEngineRoute} invalid authorization`,
  );
  checks.push(`${workEngineRoute} rejects POST method`);
  await expectStatus(post(workEngineRoute, {}), 405, `${workEngineRoute} method not allowed`);

  // Both provider webhooks are POST-only; a GET must 405 from the framework
  // rather than reaching signature parsing or mutation.
  for (const webhookRoute of ["/api/webhooks/calendly", "/api/webhooks/resend"]) {
    checks.push(`${webhookRoute} rejects GET method`);
    await expectStatus(get(webhookRoute), 405, `${webhookRoute} method not allowed`);
  }

  const calendlySecret = process.env.CALENDLY_WEBHOOK_SECRET?.trim();
  const calendlyRoute = "/api/webhooks/calendly";
  // Refusing an unsecured booking payload is invariant, so it is probed against
  // whatever server we were pointed at rather than inferred from this machine's
  // environment: 503 when the route is unconfigured, 401 when it is configured
  // and the secret is wrong or absent.
  checks.push("calendly webhook refuses an unsecured payload (503 unconfigured / 401 configured)");
  const unsecured = await expectStatus(
    post(`${calendlyRoute}`, {
      body: "{}",
      headers: { "content-type": "application/json" },
    }),
    [401, 503],
    `${calendlyRoute} without calendly secret`,
  );
  // A 503 means the target has no CALENDLY_WEBHOOK_SECRET at all, so every
  // booking Calendly sends it is rejected and no booking is ever ingested. That
  // is a configuration gap, not a test failure, and it must be said out loud
  // rather than passing quietly as "fail-closed, good".
  if (unsecured === 503) {
    notes.push(
      `${BASE_URL} has no CALENDLY_WEBHOOK_SECRET configured: the booking webhook rejects everything, so no booking reaches the system`,
    );
  }

  if (!calendlySecret) {
    // The checks below post a real signed payload, so they need the same secret
    // the target uses. Say what was not covered instead of reporting a pass.
    notes.push(
      "skipped calendly signed-payload coverage (invalid-secret, malformed body, replay idempotency, oversize) because CALENDLY_WEBHOOK_SECRET is not set locally",
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

    const calendlySecretHeaders = {
      "content-type": "application/json",
      "x-accelerate-webhook-secret": calendlySecret,
    };

    checks.push(
      "calendly webhook accepts the local secret before rejecting malformed JSON (400), or rejects a target-mismatched secret (401)",
    );
    const malformedBody = "{ this-is-not-json }";
    const malformedResult = await post(calendlyRoute, {
      body: malformedBody,
      headers: calendlySecretHeaders,
    });
    assert.ok(
      [400, 401].includes(malformedResult.status),
      `${calendlyRoute} malformed payload expected 400 with a matching secret or 401 when the target uses another secret, got ${malformedResult.status}`,
    );

    if (malformedResult.status === 401) {
      notes.push(
        `skipped Calendly signed-payload semantics because ${BASE_URL} does not accept the CALENDLY_WEBHOOK_SECRET loaded by this process`,
      );
    } else {
      checks.push("calendly webhook rejects unsupported payload (400) with valid secret");
      await expectStatus(
        post(calendlyRoute, {
          body: "{}",
          headers: calendlySecretHeaders,
        }),
        400,
        `${calendlyRoute} valid secret header (unsupported payload)`,
      );

      const allowReplayMutation =
        /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE_URL) ||
        process.env.WEBHOOK_DEFENSE_ALLOW_REPLAY_QA === "1";
      if (!allowReplayMutation) {
        notes.push(
          "skipped Calendly replay mutation against a non-local target; set WEBHOOK_DEFENSE_ALLOW_REPLAY_QA=1 only for an explicitly authorized disposable QA target",
        );
      } else {
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
          headers: calendlySecretHeaders,
        };
        const firstReplay = await post(calendlyRoute, replayBody);
        assert.equal(firstReplay.status, 200, `${calendlyRoute} first replay attempt`);
        const secondReplay = await post(calendlyRoute, replayBody);
        assert.equal(secondReplay.status, 200, `${calendlyRoute} repeated replay`);
        const secondReplayBody = await secondReplay.json();
        assert.equal(
          secondReplayBody.duplicate,
          true,
          `${calendlyRoute} should report duplicate=true on replay`,
        );
        if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
          const service = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
          );
          const [notificationCleanup, receiptCleanup] = await Promise.all([
            service.from("admin_notifications").delete().ilike("description", `%${replayToken}%`),
            service
              .from("calendly_webhook_receipts")
              .delete()
              .eq("id", `invitee.created:calendly://webhook-demo/${replayToken}`),
          ]);
          assert.equal(
            notificationCleanup.error,
            null,
            "Calendly replay QA notification cleanup failed",
          );
          assert.equal(receiptCleanup.error, null, "Calendly replay QA receipt cleanup failed");
        }
      }
    }
  }

  checks.push(
    "calendly webhook rejects oversized payload before signature parsing (413 if configured / 503 unconfigured)",
  );
  const calendlyOversizedPayload = JSON.stringify({
    event: "invitee.created",
    payload: { marker: "x".repeat(120_000) },
  });
  await expectStatus(
    post(calendlyRoute, {
      body: calendlyOversizedPayload,
      headers: { "content-type": "application/json" },
    }),
    [413, 503],
    `${calendlyRoute} oversized payload`,
  );

  const resendRoute = "/api/webhooks/resend";
  {
    // This used to branch on the LOCAL RESEND_WEBHOOK_SECRET while probing a
    // REMOTE server, so it passed or failed depending on which machine ran it
    // rather than on whether the server was correct. Running it from a laptop
    // with no secret against production, which does have one, failed on a
    // route that was behaving perfectly.
    //
    // What is actually invariant is that an unsigned webhook is never accepted:
    // 503 when the route is unconfigured, 401 when it is configured and the
    // signature is missing or wrong. Both are fail-closed. Anything else,
    // especially a 200, is the defect worth catching.
    checks.push("resend webhook refuses an unsigned payload (503 unconfigured / 401 configured)");
    const unsigned = await expectStatus(
      post(resendRoute, {
        body: JSON.stringify({ type: "email.delivered" }),
        headers: { "content-type": "application/json" },
      }),
      [401, 503],
      `${resendRoute} missing signature`,
    );
    if (unsigned === 503) {
      notes.push(
        `${BASE_URL} has no RESEND_WEBHOOK_SECRET configured: delivery, bounce, and complaint events are all rejected, so suppression never fires`,
      );
    }

    checks.push("resend webhook refuses a forged signature (503 unconfigured / 401 configured)");
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
      [401, 503],
      `${resendRoute} invalid signature`,
    );

    checks.push("resend webhook rejects oversized payload (413 if configured)");
    const oversizedPayload = JSON.stringify({
      type: "email.delivered",
      payload: { marker: "x".repeat(120_000) },
    });
    const oversizedResult = await post(resendRoute, {
      body: oversizedPayload,
      headers: {
        "content-type": "application/json",
        "svix-id": "fake-id",
        "svix-timestamp": String(Date.now()),
        "svix-signature": "v1=bogus",
      },
    });
    // The route checks the secret before it checks the payload size, so an
    // unconfigured deployment answers 503 and never reaches the size guard.
    // Both refuse the payload, which is the property under test.
    assert.ok(
      [413, 503].includes(oversizedResult.status),
      `resend webhook oversized payload expected 413 (or 503 if unconfigured), got ${oversizedResult.status}`,
    );

    const resendSecret = process.env.RESEND_WEBHOOK_SECRET?.trim();
    const allowResendMutation =
      /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE_URL) ||
      process.env.WEBHOOK_DEFENSE_ALLOW_REPLAY_QA === "1";
    if (!resendSecret) {
      notes.push(
        "skipped resend replay idempotency and rate-limit coverage because RESEND_WEBHOOK_SECRET is not set locally",
      );
    } else if (!allowResendMutation) {
      notes.push(
        "skipped resend replay/rate-limit mutation against a non-local target; set WEBHOOK_DEFENSE_ALLOW_REPLAY_QA=1 only for an explicitly authorized disposable QA target",
      );
    } else if (unsigned === 503) {
      notes.push(
        "skipped resend replay/rate-limit mutation because the target has no RESEND_WEBHOOK_SECRET configured (it answers 503 before either gate)",
      );
    } else {
      // Standard Webhooks signature: v1,<base64(HMAC_SHA256(key, id.timestamp.body))>.
      const signResend = (id: string, timestamp: string, payload: string) => {
        const key = Buffer.from(resendSecret.replace(/^whsec_/, ""), "base64");
        const digest = createHmac("sha256", key)
          .update(`${id}.${timestamp}.${payload}`)
          .digest("base64");
        return `v1,${digest}`;
      };
      const replayToken = `replay-${Date.now()}-${randomUUID().slice(0, 8)}`;
      const replayPayload = JSON.stringify({
        type: "email.delivered",
        created_at: new Date().toISOString(),
        data: { email_id: `replay-qa-${replayToken}` },
      });
      const replayId = `msg_${randomUUID().replace(/-/g, "")}`;
      const replayTimestamp = String(Math.floor(Date.now() / 1000));
      const replayHeaders = {
        "content-type": "application/json",
        "svix-id": replayId,
        "svix-timestamp": replayTimestamp,
        "svix-signature": signResend(replayId, replayTimestamp, replayPayload),
      };
      checks.push("resend webhook accepts a signed delivery once (200)");
      const firstDelivery = await post(resendRoute, {
        body: replayPayload,
        headers: replayHeaders,
      });
      assert.equal(
        firstDelivery.status,
        200,
        `${resendRoute} first signed delivery expected 200, got ${firstDelivery.status} (a 429 means the per-minute webhook budget from an earlier run has not refilled yet; wait 60s and re-run)`,
      );
      checks.push("resend webhook reports duplicate on redelivery without reprocessing");
      const secondDelivery = await post(resendRoute, {
        body: replayPayload,
        headers: replayHeaders,
      });
      assert.equal(secondDelivery.status, 200, `${resendRoute} repeated delivery`);
      const secondDeliveryBody = await secondDelivery.json();
      assert.equal(
        secondDeliveryBody.duplicate,
        true,
        `${resendRoute} should report duplicate=true on replay`,
      );
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const service = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY,
        );
        const { error: receiptCleanupError } = await service
          .from("webhook_receipts")
          .delete()
          .eq("id", replayId);
        assert.equal(receiptCleanupError, null, "resend replay QA receipt cleanup failed");
        notes.push(
          "resend replay proof leaves one immutable resend.webhook_processed audit row by design (audit history is append-only)",
        );
      }

      // Burst bound, mirroring the Calendly webhook's 120/min: hammer with
      // forged signatures (no mutation possible) until the limiter answers.
      // Runs last: it deliberately exhausts the per-minute budget this
      // process shares with the checks above.
      checks.push("resend webhook rate-limits a burst (429)");
      let saw429 = false;
      for (let attempt = 0; attempt < 135 && !saw429; attempt++) {
        const burst = await post(resendRoute, {
          body: JSON.stringify({ type: "email.delivered" }),
          headers: {
            "content-type": "application/json",
            "svix-id": `burn-${attempt}`,
            "svix-timestamp": String(Math.floor(Date.now() / 1000)),
            "svix-signature": "v1=bogus",
          },
        });
        if (burst.status === 429) saw429 = true;
        else assert.equal(burst.status, 401, `${resendRoute} burst attempt ${attempt}`);
      }
      assert.ok(saw429, `${resendRoute} never answered 429 within 135 burst requests`);
    }
  }

  console.log(
    JSON.stringify({
      result: "webhook-cron-defense focused security checks covered",
      checks,
      notes,
      baseUrl: BASE_URL,
    }),
  );
})();
