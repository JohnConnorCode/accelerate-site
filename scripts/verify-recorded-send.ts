#!/usr/bin/env tsx
/**
 * Loop One step 6 evidence: prove the one auditable sender records a truthful
 * receipt for every outcome, and that a retry cannot deliver a second copy.
 *
 * Recipients: this never emails a person. The live leg sends to
 * delivered@resend.dev, Resend's own test sink, so the provider round-trip,
 * provider id, and local receipts are all real while nobody receives mail.
 *
 * Modes:
 *   (default)          validation refusals, then a real send and an idempotent replay
 *   --mode=provider-failure   run with a deliberately invalid RESEND_API_KEY to prove a
 *                             rejected send leaves a failed receipt, not a phantom success
 *   --cleanup          remove every row this script can create
 *
 * The Resend client is cached per process, so the provider-failure mode must be
 * invoked as its own process with the bad key in the environment.
 */
import { randomUUID } from "node:crypto";
import { sendRecordedEmail } from "../src/lib/revenue-os/communications";
import { createServiceRoleClient } from "../src/lib/supabase/server";

const TEST_RECIPIENT = "delivered@resend.dev";
const KEY_PREFIX = "revenue-os-send-verify";
const SUBJECT_PREFIX = "Revenue OS send verification";

const modeArg = process.argv.find((arg) => arg.startsWith("--mode="));
const mode = modeArg ? modeArg.slice("--mode=".length) : "default";
const cleanupOnly = process.argv.includes("--cleanup");
const runId = randomUUID().slice(0, 8);
const failures: string[] = [];

function check(label: string, condition: boolean, detail?: unknown) {
  if (!condition)
    failures.push(detail === undefined ? label : `${label} (got: ${JSON.stringify(detail)})`);
}

