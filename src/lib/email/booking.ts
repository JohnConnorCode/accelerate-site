import { getResend, FROM_EMAIL } from "@/lib/email/resend";

export async function scheduleAuditPrepEmail(input: {
  email: string;
  scheduledAt: string;
  eventKey: string;
}) {
  const meeting = new Date(input.scheduledAt);
  if (Number.isNaN(meeting.getTime())) return;
  const preferred = new Date(meeting.getTime() - 24 * 60 * 60 * 1000);
  const now = Date.now();

  const options: Parameters<ReturnType<typeof getResend>["emails"]["send"]>[0] = {
    from: FROM_EMAIL,
    to: input.email,
    subject: "One question before your roofing revenue audit",
    text: `Before we meet, reply with one sentence: where do new inquiries arrive today, and who owns the follow-up after an estimate is sent?

That gives me enough context to spend the call on the highest-value gap instead of generic discovery.

You'll leave with the first fix, the implementation order, and the finding in writing within two business days.

John
Accelerate`,
  };
  if (preferred.getTime() > now + 10 * 60 * 1000) options.scheduledAt = preferred.toISOString();

  await getResend().emails.send(options, {
    idempotencyKey: `roofing-audit-prep/${input.eventKey}`.slice(0, 256),
  });
}

export async function sendNoShowRebookEmail(input: { email: string; opportunityId: string; token: string }) {
  await getResend().emails.send({
    from: FROM_EMAIL,
    to: input.email,
    subject: "Want to find another time?",
    text: `It looks like we missed each other. No problem.

If the revenue leak audit is still useful, choose another time here:
https://www.acceleratewith.us/roofing?resume=${input.token}#book

John
Accelerate`,
  }, { idempotencyKey: `roofing-no-show/${input.opportunityId}` });
}
