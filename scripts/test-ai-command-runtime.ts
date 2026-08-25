#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { MemorySupabase } from "./lib/memory-supabase";
import { appendAiAssistantMessage, archiveAiConversation, listAiConversations, loadAiConversation, openAiConversationTurn } from "../src/lib/revenue-os/ai-conversations";
import { openRouterChatStream } from "../src/lib/ai/openrouter";

process.env.OPENROUTER_API_KEY = "sk-or-v1-test-key-not-real";
const realFetch = globalThis.fetch;

function sseResponse(blocks: unknown[]) {
  const encoder = new TextEncoder();
  const body = blocks.map((block) => `data: ${JSON.stringify(block)}\n\n`).join("") + "data: [DONE]\n\n";
  return new Response(new ReadableStream({ start(controller) { controller.enqueue(encoder.encode(body)); controller.close(); } }), { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

async function main() {
  const memory = new MemorySupabase();
  const first = await openAiConversationTurn(memory.client, {
    actorEmail: "founder@example.com",
    content: "Show me the most important pipeline risk",
    clientMessageId: "client-1",
  });
  assert.ok(first.conversationId, "the first turn must create a conversation");
  assert.equal(first.history.length, 1, "the first user message must be persisted");

  const replay = await openAiConversationTurn(memory.client, {
    actorEmail: "founder@example.com",
    conversationId: first.conversationId,
    content: "Show me the most important pipeline risk",
    clientMessageId: "client-1",
  });
  assert.equal(replay.userMessage.id, first.userMessage.id, "a replay must return the original user message");
  assert.equal(memory.rows("ai_messages").length, 1, "a replay must not duplicate the transcript");

  await appendAiAssistantMessage(memory.client, {
    actorEmail: "founder@example.com",
    conversationId: first.conversationId,
    content: "One opportunity is overdue. Review its next action.",
    runId: "run-1",
  });
  const loaded = await loadAiConversation(memory.client, "founder@example.com", first.conversationId);
  assert.deepEqual(loaded.messages.map((message) => message.role), ["user", "assistant"], "history must preserve ordered roles");
  assert.equal((await listAiConversations(memory.client, "founder@example.com")).length, 1, "the owner must see the thread");
  await assert.rejects(() => loadAiConversation(memory.client, "other@example.com", first.conversationId), /not found/i, "another actor must not read the thread");
  await archiveAiConversation(memory.client, "founder@example.com", first.conversationId);
  assert.equal((await listAiConversations(memory.client, "founder@example.com")).length, 0, "archived threads leave the active list");

  const deltas: string[] = [];
  globalThis.fetch = (async () => sseResponse([
    { id: "stream-1", model: "stub/model", choices: [{ delta: { content: "Checking " }, finish_reason: null }] },
    { id: "stream-1", model: "stub/model", choices: [{ delta: { content: "now." }, finish_reason: null }] },
    { id: "stream-1", model: "stub/model", choices: [{ delta: { tool_calls: [{ index: 0, id: "call-1", type: "function", function: { name: "get_", arguments: "{" } }] }, finish_reason: null }] },
    { id: "stream-1", model: "stub/model", choices: [{ delta: { tool_calls: [{ index: 0, function: { name: "today_snapshot", arguments: "}" } }] }, finish_reason: "tool_calls" }], usage: { prompt_tokens: 12, completion_tokens: 4 } },
  ])) as typeof fetch;
  const streamed = await openRouterChatStream({ messages: [{ role: "user", content: "What matters?" }], tools: [] }, (delta) => deltas.push(delta));
  assert.equal(deltas.join(""), "Checking now.", "assistant text must stream without changing content");
  assert.equal(streamed.choices[0]?.message.tool_calls?.[0]?.function.name, "get_today_snapshot", "fragmented tool names must reconstruct exactly");
  assert.equal(streamed.choices[0]?.message.tool_calls?.[0]?.function.arguments, "{}", "fragmented tool arguments must reconstruct exactly");

  console.log(JSON.stringify({ checks: ["conversation-create", "message-replay", "history-order", "owner-isolation", "archive", "text-stream", "tool-reconstruction"], result: "passed" }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => { globalThis.fetch = realFetch; });

