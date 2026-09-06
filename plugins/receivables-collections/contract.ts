import { z } from "zod";

const date = z.iso.date().refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Expected a real UTC calendar date");
const currency = z.enum(["usd", "eur", "gbp", "cad", "aud"]);
const id = z.string().uuid();
const money = z.number().int().min(0).max(100_000_000);
const invoice = z
  .object({
    id: z.string().min(1).max(100),
    tenantId: id,
    accountId: id,
    currency,
    status: z.enum(["draft", "open", "paid", "void", "uncollectible"]),
    amountRemaining: money,
    dueDate: date.nullable(),
    disputed: z.boolean(),
    paused: z.boolean(),
    pauseUntil: date.nullable(),
  })
  .strict();
const policy = z
  .object({
    accountId: id,
    currency,
    communicationSuppressed: z.boolean(),
    promiseDate: date.nullable(),
    lastReminderAt: z.iso.datetime().nullable(),
  })
  .strict();

/** Input must be supplied by a tenant-authorized host with verified provider facts.
 * Schema validation is not a substitute for authenticating or loading that host. */
export const collectionsSnapshotSchema = z
  .object({
    version: z.literal(1),
    tenantId: id,
    asOf: z.iso.datetime(),
    observedAt: z.iso.datetime(),
    complete: z.literal(true),
    cooldownHours: z.number().int().min(1).max(720),
    invoices: z.array(invoice).max(100),
    policies: z.array(policy).max(100),
  })
  .strict()
  .superRefine((snapshot, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    const now = Date.parse(snapshot.asOf);
    const age = now - Date.parse(snapshot.observedAt);
    if (age < 0 || age > 15 * 60_000)
      fail("Invoice observations must be complete and no older than 15 minutes");
    const ids = new Set<string>();
    const policies = new Set<string>();
    for (const item of snapshot.policies) {
      const key = `${item.accountId}:${item.currency}`;
      if (policies.has(key)) fail("Duplicate account/currency policy");
      policies.add(key);
      if (item.lastReminderAt && Date.parse(item.lastReminderAt) > now)
        fail("A reminder receipt cannot be in the future");
    }
    for (const item of snapshot.invoices) {
      if (item.tenantId !== snapshot.tenantId) fail("Mixed-tenant invoice snapshot");
      if (ids.has(item.id)) fail("Duplicate provider invoice identity");
      ids.add(item.id);
      if (!policies.has(`${item.accountId}:${item.currency}`))
        fail("Account communication and promise policy must be known");
      if (item.status === "paid" && item.amountRemaining !== 0)
        fail("Paid invoice has an inconsistent remaining balance");
    }
  });
export type CollectionsSnapshot = z.infer<typeof collectionsSnapshotSchema>;
export function validateCollectionsSnapshot(raw: unknown): CollectionsSnapshot {
  const input = collectionsSnapshotSchema.parse(raw);
  if (Buffer.byteLength(JSON.stringify(input), "utf8") > 65_536)
    throw new Error("Collections snapshot exceeds 64 KiB");
  return input;
}
export const collectionsPlanSchema = z
  .object({
    version: z.literal(1),
    tenantId: id,
    asOf: z.iso.datetime(),
    observedAt: z.iso.datetime(),
    groups: z
      .array(
        z
          .object({
            accountId: id,
            currency,
            invoiceIds: z.array(z.string()).min(1).max(100),
            amountRemaining: z.number().int().positive().max(10_000_000_000),
            oldestDaysOverdue: z.number().int().positive(),
            action: z.enum([
              "prepare_reminder",
              "wait_for_promise",
              "review_broken_promise",
              "wait_for_cooldown",
              "blocked",
            ]),
            reason: z.string().min(1),
            nextCheckAt: z.iso.datetime().nullable(),
          })
          .strict(),
      )
      .max(100),
    excluded: z
      .array(
        z
          .object({
            invoiceId: z.string(),
            reason: z.enum([
              "draft",
              "paid",
              "void",
              "uncollectible",
              "settled",
              "disputed",
              "paused",
              "missing_due_date",
              "not_overdue",
            ]),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
