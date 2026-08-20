#!/usr/bin/env tsx
/**
 * Deterministic coverage for the gateway's failure behaviour, with the provider
 * stubbed. This needs no API key and costs nothing, which matters because the
 * behaviour it protects only shows up when OpenRouter is having a bad day.
 *
 * It pins four things that were previously absent or wrong:
 *   - transient failures retry with backoff instead of surfacing immediately
 *   - permanent failures do not retry
 *   - a caller-supplied AbortSignal no longer detaches the request timeout
 *   - a configured fallback model is handed to OpenRouter for provider failover
 */
import assert from "node:assert/strict";
import { openRouterChat, OpenRouterError } from "../src/lib/ai/openrouter";

// Read at call time by the gateway, so setting it here is enough and no real
// credential is involved.
process.env.OPENROUTER_API_KEY = "sk-or-v1-test-key-not-real";

type StubResponse = { status: number; body?: unknown; delayMs?: number };
const realFetch = globalThis.fetch;
let calls: Array<{ body: Record<string, unknown>; signal?: AbortSignal | null }> = [];

function stubFetch(responses: StubResponse[]) {
  let index = 0;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    const spec = responses[Math.min(index, responses.length - 1)] ?? { status: 200 };
    index += 1;
    calls.push({ body: JSON.parse(String(init.body)), signal: init.signal });
    if (spec.delayMs) {
      // Honour abort while "in flight" so timeout behaviour is observable.
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, spec.delayMs);
        init.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        }, { once: true });
      });
    }
    return {
      ok: spec.status >= 200 && spec.status < 300,
      status: spec.status,
      headers: new Headers({ "x-request-id": `req-${index}` }),
      json: async () => spec.body ?? { error: { message: `status ${spec.status}` } },
    } as unknown as Response;
  }) as typeof fetch;
}

const okBody = { id: "gen-1", model: "openai/gpt-4.1-mini", choices: [{ message: { role: "assistant", content: "OK" } }], usage: { total_tokens: 7 } };
const ask = { messages: [{ role: "user" as const, content: "hi" }] };
const checks: string[] = [];

async function scenario(name: string, run: () => Promise<void>) {
  calls = [];
  await run();
  checks.push(name);
}

async function main() {
  await scenario("a rate-limited request retries and then succeeds", async () => {
    stubFetch([{ status: 429 }, { status: 200, body: okBody }]);
    const response = await openRouterChat(ask);
    assert.equal(response.choices[0]?.message.content, "OK");
    assert.equal(calls.length, 2, "expected exactly one retry");
  });

  await scenario("a persistently failing provider gives up after three attempts", async () => {
    stubFetch([{ status: 503 }]);
    await assert.rejects(() => openRouterChat(ask), (error: unknown) => {
      assert.ok(error instanceof OpenRouterError);
      assert.equal((error as InstanceType<typeof OpenRouterError>).status, 503);
      return true;
    });
    assert.equal(calls.length, 3, "expected three attempts, not more");
  });

  await scenario("a client error fails immediately without retrying", async () => {
    stubFetch([{ status: 400 }]);
    await assert.rejects(() => openRouterChat(ask));
    assert.equal(calls.length, 1, "a 400 must not be retried");
  });

  await scenario("a caller cancellation is not treated as a provider failure", async () => {
    stubFetch([{ status: 200, body: okBody, delayMs: 5_000 }]);
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 50);
    await assert.rejects(() => openRouterChat({ ...ask, signal: controller.signal }), (error: unknown) => {
      assert.equal((error as InstanceType<typeof OpenRouterError>).status, 499);
      return true;
    });
    assert.equal(calls.length, 1, "a cancelled request must not be retried");
  });

  await scenario("a caller signal no longer detaches the request timeout", async () => {
    // The regression: passing a signal replaced the timeout controller, so the
    // 45s guard silently stopped applying. The combined signal must still carry
    // the timeout, which we observe by confirming the signal the fetch receives
    // is not the caller's own signal object.
    stubFetch([{ status: 200, body: okBody }]);
    const controller = new AbortController();
    await openRouterChat({ ...ask, signal: controller.signal });
    assert.ok(calls[0]?.signal, "fetch received no signal at all");
    assert.notEqual(calls[0]?.signal, controller.signal, "the caller signal replaced the timeout signal");
  });

  await scenario("a configured fallback model is offered to the provider", async () => {
    process.env.OPENROUTER_FALLBACK_MODEL = "anthropic/claude-haiku-4.5";
    stubFetch([{ status: 200, body: okBody }]);
    await openRouterChat(ask);
    const body = calls[0]?.body as { models?: string[]; route?: string };
    assert.deepEqual(body.models, ["openai/gpt-4.1-mini", "anthropic/claude-haiku-4.5"]);
    assert.equal(body.route, "fallback");
    delete process.env.OPENROUTER_FALLBACK_MODEL;
  });

  await scenario("no fallback configured leaves the request single-model", async () => {
    delete process.env.OPENROUTER_FALLBACK_MODEL;
    stubFetch([{ status: 200, body: okBody }]);
    await openRouterChat(ask);
    const body = calls[0]?.body as { models?: string[]; route?: string };
    assert.equal(body.models, undefined);
    assert.equal(body.route, undefined);
  });

  console.log(JSON.stringify({ checks, result: "passed" }, null, 2));
}

main()
  .catch((error) => {
    console.error("OpenRouter resilience test failed:", error instanceof Error ? error.message : error);
    console.error("passed before failure:", checks);
    process.exitCode = 1;
  })
  .finally(() => {
    globalThis.fetch = realFetch;
  });
