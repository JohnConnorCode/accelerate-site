import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createCollectionsFixture } from "./lib/collections-fixture";
import { readContactConversationContext } from "../src/lib/revenue-os/conversations";
import { sendRecordedEmail } from "../src/lib/revenue-os/communications";

async function scenario(run: (f: ReturnType<typeof createCollectionsFixture>) => Promise<void>) {
  const fixture = createCollectionsFixture({ allowSends: true });
  try {
    await run(fixture);
  } finally {
    fixture.restore();
  }
}
const input = (f: ReturnType<typeof createCollectionsFixture>) => ({
  to: "billing@example.test",
  contactId: f.contact,
  subject: "A specific collaboration",
  text: "Could we discuss the proposed session?",
  idempotencyKey: `guard:${randomUUID()}`,
});
async function main() {
  await scenario(async (f) => {
    const request = input(f);
    let guarded = 0;
    const first = await sendRecordedEmail(f.db, {
      ...request,
      beforeSend: async () => {
        guarded++;
      },
    });
    assert.ok(first.providerId);
    await sendRecordedEmail(f.db, request);
    assert.equal(f.state.sends, 1);
    assert.equal(guarded, 1);
    await assert.rejects(
      sendRecordedEmail(f.db, { ...request, text: "Changed content" }),
      /different/,
    );
    assert.equal(f.state.sends, 1);
  });
  await scenario(async (f) => {
    const request = input(f);
    await assert.rejects(
      sendRecordedEmail(f.db, {
        ...request,
        beforeSend: async () => {
          throw new Error("Consent withdrawn");
        },
      }),
      /Consent withdrawn/,
    );
    assert.equal(f.state.sends, 0);
    assert.equal(
      z.object({ dispatch_attempted: z.boolean() }).parse(f.table("messages")[0]!.metadata)
        .dispatch_attempted,
      false,
    );
    await assert.rejects(sendRecordedEmail(f.db, request), /reconcile/);
  });
  await scenario(async (f) => {
    f.state.timeout = true;
    const request = input(f);
    await assert.rejects(sendRecordedEmail(f.db, request));
    assert.equal(f.table("messages")[0]!.status, "failed");
    assert.equal(
      z.object({ dispatch_attempted: z.boolean() }).parse(f.table("messages")[0]!.metadata)
        .dispatch_attempted,
      true,
    );
    await assert.rejects(sendRecordedEmail(f.db, request), /reconcile/);
    assert.equal(f.state.sends, 1);
  });
  await scenario(async (f) => {
    const other = randomUUID();
    f.table("contacts").push({
      id: other,
      tenant_id: f.tenant,
      primary_email: "partner@example.test",
      communication_status: "active",
    });
    const request = { ...input(f), cc: [{ contactId: other, email: "partner@example.test" }] };
    await assert.rejects(
      sendRecordedEmail(f.db, {
        ...request,
        cc: [{ contactId: other, email: "guessed@example.test" }],
      }),
      /changed or is suppressed/,
    );
    assert.equal(f.state.sends, 0);
    await sendRecordedEmail(f.db, request);
    assert.deepEqual(f.table("messages")[0]!.recipient_emails, [
      request.to,
      "partner@example.test",
    ]);
    assert.equal(
      z
        .object({
          association: z.object({ participants: z.array(z.object({ contact_id: z.string() })) }),
        })
        .parse(f.table("conversations")[0]!.metadata).association.participants[1]!.contact_id,
      other,
    );
    await assert.rejects(sendRecordedEmail(f.db, { ...request, cc: [] }), /different/);
    assert.equal(f.state.sends, 1);
    const primaryHistory = await readContactConversationContext(f.db, f.contact);
    const partnerHistory = await readContactConversationContext(f.db, other);
    assert.equal(primaryHistory.conversations.length, 1);
    assert.equal(partnerHistory.conversations.length, 1);
    assert.equal(partnerHistory.conversations[0]!.id, primaryHistory.conversations[0]!.id);
    assert.equal(partnerHistory.complete, true);
  });
  console.log(
    "Recorded email: exact replay, final guard, uncertain receipt, canonical CC passed (controlled transport)",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
