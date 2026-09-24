#!/usr/bin/env tsx
/**
 * The copilot streams its answer as it is written instead of making the
 * founder wait for the whole response. Narration from a tool-calling turn is
 * withdrawn once the tools run, and an answer that fails the grounding
 * contract is withdrawn and replaced, so unsupported text never remains.
 */
import assert from "node:assert/strict";
import { runRevenueCommandAgent } from "../src/lib/revenue-os/ai-agent";
import { bindTenantDatabaseForTest } from "../src/lib/supabase/server";
import { ACCELERATE_TENANT_ID } from "../src/lib/tenancy/context";
import { DEFAULT_OPENROUTER_MODEL } from "../src/lib/ai/openrouter-models";
import { currentEvalEvidence, JOB_CONTRACT_FINGERPRINTS } from "../src/lib/ai/eval-contract";
import { MemorySupabase } from "./lib/memory-supabase";

process.env.OPENROUTER_API_KEY = "sk-or-v1-test-key-not-real";
const realFetch = globalThis.fetch;

function sse(chunks: unknown[]): Response {
  const body =
    chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n";
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}
const text = (content: string) => ({ id: "gen", model: "stub", choices: [{ delta: { content } }] });
const toolCall = {
  id: "gen",
  model: "stub",
  choices: [
    {
      delta: {
        tool_calls: [
          {
            index: 0,
            id: "call-1",
            type: "function",
            function: { name: "get_today_snapshot", arguments: "{}" },
          },
        ],
      },
      finish_reason: "tool_calls",
    },
  ],
};

function database() {
  const memory = new MemorySupabase({
    tenants: [{ id: ACCELERATE_TENANT_ID, slug: "accelerate", status: "active", config: {} }],
    admin_settings: [
      {
        tenant_id: ACCELERATE_TENANT_ID,
        key: `ai-model:${DEFAULT_OPENROUTER_MODEL}`,
        value: JSON.stringify({
          label: "fixture",
          costTier: "low",
          supportsTools: true,
          supportsJson: true,
          contextWindow: 1_000_000,
          evalEvidence: currentEvalEvidence(Object.keys(JOB_CONTRACT_FINGERPRINTS)),
        }),
      },
    ],
  });
  return bindTenantDatabaseForTest(memory.client, ACCELERATE_TENANT_ID);
}

async function run(turns: unknown[][]) {
  let turn = 0;
  globalThis.fetch = (async () => sse(turns[Math.min(turn++, turns.length - 1)]!)) as typeof fetch;
  const events: string[] = [];
  const result = await runRevenueCommandAgent(
    database(),
    "founder@example.com",
    [{ role: "user", content: "What should I do today?" }],
    {
      onAssistantDelta: (delta) => events.push(`delta:${delta}`),
      onAssistantReset: () => events.push("reset"),
    },
  );
  return { events, result };
}

async function main() {
  try {
    const grounded = "Two tasks are overdue. [source: registered_tool_result:get_today_snapshot]";
    const live = await run([
      [text("Checking "), text("today."), toolCall],
      [
        text("Two tasks are overdue. "),
        text("[source: registered_tool_result:get_today_snapshot]"),
      ],
    ]);
    assert.deepEqual(
      live.events,
      [
        "delta:Checking ",
        "delta:today.",
        "reset",
        "delta:Two tasks are overdue. ",
        "delta:[source: registered_tool_result:get_today_snapshot]",
      ],
      "deltas arrive live, and tool-turn narration is withdrawn",
    );
    assert.equal(live.result.text, grounded);

    const rejected = await run([[text("Everything is fine, revenue is up 40%.")]]);
    assert.equal(rejected.events[0], "delta:Everything is fine, revenue is up 40%.");
    assert.equal(rejected.events[1], "reset", "an ungrounded answer is withdrawn");
    assert.match(rejected.events[2] ?? "", /did not pass the grounding contract/);
    assert.match(rejected.result.text, /did not pass the grounding contract/);
  } finally {
    globalThis.fetch = realFetch;
  }
  console.log(
    JSON.stringify(
      { result: "passed", checks: ["live-deltas", "tool-turn-reset", "ungrounded-replaced"] },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