async function expectRejection(label: string, run: () => Promise<unknown>, expected: RegExp) {
  try {
    await run();
    failures.push(`${label} (no error thrown)`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    check(label, expected.test(message), message);
  }
}

async function purge(supabase: ReturnType<typeof createServiceRoleClient>) {
  const { data: messages } = await supabase
    .from("messages")
    .select("id,conversation_id")
    .like("idempotency_key", `${KEY_PREFIX}%`);
  const conversationIds = [
    ...new Set((messages ?? []).map((row) => row.conversation_id).filter(Boolean)),
  ] as string[];
  await supabase.from("messages").delete().like("idempotency_key", `${KEY_PREFIX}%`);
  for (const conversationId of conversationIds) {
    await supabase.from("activities").delete().eq("conversation_id", conversationId);
    await supabase.from("messages").delete().eq("conversation_id", conversationId);
    await supabase.from("conversations").delete().eq("id", conversationId);
  }
  await supabase.from("conversations").delete().like("external_id", `resend:${KEY_PREFIX}%`);
  await supabase.from("sent_emails").delete().like("subject", `${SUBJECT_PREFIX}%`);
}

async function main() {
  const supabase = createServiceRoleClient();

  if (cleanupOnly) {
    await purge(supabase);
    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .like("idempotency_key", `${KEY_PREFIX}%`);
    console.log(
      JSON.stringify(
        {
          mode: "cleanup",
          leftoverMessages: count ?? 0,
          result: (count ?? 0) === 0 ? "clean" : "incomplete",
        },
        null,
        2,
      ),
    );
    if (count) process.exit(1);
    return;
  }

  const base = {
    subject: `${SUBJECT_PREFIX} ${runId}`,
    text: `Automated verification ${runId}. No action required.`,
  };

  if (mode === "provider-failure") {
    // A rejected provider call must leave a failed receipt behind so the operator
    // can see what happened, and must not report success.
    const key = `${KEY_PREFIX}:fail:${runId}`;
    await expectRejection(
      "a rejected provider call surfaces the provider error",
      () => sendRecordedEmail(supabase, { ...base, to: TEST_RECIPIENT, idempotencyKey: key }),
      /.+/,
    );
    const { data: claim } = await supabase
      .from("messages")
      .select("status,provider_id,metadata")
      .eq("idempotency_key", key)
      .maybeSingle();
    check("the failed send leaves a durable receipt", Boolean(claim), claim);
    check(
      "the receipt records a failed status rather than sent",
      claim?.status === "failed",
      claim?.status,
    );
    check("the receipt has no provider id", !claim?.provider_id, claim?.provider_id);
    check(
      "the receipt records the provider error",
      Boolean((claim?.metadata as { error?: string } | null)?.error),
      claim?.metadata,
    );

    // A retry after a failure must not silently send: the claim is still present.
    await expectRejection(
      "a retry after failure refuses until the receipt is reviewed",
      () => sendRecordedEmail(supabase, { ...base, to: TEST_RECIPIENT, idempotencyKey: key }),
      /already being processed/i,
    );

    console.log(
      JSON.stringify({ mode, runId, result: failures.length ? "failed" : "passed" }, null, 2),
    );
    if (failures.length) {
      for (const failure of failures) console.error(`- ${failure}`);
      process.exit(1);
    }
    return;
  }

  // --- Validation refusals (these throw before any provider call) -----------
  await expectRejection(
    "an invalid recipient is refused",
    () => sendRecordedEmail(supabase, { ...base, to: "not-an-email" }),
    /valid recipient/i,
  );
  await expectRejection(
    "an empty subject is refused",
    () => sendRecordedEmail(supabase, { ...base, subject: "   ", to: TEST_RECIPIENT }),
    /Subject and message body/i,
  );
  await expectRejection(
    "an empty body is refused",
    () => sendRecordedEmail(supabase, { ...base, text: "   ", to: TEST_RECIPIENT }),
    /Subject and message body/i,
  );
  await expectRejection(
    "an oversized idempotency key is refused",
    () =>
      sendRecordedEmail(supabase, { ...base, to: TEST_RECIPIENT, idempotencyKey: "x".repeat(257) }),
    /256 characters/i,
  );

  // --- Live send to the provider test sink ---------------------------------
  const key = `${KEY_PREFIX}:${runId}`;
  const first = await sendRecordedEmail(supabase, {
    ...base,
    to: TEST_RECIPIENT,
    idempotencyKey: key,
    actorEmail: process.env.ADMIN_EMAIL,
    source: "admin",
    template: "verification",
  });
  check("the send returns a provider id", Boolean(first.providerId), first.providerId);
  check("the send returns a local message id", Boolean(first.messageId), first.messageId);
  check("the send returns a conversation id", Boolean(first.conversationId), first.conversationId);

  const { data: message } = await supabase
    .from("messages")
    .select("status,provider_id,sent_at,direction,recipient_emails")
    .eq("id", first.messageId!)
    .single();
  check("the message receipt is marked sent", message?.status === "sent", message?.status);
  check(
    "the message receipt stores the provider id",
    message?.provider_id === first.providerId,
    message?.provider_id,
  );
  check(
    "the message receipt records a sent timestamp",
    Boolean(message?.sent_at),
    message?.sent_at,
  );
  check(
    "the message is recorded as outbound",
    message?.direction === "outbound",
    message?.direction,
  );
  check(
    "the message records the recipient",
    (message?.recipient_emails ?? []).includes(TEST_RECIPIENT),
    message?.recipient_emails,
  );

  const { count: activityCount } = await supabase
    .from("activities")
    .select("*", { count: "exact", head: true })
    .eq("conversation_id", first.conversationId!)
    .eq("activity_type", "email_sent");
  check("one email_sent activity is recorded", activityCount === 1, activityCount);

  const { count: auditCount } = await supabase
    .from("audit_log")
    .select("*", { count: "exact", head: true })
    .eq("action", "email.sent")
    .eq("entity_id", first.conversationId!);
  check("the send is audited", (auditCount ?? 0) >= 1, auditCount);

  // --- Idempotent replay ---------------------------------------------------
  const second = await sendRecordedEmail(supabase, {
    ...base,
    to: TEST_RECIPIENT,
    idempotencyKey: key,
    actorEmail: process.env.ADMIN_EMAIL,
    source: "admin",
    template: "verification",
  });
  check(
    "a replay returns the original provider id rather than sending again",
    second.providerId === first.providerId,
    { first: first.providerId, second: second.providerId },
  );
  check("a replay returns the original message id", second.messageId === first.messageId, {
    first: first.messageId,
    second: second.messageId,
  });

  const { count: messagesAfterReplay } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("idempotency_key", key);
  check(
    "a replay does not create a second message receipt",
    messagesAfterReplay === 1,
    messagesAfterReplay,
  );
  const { count: activitiesAfterReplay } = await supabase
    .from("activities")
    .select("*", { count: "exact", head: true })
    .eq("conversation_id", first.conversationId!)
    .eq("activity_type", "email_sent");
  check(
    "a replay does not create a second email_sent activity",
    activitiesAfterReplay === 1,
    activitiesAfterReplay,
  );

  await purge(supabase);
  const { count: leftover } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .like("idempotency_key", `${KEY_PREFIX}%`);
  check("cleanup removed every verification message", (leftover ?? 0) === 0, leftover);

  console.log(
    JSON.stringify(
      {
        mode,
        runId,
        recipient: TEST_RECIPIENT,
        providerId: first.providerId,
        result: failures.length ? "failed" : "passed",
        note: "delivered@resend.dev is Resend's test sink; no person received mail. Audit rows are retained.",
      },
      null,
      2,
    ),
  );
  if (failures.length) {
    console.error(`\nRecorded send verification failed ${failures.length} check(s):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(
    "Recorded send verification errored:",
    error instanceof Error ? error.message : error,
  );
  console.error(`Run ${runId} may have left rows behind. Run with --cleanup.`);
  process.exit(1);
});
