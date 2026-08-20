#!/usr/bin/env tsx
/**
 * Proves a failure actually reaches the founder, and that a recurring failure
 * does not bury them.
 *
 * Every failure signal used to be in-app only: admin_notifications read by a 30
 * second poll that exists solely while the tab is open. A cron could fail every
 * night and nobody would know.
 *
 * Recipients: the alert address is redirected to Resend's delivered@resend.dev
 * sink for the duration of this run, so the provider round-trip and the message
 * receipt are real while nobody is emailed.
 */
import { randomUUID } from "node:crypto";
import { raiseOperationalAlert } from "../src/lib/revenue-os/alerts";
import { createServiceRoleClient } from "../src/lib/supabase/server";

const RUN = randomUUID().slice(0, 8);
const JOB_KEY = `revenue-os-alert-verify-${RUN}`;
const RECOVERY_KEY = `revenue-os-alert-recovery-${RUN}`;
const SINK = "delivered@resend.dev";
const failures: string[] = [];

function check(label: string, condition: boolean, detail?: unknown) {
  if (!condition) failures.push(detail === undefined ? label : `${label} (got: ${JSON.stringify(detail)})`);
}

async function main() {
  const supabase = createServiceRoleClient();
  const originalAdmin = process.env.ADMIN_EMAIL;
  process.env.ADMIN_EMAIL = SINK;

  try {
    // 1. A job failure notifies and emails.
    const first = await raiseOperationalAlert(supabase, {
      kind: "job", key: JOB_KEY,
      title: `Scheduled job failed: ${JOB_KEY}`,
      detail: "Automated verification of the alert path. No action required.",
    });
    check("a job failure raises a notification", first.notified === true, first);
    check("a job failure is emailed, not just shown in the admin", first.emailed === true, first);
    check("the first occurrence is not treated as a duplicate", first.duplicate === false, first);

    const { data: raised } = await supabase.from("admin_notifications")
      .select("id,priority,dedupe_key,read").eq("dedupe_key", `alert:job:${JOB_KEY}`);
    check("exactly one notification exists", raised?.length === 1, raised?.length);
    check("the alert is marked urgent", raised?.[0]?.priority === "urgent", raised?.[0]?.priority);

    // 2. The same condition recurring must not pile up.
    const repeat = await raiseOperationalAlert(supabase, {
      kind: "job", key: JOB_KEY,
      title: `Scheduled job failed: ${JOB_KEY}`,
      detail: "Second occurrence of the same condition.",
    });
    check("a repeat of the same condition is deduplicated", repeat.duplicate === true, repeat);
    check("a repeat does not send a second email", repeat.emailed === false, repeat);

    const { count: afterRepeat } = await supabase.from("admin_notifications")
      .select("*", { count: "exact", head: true }).eq("dedupe_key", `alert:job:${JOB_KEY}`);
    check("a repeat creates no second notification", afterRepeat === 1, afterRepeat);

    // 3. Once acknowledged, the condition returning is news again.
    const { error: readError } = await supabase.from("admin_notifications")
      .update({ read: true }).eq("dedupe_key", `alert:job:${JOB_KEY}`);
    if (readError) throw new Error(`marking read: ${readError.message}`);

    const afterAck = await raiseOperationalAlert(supabase, {
      kind: "job", key: JOB_KEY,
      title: `Scheduled job failed: ${JOB_KEY}`,
      detail: "Condition returned after acknowledgement.",
    });
    check("an acknowledged alert can fire again if the condition returns", afterAck.notified === true, afterAck);

    // 4. Lower-severity kinds stay in the admin rather than interrupting.
    const recovery = await raiseOperationalAlert(supabase, {
      kind: "recovery", key: RECOVERY_KEY,
      title: `Recovered an abandoned run: ${RECOVERY_KEY}`,
      detail: "Automated verification. No action required.",
    });
    check("a recovery notice is recorded in the admin", recovery.notified === true, recovery);
    check("a recovery notice does not email", recovery.emailed === false, recovery);

    console.log(JSON.stringify({
      run: RUN, alertRecipient: SINK,
      result: failures.length ? "failed" : "passed",
      note: "delivered@resend.dev is Resend's test sink; no person was emailed.",
    }, null, 2));
  } finally {
    if (originalAdmin === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = originalAdmin;

    await supabase.from("admin_notifications").delete().like("dedupe_key", `alert:%${RUN}`);
    const { data: messages } = await supabase.from("messages").select("id,conversation_id").like("idempotency_key", `alert:%${RUN}`);
    for (const message of messages ?? []) {
      if (message.conversation_id) {
        await supabase.from("activities").delete().eq("conversation_id", message.conversation_id);
        await supabase.from("messages").delete().eq("conversation_id", message.conversation_id);
        await supabase.from("conversations").delete().eq("id", message.conversation_id);
      }
      await supabase.from("messages").delete().eq("id", message.id);
    }
    await supabase.from("sent_emails").delete().like("subject", `%${RUN}%`);
  }

  if (failures.length) {
    console.error(`\nOperational alert verification failed ${failures.length} check(s):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Operational alert verification errored:", error instanceof Error ? error.message : error);
  console.error(`Look for leftovers containing ${RUN}.`);
  process.exit(1);
});
