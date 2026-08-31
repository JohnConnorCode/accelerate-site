#!/usr/bin/env tsx
/**
 * Two silent failures, both of which hid work that had already happened.
 *
 *   - **The public chat wrote no trace.** It is the only fully autonomous AI we
 *     run that talks to prospects, and there was no record anywhere of what it
 *     had said to anyone. Because it streams, there is no point at which the
 *     finished reply exists in one piece, so the tracing has to tee the stream.
 *   - **`expired` was a status nothing ever wrote.** A proposal past its expiry
 *     stayed `pending` forever, and the dedupe unique index is scoped to
 *     `status = 'pending'`, so a dead proposal held its key permanently. The
 *     next identical proposal hit a 23505, fell back to the existing row, and
 *     reported success while handing back something approval always rejects.
 *     That action could then never be staged again.
 */
import assert from "node:assert/strict";
import { finishAgentRun, startAgentRun, traceTextStream } from "../src/lib/revenue-os/agent-trace";
import { proposeAction, sweepExpiredActions } from "../src/lib/revenue-os/actions";
import { MemorySupabase, type Row } from "./lib/memory-supabase";

function textStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index >= chunks.length) { controller.close(); return; }
      controller.enqueue(encoder.encode(chunks[index++]!));
    },
  });
}

async function drain(stream: ReadableStream<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder();
  let text = "";
  for (const reader = stream.getReader(); ;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return text;
}

const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

async function main() {
  // ---- A streamed reply reaches the visitor and the ledger ---------------

  const chat = new MemorySupabase();
  const run = await startAgentRun(chat.client, { surface: "public_chat", model: "stub/model", promptPreview: "Do you work with nonprofits?" });
  assert.ok(run.id, "a run must be opened before the stream starts");

  const delivered = await drain(traceTextStream(textStream(["We do ", "work with ", "nonprofits."]), chat.client, run, () => ({ inputTokens: 12, outputTokens: 5 })));
  assert.equal(delivered, "We do work with nonprofits.", "every chunk must reach the visitor unmodified; tracing must not alter the reply");

  // The close is deliberately not awaited so it does not add latency to the
  // reply, so give the microtask queue a turn before reading the ledger.
  await new Promise((resolve) => setTimeout(resolve, 10));
  const traced = chat.rows("agent_runs")[0]!;
  assert.equal(traced.surface, "public_chat");
  assert.equal(traced.status, "completed", "a stream that delivered content must close its run as completed");
  assert.equal(traced.result_preview, "We do work with nonprofits.", "the ledger must record what was actually said to the prospect");
  assert.ok(traced.finished_at, "a closed run must record finished_at");
  assert.equal(traced.prompt_preview, "Do you work with nonprofits?", "the ledger must record what was asked");
  assert.equal(traced.input_tokens, 12, "stream tracing must retain provider input usage when the gateway reports it");
  assert.equal(traced.output_tokens, 5, "stream tracing must retain provider output usage when the gateway reports it");

  // ---- A visitor closing the tab still closes the run --------------------

  const abandoned = new MemorySupabase();
  const openRun = await startAgentRun(abandoned.client, { surface: "public_chat", model: "stub/model" });
  const partial = traceTextStream(textStream(["Half an ans", "wer"]), abandoned.client, openRun);
  const reader = partial.getReader();
  await reader.read();
  await reader.cancel("client disconnected");
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(abandoned.rows("agent_runs")[0]!.status, "cancelled", "a visitor leaving mid-answer must still reach a terminal state, or the row reads as in-flight forever");

  // ---- Tracing must never break the thing it is tracing ------------------

  const broken = new MemorySupabase();
  broken.fail("agent_runs", { message: "ledger unavailable" });
  const noRun = await startAgentRun(broken.client, { surface: "public_chat", model: "stub/model" });
  assert.equal(noRun.id, null, "a ledger failure must degrade to no trace, not throw");
  const stillDelivered = await drain(traceTextStream(textStream(["Answer"]), broken.client, noRun));
  assert.equal(stillDelivered, "Answer", "a prospect must still get their reply when the ledger is down; losing the work to protect the record of it is the wrong trade");
  await assert.doesNotReject(() => finishAgentRun(broken.client, noRun, "completed", { resultPreview: "Answer" }));

  // ---- An expired proposal must not hold its dedupe key forever ---------

  const queue = new MemorySupabase({
    action_queue: [{
      id: "stale", status: "pending", dedupe_key: "ai-task:opp-1:Follow up",
      action_type: "create_task", title: "Follow up", expires_at: iso(-86400000),
    }],
  });

  const swept = await sweepExpiredActions(queue.client);
  assert.equal(swept, 1, "a pending proposal past its expiry must be retired");
  assert.equal(queue.rows("action_queue")[0]!.status, "expired", "`expired` is a valid status that nothing ever wrote; that is why dead rows accumulated");

  // A proposal that has not expired, and one with no expiry at all, must both
  // survive. Sweeping too eagerly would delete live work.
  const live = new MemorySupabase({
    action_queue: [
      { id: "future", status: "pending", dedupe_key: "a", expires_at: iso(86400000) },
      { id: "no-expiry", status: "pending", dedupe_key: "b", expires_at: null },
      { id: "approved", status: "approved", dedupe_key: "c", expires_at: iso(-86400000) },
    ],
  });
  assert.equal(await sweepExpiredActions(live.client), 0, "the sweep must only touch pending rows that are genuinely past expiry");
  assert.deepEqual(live.rows("action_queue").map((row) => row.status), ["pending", "pending", "approved"]);

  // ---- The end-to-end failure: re-proposing after expiry -----------------

  const blocked = new MemorySupabase({
    action_queue: [{
      id: "stale", status: "pending", dedupe_key: "ai-task:opp-1:Follow up",
      action_type: "create_task", title: "Follow up", expires_at: iso(-86400000),
    }],
  });

  const reproposed = await proposeAction(blocked.client, {
    actionType: "create_task", title: "Follow up", payload: { title: "Follow up" },
    sourceContext: "admin_ai", dedupeKey: "ai-task:opp-1:Follow up", expiresAt: iso(86400000),
  }) as Row;

  assert.notEqual(reproposed.id, "stale", "re-proposing must produce a live row, not hand back the expired one that approval refuses and the queue hides");
  assert.equal(reproposed.status, "pending");
  assert.equal(blocked.rows("action_queue")[0]!.status, "expired", "the squatting row must have been retired");
  assert.equal(blocked.rows("action_queue").length, 2);

  // A genuine duplicate is still deduped. The fix must not turn the dedupe key
  // into a no-op, or the AI can stage the same action repeatedly.
  const duplicate = new MemorySupabase({
    action_queue: [{ id: "live", status: "pending", dedupe_key: "ai-task:opp-2:Call", expires_at: iso(86400000) }],
  });
  const deduped = await proposeAction(duplicate.client, {
    actionType: "create_task", title: "Call", payload: {}, sourceContext: "admin_ai",
    dedupeKey: "ai-task:opp-2:Call", expiresAt: iso(86400000),
  }) as Row;
  assert.equal(deduped.id, "live", "an unexpired duplicate must still return the existing proposal");
  assert.equal(duplicate.rows("action_queue").length, 1, "deduping must not create a second row");

  console.log(JSON.stringify({
    checks: ["stream-traced", "stream-unmodified", "cancel-is-terminal", "trace-failure-degrades", "sweep-retires-expired", "sweep-spares-live", "expired-key-released", "duplicates-still-deduped"],
    result: "passed",
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
