import assert from "node:assert/strict";
import { evaluateCollectionsSnapshot } from "../plugins/receivables-collections/evaluate";
import type { CollectionsSnapshot } from "../plugins/receivables-collections/contract";
const tenantId = "00000000-0000-4000-8000-000000000001";
const accountId = "00000000-0000-4000-8000-000000000002";
const otherTenant = "00000000-0000-4000-8000-000000000003";
function fixture(): CollectionsSnapshot {
  return {
    version: 1,
    tenantId,
    asOf: "2026-09-05T12:00:00.000Z",
    observedAt: "2026-09-05T11:55:00.000Z",
    complete: true,
    cooldownHours: 72,
    policies: [
      {
        accountId,
        currency: "usd",
        communicationSuppressed: false,
        promiseDate: null,
        lastReminderAt: null,
      },
    ],
    invoices: [
      {
        id: "in_example",
        tenantId,
        accountId,
        currency: "usd",
        status: "open",
        amountRemaining: 7500,
        dueDate: "2026-09-01",
        disputed: false,
        paused: false,
        pauseUntil: null,
      },
    ],
  };
}
const run = async (raw: unknown) => (await evaluateCollectionsSnapshot(tenantId, raw)).plan;
async function main() {
  let input = fixture();
  input.invoices.push({ ...input.invoices[0]!, id: "in_second", amountRemaining: 12500 });
  let plan = await run(input);
  assert.equal(plan.groups.length, 1);
  assert.deepEqual(plan.groups[0], {
    accountId,
    currency: "usd",
    invoiceIds: ["in_example", "in_second"],
    amountRemaining: 20000,
    oldestDaysOverdue: 4,
    action: "prepare_reminder",
    reason: "Review one consolidated reminder for these overdue invoices.",
    nextCheckAt: null,
  });
  assert.deepEqual(
    await run({ ...input, invoices: [...input.invoices].reverse() }),
    plan,
    "Ordering must not change decisions",
  );
  input.policies.push({ ...input.policies[0]!, currency: "eur" });
  input.invoices.push({
    ...input.invoices[0]!,
    id: "in_eur",
    currency: "eur",
    amountRemaining: 9900,
  });
  plan = await run(input);
  assert.deepEqual(
    plan.groups.map((g) => [g.currency, g.amountRemaining]),
    [
      ["eur", 9900],
      ["usd", 20000],
    ],
  );

  for (const [patch, reason] of [
    [{ status: "paid", amountRemaining: 0 }, "paid"],
    [{ status: "void" }, "void"],
    [{ status: "draft" }, "draft"],
    [{ status: "uncollectible" }, "uncollectible"],
    [{ amountRemaining: 0 }, "settled"],
    [{ disputed: true }, "disputed"],
    [{ paused: true }, "paused"],
    [{ pauseUntil: "2026-09-05" }, "paused"],
    [{ dueDate: null }, "missing_due_date"],
    [{ dueDate: "2026-09-05" }, "not_overdue"],
    [{ dueDate: "2026-09-06" }, "not_overdue"],
  ] as const) {
    input = fixture();
    Object.assign(input.invoices[0]!, patch);
    plan = await run(input);
    assert.equal(plan.groups.length, 0);
    assert.equal(plan.excluded[0]?.reason, reason);
  }
  input = fixture();
  input.invoices[0]!.pauseUntil = "2026-09-04";
  assert.equal((await run(input)).groups[0]?.action, "prepare_reminder");
  input = fixture();
  input.invoices[0]!.disputed = true;
  input.invoices.push({
    ...input.invoices[0]!,
    id: "in_undisputed",
    disputed: false,
    amountRemaining: 100,
  });
  plan = await run(input);
  assert.equal(plan.groups[0]?.amountRemaining, 100);
  assert.equal(plan.excluded[0]?.reason, "disputed");

  input = fixture();
  input.policies[0]!.promiseDate = "2026-09-05";
  plan = await run(input);
  assert.equal(plan.groups[0]?.action, "wait_for_promise");
  assert.equal(plan.groups[0]?.nextCheckAt, "2026-09-06T00:00:00.000Z");
  input.policies[0]!.promiseDate = "2026-09-04";
  assert.equal((await run(input)).groups[0]?.action, "review_broken_promise");
  input.policies[0]!.communicationSuppressed = true;
  assert.equal(
    (await run(input)).groups[0]?.action,
    "blocked",
    "Suppression wins over promise and cooldown",
  );
  input = fixture();
  input.policies[0]!.lastReminderAt = "2026-09-02T12:00:00.001Z";
  plan = await run(input);
  assert.equal(plan.groups[0]?.action, "wait_for_cooldown");
  assert.equal(plan.groups[0]?.nextCheckAt, "2026-09-05T12:00:00.001Z");
  input.policies[0]!.lastReminderAt = "2026-09-02T12:00:00.000Z";
  assert.equal((await run(input)).groups[0]?.action, "prepare_reminder");
  input = fixture();
  input.asOf = "2028-03-01T00:00:00.000Z";
  input.observedAt = input.asOf;
  input.invoices[0]!.dueDate = "2028-02-29";
  assert.equal((await run(input)).groups[0]?.oldestDaysOverdue, 1);

  for (const mutate of [
    (s: CollectionsSnapshot) => {
      s.observedAt = "2026-09-05T11:44:59.999Z";
    },
    (s: CollectionsSnapshot) => {
      s.observedAt = "2026-09-05T12:00:00.001Z";
    },
    (s: CollectionsSnapshot) => {
      s.invoices[0]!.tenantId = otherTenant;
    },
    (s: CollectionsSnapshot) => {
      s.invoices.push(s.invoices[0]!);
    },
    (s: CollectionsSnapshot) => {
      s.policies.push(s.policies[0]!);
    },
    (s: CollectionsSnapshot) => {
      s.policies = [];
    },
    (s: CollectionsSnapshot) => {
      s.invoices[0]!.amountRemaining = Number.MAX_SAFE_INTEGER;
    },
    (s: CollectionsSnapshot) => {
      s.invoices[0]!.amountRemaining = 0.1;
    },
    (s: CollectionsSnapshot) => {
      s.invoices[0]!.amountRemaining = -1;
    },
    (s: CollectionsSnapshot) => {
      s.invoices[0]!.status = "paid";
    },
    (s: CollectionsSnapshot) => {
      s.invoices[0]!.dueDate = "2026-02-30";
    },
    (s: CollectionsSnapshot) => {
      s.policies[0]!.lastReminderAt = "2026-09-06T12:00:00.000Z";
    },
  ]) {
    input = fixture();
    mutate(input);
    await assert.rejects(run(input));
  }
  await assert.rejects(run({ ...fixture(), complete: false }));
  await assert.rejects(run({ ...fixture(), arbitraryAuthority: true }));
  await assert.rejects(evaluateCollectionsSnapshot(otherTenant, fixture()));
  input = fixture();
  input.observedAt = "2026-09-05T11:45:00.000Z";
  assert.equal((await run(input)).groups.length, 1, "Exact freshness boundary remains valid");
  input = fixture();
  input.invoices = [];
  input.policies = [];
  assert.deepEqual((await run(input)).groups, []);
  input = fixture();
  input.invoices = Array.from({ length: 100 }, (_, i) => ({
    ...input.invoices[0]!,
    id: `in_${i}`,
    amountRemaining: 100_000_000,
  }));
  assert.equal((await run(input)).groups[0]?.amountRemaining, 10_000_000_000);
  input.invoices.push({ ...input.invoices[0]!, id: "in_101" });
  await assert.rejects(run(input));
  const { receipt } = await evaluateCollectionsSnapshot(tenantId, fixture());
  assert.match(receipt.sourceHash, /^[a-f0-9]{64}$/);
  assert.equal(receipt.pluginId, "receivables-collections");
  assert.equal(receipt.timedOut, false);
  assert.equal(receipt.memoryLimited, false);
  console.log(
    "PASS Collections decision engine: real QuickJS; consolidated balances, currency separation, exclusions, promise/suppression/cooldown decisions, date boundaries, freshness, complete snapshots, tenant binding, deterministic order and bounded money/input.",
  );
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
