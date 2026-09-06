import assert from "node:assert/strict";
import { recordGmailSendReceipt } from "../src/lib/revenue-os/google";
import { MemorySupabase } from "./lib/memory-supabase";

const receipt = {
  conversationId: "conv-1",
  idempotencyKey: "reply-claim-1",
  ownerEmail: "john@acceleratewith.us",
  recipient: "alex@example.com",
  subject: "Re: Scope review",
  body: "Thanks — Thursday works.",
  sentId: "gmail-sent-1",
  sentThreadId: "gmail-thread-1",
  sentLabelIds: ["SENT"],
  inReplyTo: "<mid-1@mail>",
  references: "<root@mail> <mid-1@mail>",
  sentAt: new Date().toISOString(),
};

// Case 1: no race. Claim row retires, exactly one sent receipt remains.
async function main() {
  {
    const mem = new MemorySupabase({
      messages: [
        {
          id: "claim-1",
          conversation_id: "conv-1",
          external_id: null,
          status: "processing",
          idempotency_key: "reply-claim-1",
        },
      ],
    });
    const saved = await recordGmailSendReceipt(mem.client as never, {
      ...receipt,
      claimId: "claim-1",
    });
    assert.ok(saved.id);
    const rows = mem.rows("messages");
    assert.equal(rows.length, 1, "claim retires; one canonical row remains");
    assert.equal(rows[0]!.status, "sent");
    assert.equal(rows[0]!.external_id, "gmail-sent-1");
    assert.equal(rows[0]!.in_reply_to, "<mid-1@mail>");
  }

  // Case 2: a sync stored the sent message first. The receipt heals that row
  // instead of duplicating it, and the claim still retires.
  {
    const mem = new MemorySupabase({
      messages: [
        {
          id: "sync-row-1",
          conversation_id: "conv-1",
          external_id: "gmail-sent-1",
          status: "received",
        },
        {
          id: "claim-1",
          conversation_id: "conv-1",
          external_id: null,
          status: "processing",
          idempotency_key: "reply-claim-1",
        },
      ],
    });
    const saved = await recordGmailSendReceipt(mem.client as never, {
      ...receipt,
      claimId: "claim-1",
    });
    const rows = mem.rows("messages");
    assert.equal(rows.length, 1, "no duplicate across reply and sync paths");
    assert.equal(saved.id, "sync-row-1", "the raced row is healed in place");
    assert.equal(rows[0]!.status, "sent");
  }

  // Case 3: replay. Recording the same receipt twice stays one row.
  {
    const mem = new MemorySupabase({ messages: [] });
    await recordGmailSendReceipt(mem.client as never, { ...receipt, claimId: "missing-claim" });
    await recordGmailSendReceipt(mem.client as never, { ...receipt, claimId: "missing-claim" });
    assert.equal(mem.rows("messages").length, 1, "replay is idempotent");
  }

  console.log(
    JSON.stringify({
      result: "passed",
      checks: ["claim-retires-no-race", "sync-race-heals-in-place", "replay-idempotent"],
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
