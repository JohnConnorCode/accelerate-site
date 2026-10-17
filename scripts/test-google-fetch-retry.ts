import assert from "node:assert/strict";
import { googleFetch } from "../src/lib/revenue-os/google";

/**
 * Focused transport proof for the Google Workspace connector.
 *
 * Gmail/Calendar/Drive reads are idempotent, so a transient 429/5xx should be
 * retried instead of losing a thread for the whole sync run. Sends and draft
 * creates are POSTs and must never be replayed: a duplicate send is worse than
 * a failed one that the operator can retry deliberately.
 */

type Call = { url: string; method: string };
const realFetch = globalThis.fetch;
let calls: Call[] = [];

function stub(
  responses: Array<{ status: number; body?: unknown; headers?: Record<string, string> }>,
) {
  let index = 0;
  globalThis.fetch = (async (url: string | URL, init: RequestInit = {}) => {
    const spec = responses[Math.min(index, responses.length - 1)] ?? { status: 200 };
    index += 1;
    calls.push({ url: String(url), method: (init.method ?? "GET").toUpperCase() });
    return new Response(JSON.stringify(spec.body ?? {}), {
      status: spec.status,
      headers: spec.headers ?? {},
    });
  }) as typeof fetch;
}

const checks: string[] = [];

async function main() {
  stub([
    { status: 429, body: { error: { message: "rate" } } },
    { status: 200, body: { ok: true } },
  ]);
  calls = [];
  const read = await googleFetch<{ ok: boolean }>("https://gmail.googleapis.com/x");
  assert.equal(read.ok, true);
  assert.equal(calls.length, 2, "expected exactly one retry");
  checks.push("a rate-limited read retries and then succeeds");

  stub([{ status: 503, body: { error: { message: "down" } } }]);
  calls = [];
  await assert.rejects(
    () => googleFetch("https://gmail.googleapis.com/x"),
    (error: unknown) => {
      assert.equal((error as { status?: number }).status, 503);
      return true;
    },
  );
  assert.equal(calls.length, 3, "expected three attempts, not more");
  checks.push("a persistently failing read gives up after three attempts");

  stub([{ status: 503, body: { error: { message: "down" } } }]);
  calls = [];
  await assert.rejects(() =>
    googleFetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      body: "{}",
    }),
  );
  assert.equal(calls.length, 1, "a send must never be replayed");
  checks.push("a POST send is not replayed on a transient failure");

  stub([{ status: 400, body: { error: { message: "bad" } } }]);
  calls = [];
  await assert.rejects(() => googleFetch("https://gmail.googleapis.com/x"));
  assert.equal(calls.length, 1, "a non-transient status must not be retried");
  checks.push("a non-transient status is not retried");

  stub([
    { status: 429, headers: { "retry-after": "1" }, body: {} },
    { status: 200, body: { ok: true } },
  ]);
  calls = [];
  const startedAt = Date.now();
  await googleFetch("https://gmail.googleapis.com/x");
  assert.ok(
    Date.now() - startedAt >= 950,
    "the provider Retry-After hint should pace the retry, not the fast backoff",
  );
  checks.push("a Retry-After hint paces the retry");

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
