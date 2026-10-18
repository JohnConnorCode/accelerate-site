import { executeRegisteredRevenueTool } from "../src/lib/revenue-os/ai-tools";
import assert from "node:assert/strict";
import { MemorySupabase } from "./lib/memory-supabase";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import { ACCELERATE_TENANT_ID as tenant } from "../src/lib/tenancy/context";
import {
  openRouterChat,
  openRouterChatStream,
  openRouterTextStream,
} from "../src/lib/ai/openrouter";
import { DEFAULT_OPENROUTER_MODEL as model } from "../src/lib/ai/openrouter-models";
import { readAiSpendPolicy } from "../src/lib/ai/spend-controls";

const originalFetch = globalThis.fetch,
  originalKey = process.env.OPENROUTER_API_KEY;
process.env.OPENROUTER_API_KEY = "fixture-no-real-provider";
const checks: string[] = [];
const providerCalls: Record<string, unknown>[] = [];
let mode = "success";
const memory = new MemorySupabase({ tenants: [{ id: tenant, status: "active" }] });
const db = bindTenantDatabase(memory.client, tenant, true);
const request = {
  database: db,
  job: "connectivity-check",
  messages: [{ role: "user" as const, content: "Hi" }],
  maxTokens: 20,
};
function enabled(recurring = false) {
  memory.tables.workspace_ai_controls = [
    {
      tenant_id: tenant,
      revision: 1,
      enabled: true,
      recurring_enabled: recurring,
      daily_usd: 1,
      monthly_usd: 2,
      request_usd: 0.1,
      daily_calls: 10,
    },
  ];
}
memory.rpc("reserve_workspace_ai_call", (args) => ({ id: args.p_id }));
memory.rpc("finish_workspace_ai_call", () => null);
globalThis.fetch = (async (url, init) => {
  const target = new URL(String(url));
  if (target.pathname.endsWith("/models"))
    return Response.json({
      data: [
        {
          id: target.searchParams.get("q"),
          context_length: 100000,
          supported_parameters: ["structured_outputs"],
          pricing: { prompt: "0.000001", completion: "0.000002", request: "0" },
        },
      ],
    });
  assert.equal(target.href, "https://openrouter.ai/api/v1/chat/completions");
  const body = JSON.parse(String(init?.body));
  providerCalls.push(body);
  if (mode === "credits")
    return Response.json(
      { error: { code: 402, message: "Insufficient credits" } },
      { status: 402 },
    );
  if (mode === "timeout") throw new Error("Controlled uncertain provider result");
  if (body.stream && mode === "truncated")
    return new Response(
      `data: ${JSON.stringify({ id: "gen-truncated", model, choices: [{ delta: { content: "Partial" } }], usage: { cost: 0.000005 } })}\n\n`,
      { headers: { "content-type": "text/event-stream" } },
    );
  if (body.stream)
    return new Response(
      [
        `data: ${JSON.stringify({ id: "gen-fixture", model, choices: [{ delta: { content: "Ready" }, finish_reason: "stop" }] })}\n\n`,
        `data: ${JSON.stringify({ id: "gen-fixture", model, choices: [], usage: { cost: 0.00001, prompt_tokens: 2, completion_tokens: 1 } })}\n\n`,
        "data: [DONE]\n\n",
      ].join(""),
      { headers: { "content-type": "text/event-stream" } },
    );
  return Response.json({
    id: "gen-fixture",
    model,
    choices: [{ finish_reason: "stop", message: { role: "assistant", content: "Ready" } }],
    usage: { cost: 0.00001, prompt_tokens: 2, completion_tokens: 1 },
  });
}) as typeof fetch;
async function main() {
  try {
    memory.rpc("read_workspace_ai_usage", () => ({
      usage: {
        dailyCalls: 0,
        dailyReservedUsd: 0,
        monthlyReservedUsd: 0,
        reportedUsd: 0,
        uncertainCalls: 0,
      },
      recent: [],
    }));
    const { output } = await executeRegisteredRevenueTool(
      { supabase: db, actorEmail: "owner@example.test", tenantConfig: {}, toolPack: "core" },
      "get_ai_cost_controls",
      {},
    );
    const snapshot = output as { changesRequireHuman: boolean; humanHandoff: string };
    assert.equal(snapshot.changesRequireHuman, true);
    assert.match(snapshot.humanHandoff, /admin\/ai\?view=costs$/);
    await assert.rejects(() =>
      executeRegisteredRevenueTool(
        { supabase: db, actorEmail: "owner@example.test", tenantConfig: {}, toolPack: "core" },
        "get_ai_cost_controls",
        { enabled: true },
      ),
    );
    checks.push("AI can read controls and provide a human handoff, but cannot change them");
    assert.equal((await readAiSpendPolicy(db)).policy.enabled, false);
    await assert.rejects(() => openRouterChat(request), /AI calls are paused/);
    await assert.rejects(() => openRouterChatStream(request, () => {}), /AI calls are paused/);
    await assert.rejects(() => openRouterTextStream(request), /AI calls are paused/);
    assert.equal(providerCalls.length, 0);
    checks.push("Unconfigured workspace stops every adapter before inference");
    enabled();
    memory.fail("workspace_ai_controls", { message: "controlled read failure" });
    await assert.rejects(() => openRouterChat(request), /unavailable/);
    assert.equal(providerCalls.length, 0);
    memory.recover("workspace_ai_controls");
    checks.push("Unavailable policy fails closed");
    memory.rpc("reserve_workspace_ai_call", () => ({ error: { message: "AI budget reached" } }));
    await assert.rejects(() => openRouterChat(request), /budget reached/);
    assert.equal(providerCalls.length, 0);
    checks.push("Atomic admission denial makes no inference request");
    memory.rpc("reserve_workspace_ai_call", (args) => ({ id: args.p_id }));
    await openRouterChat(request);
    assert.equal(providerCalls.length, 1);
    const provider = providerCalls[0]!.provider as { allow_fallbacks: boolean; max_price: unknown };
    assert.equal(provider.allow_fallbacks, false);
    assert.deepEqual(provider.max_price, { prompt: 1, completion: 2, request: 0 });
    assert(
      memory.rpcCalls.some(
        (row) => row.name === "finish_workspace_ai_call" && row.args.p_actual_usd === 0.00001,
      ),
    );
    checks.push("Known provider prices pin routing and final charges are attributed");
    let text = "";
    await openRouterChatStream(request, (value) => (text += value));
    assert.equal(text, "Ready");
    const stream = await openRouterTextStream(request);
    assert.equal(await new Response(stream).text(), "Ready");
    assert.equal(providerCalls.length, 3);
    checks.push("Both streaming paths reserve and retain final usage");
    mode = "truncated";
    const settledBefore = memory.rpcCalls.filter(
      (row) => row.name === "finish_workspace_ai_call",
    ).length;
    await openRouterChatStream(request, () => {});
    await new Response(await openRouterTextStream(request)).text();
    assert.equal(
      memory.rpcCalls.filter((row) => row.name === "finish_workspace_ai_call").length,
      settledBefore,
      "A truncated stream cannot release an uncertain charge reservation",
    );
    mode = "success";
    checks.push("Streams without a completion signal retain their entire reservation");
    const before = providerCalls.length;
    memory.rpc("finish_workspace_ai_call", () => ({
      error: { message: "controlled receipt failure" },
    }));
    await assert.rejects(() => openRouterChat(request), /reservation remains held/);
    assert.equal(
      providerCalls.length,
      before + 1,
      "A lost usage receipt must never repeat paid inference",
    );
    memory.rpc("finish_workspace_ai_call", () => null);
    checks.push("Post-provider receipt failure cannot trigger another paid attempt");
    const cancelled = new AbortController();
    cancelled.abort();
    await assert.rejects(
      () => openRouterChat({ ...request, signal: cancelled.signal }),
      /cancelled/,
    );
    assert.equal(providerCalls.length, before + 1);
    checks.push("Pre-admission cancellation costs nothing");
    mode = "credits";
    await assert.rejects(() => openRouterChat(request), /Insufficient credits/);
    assert.equal(providerCalls.length, before + 2);
    checks.push("Credit rejection is not retried");
    console.log(JSON.stringify({ result: "passed", checks, paidNetworkRequests: 0 }, null, 2));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalKey;
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
