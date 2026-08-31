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
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { openRouterChat, openRouterJson, openRouterTextStream, OpenRouterError, type OpenRouterStreamMetadata } from "../src/lib/ai/openrouter";

// Read at call time by the gateway, so setting it here is enough and no real
// credential is involved.
process.env.OPENROUTER_API_KEY = "sk-or-v1-test-key-not-real";

type StubResponse = { status: number; body?: unknown; delayMs?: number; sse?: string };
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
    const stream = spec.sse === undefined ? null : new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(spec.sse));
        controller.close();
      },
    });
    return {
      ok: spec.status >= 200 && spec.status < 300,
      status: spec.status,
      headers: new Headers({ "x-request-id": `req-${index}` }),
      body: stream,
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

  await scenario("provider errors are bounded and redact credentials", async () => {
    stubFetch([{ status: 400, body: { error: { message: `Bearer exposed-token ${"x".repeat(600)}` } } }]);
    await assert.rejects(() => openRouterChat(ask), (error: unknown) => {
      assert.ok(error instanceof OpenRouterError);
      assert.doesNotMatch(error.message, /exposed-token/);
      assert.match(error.message, /\[redacted\]/);
      assert.ok(error.message.length <= 500, "provider errors must stay within the trace-safe bound");
      return true;
    });
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

  await scenario("text streaming retains the provider receipt and resolved model", async () => {
    process.env.OPENROUTER_FALLBACK_MODEL = "anthropic/claude-haiku-4.5";
    stubFetch([{ status: 200, sse: [
      'data: {"id":"gen-stream-1","model":"anthropic/claude-haiku-4.5","choices":[{"delta":{"content":"Hello"}}]}',
      'data: {"id":"gen-stream-1","model":"anthropic/claude-haiku-4.5","choices":[],"usage":{"prompt_tokens":11,"completion_tokens":4,"total_tokens":15}}',
      "data: [DONE]",
      "",
    ].join("\r\n\r\n") }]);
    let metadata: OpenRouterStreamMetadata | undefined;
    const stream = await openRouterTextStream(ask, (receipt) => { metadata = receipt; });
    const chunks: Uint8Array[] = [];
    for (const reader = stream.getReader(); ;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    assert.equal(new TextDecoder().decode(Buffer.concat(chunks)), "Hello");
    assert.deepEqual(metadata, {
      requestId: "gen-stream-1",
      model: "anthropic/claude-haiku-4.5",
      usage: { prompt_tokens: 11, completion_tokens: 4, total_tokens: 15 },
    });
    assert.deepEqual((calls[0]?.body as { models?: string[] }).models, ["openai/gpt-4.1-mini", "anthropic/claude-haiku-4.5"]);
    delete process.env.OPENROUTER_FALLBACK_MODEL;
  });

  const jsonSchema = {
    type: "object",
    additionalProperties: false,
    required: ["ok"],
    properties: { ok: { type: "boolean" } },
  };
  const validateOk = (value: unknown) => {
    if (!value || typeof value !== "object" || typeof (value as { ok?: unknown }).ok !== "boolean") {
      throw new Error("invalid structured payload");
    }
    return value as { ok: boolean };
  };
  const jsonAsk = {
    messages: [{ role: "user" as const, content: "json" }],
    schemaName: "probe",
    schema: jsonSchema,
    validate: validateOk,
  };

  await scenario("structured output requests a strict JSON schema", async () => {
    stubFetch([{ status: 200, body: { ...okBody, choices: [{ message: { role: "assistant", content: "{\"ok\":true}" } }] } }]);
    const result = await openRouterJson(jsonAsk);
    assert.equal(result.data.ok, true);
    const format = calls[0]?.body.response_format as { type?: string; json_schema?: { strict?: boolean; name?: string } };
    assert.equal(format?.type, "json_schema");
    assert.equal(format?.json_schema?.strict, true);
    assert.equal(format?.json_schema?.name, "probe");
  });

  await scenario("malformed structured JSON is rejected before a domain write", async () => {
    stubFetch([{ status: 200, body: { ...okBody, choices: [{ message: { role: "assistant", content: "not-json" } }] } }]);
    await assert.rejects(() => openRouterJson(jsonAsk), (error: unknown) => {
      assert.ok(error instanceof OpenRouterError);
      assert.match((error as OpenRouterError).message, /malformed structured JSON/);
      return true;
    });
  });

  await scenario("unvalidated structured JSON is rejected before a domain write", async () => {
    stubFetch([{ status: 200, body: { ...okBody, choices: [{ message: { role: "assistant", content: "{\"ok\":\"nope\"}" } }] } }]);
    await assert.rejects(() => openRouterJson(jsonAsk), (error: unknown) => {
      assert.ok(error instanceof OpenRouterError);
      assert.match((error as OpenRouterError).message, /invalid structured payload/);
      return true;
    });
  });

  const sources = [
    "src/lib/revenue-os/contact-imports.ts",
    "src/lib/revenue-os/ai-agent.ts",
    "src/app/api/chat/route.ts",
    "src/app/api/generate-plan/route.ts",
    "src/app/api/admin/ai-content-brief/route.ts",
    "src/app/api/admin/proposals/generate/route.ts",
  ];
  for (const file of sources) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /@\/lib\/ai\/openrouter/, `${file} must call the shared OpenRouter adapter`);
    assert.doesNotMatch(source, /@anthropic-ai\/sdk|from ["']openai["']/, `${file} must not call a direct provider SDK`);
  }
  assert.equal(existsSync("src/app/api/admin/ai-insights/route.ts"), false, "pre-canonical insights must stay deleted rather than return a successful empty AI result");
  const setup = readFileSync("src/app/api/admin/setup/route.ts", "utf8");
  assert.match(setup, /OPENROUTER_API_KEY/);
  assert.doesNotMatch(setup, /OPENROUTER_API_KEY.{0,80}sk-or/, "Setup must not echo the OpenRouter secret");
  assert.match(readFileSync("src/app/api/chat/route.ts", "utf8"), /isOpenRouterConfigured\(\)/);
  assert.match(readFileSync("src/app/api/generate-plan/route.ts", "utf8"), /isOpenRouterConfigured\(\)/);
  assert.match(readFileSync("src/app/api/admin/proposals/generate/route.ts", "utf8"), /isOpenRouterConfigured\(\)/);
  assert.match(readFileSync("src/lib/revenue-os/ai-agent.ts", "utf8"), /request_id: response\.id/);
  assert.match(readFileSync("src/app/api/chat/route.ts", "utf8"), /startAgentRun/);
  assert.match(readFileSync("src/app/api/chat/route.ts", "utf8"), /request_id: metadata\.requestId/);
  assert.doesNotMatch(readFileSync("src/app/api/generate-plan/route.ts", "utf8"), /Claude/);

  function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : full.endsWith(".ts") || full.endsWith(".tsx") ? [full] : [];
    });
  }
  for (const file of ["src/lib", "src/app"].flatMap(walk)) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /from ["']@anthropic-ai\/sdk["']/, `${file} reintroduced a direct Anthropic client`);
    assert.doesNotMatch(source, /from ["']openai["']/, `${file} reintroduced a direct OpenAI client`);
  }
  checks.push("gateway-callers", "no-direct-provider-sdk", "setup-key-readiness");

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
