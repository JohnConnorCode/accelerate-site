import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { consumeRateLimit, rateLimit, rateLimitResponse } from "../src/lib/rate-limit";
const calls: Record<string, unknown>[] = [];
let reply: unknown = { allowed: true, remaining: 1, retry_after: 0 };
const db = {
  rpc(name: string, args: Record<string, unknown>) {
    assert.equal(name, "consume_rate_limit");
    calls.push(args);
    return {
      abortSignal(signal: AbortSignal) {
        assert(signal instanceof AbortSignal);
        return Promise.resolve(reply instanceof Error ? { error: reply } : { data: reply });
      },
    };
  },
} as unknown as Pick<SupabaseClient, "rpc">;
async function main() {
  assert.deepEqual(await consumeRateLimit(db, "login:private@example.test", 2, 60000, "tenant-a"), {
    success: true,
    remaining: 1,
    status: 200,
    retryAfter: 0,
  });
  await consumeRateLimit(db, "login:private@example.test", 2, 60000, "tenant-b");
  await consumeRateLimit(db, "send:private@example.test", 2, 60000, "tenant-a");
  assert.equal(new Set(calls.map((c) => c.p_key)).size, 3);
  assert(calls.every((c) => /^[a-f0-9]{64}$/.test(String(c.p_key))));
  assert(!JSON.stringify(calls).includes("private@example"));
  reply = { allowed: false, remaining: 0, retry_after: 42 };
  const limited = await consumeRateLimit(db, "login:one", 2, 60000, "tenant-a");
  assert.equal(limited.status, 429);
  const refused = rateLimitResponse(
    limited,
    { error: "Too many requests" },
    { "Access-Control-Allow-Origin": "*" },
  );
  assert.equal(refused.status, 429);
  assert.equal(refused.headers.get("Retry-After"), "42");
  assert.equal(refused.headers.get("Access-Control-Allow-Origin"), "*");
  for (reply of [
    null,
    {},
    new Error("private provider error"),
    { allowed: true, remaining: 100 },
    { allowed: false, remaining: 0, retry_after: 0 },
  ]) {
    const result = await consumeRateLimit(db, "login:one", 2, 60000, "tenant-a");
    assert.equal(result.status, 503);
    assert.equal(result.success, false);
    const response = rateLimitResponse(result, { error: "Too many requests" });
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.match((await response.json()).error, /temporarily unavailable/);
  }
  const down = {
    rpc() {
      throw new Error("offline");
    },
  } as unknown as Pick<SupabaseClient, "rpc">;
  assert.equal((await consumeRateLimit(down, "send:one", 2, 60000, "tenant-a")).status, 503);
  await assert.rejects(consumeRateLimit(db, "missing-namespace", 2, 60000, "tenant-a"));
  await assert.rejects(consumeRateLimit(db, "login:one", 0, 60000, "tenant-a"));
  const priorUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    assert.equal((await rateLimit("login:one", 2, 60000)).status, 503);
  } finally {
    if (priorUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = priorUrl;
  }
  console.log(
    "Shared rate-limit adapter: hashed scope, limits, outage refusal, retry headers and unconfigured safety pass.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
