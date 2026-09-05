(() => {
  // The trusted host validates a bounded complete snapshot before this binding.
  // No provider access, database, recipient selection, AI or sends exist here.
  const snapshot = collectionsSnapshot();
  const now = Date.parse(snapshot.asOf);
  const today = snapshot.asOf.slice(0, 10);
  const dayMs = 86400000;
  const policies = new Map(snapshot.policies.map((p) => [p.accountId + ":" + p.currency, p]));
  const groups = new Map();
  const excluded = [];
  for (const invoice of [...snapshot.invoices].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  )) {
    let reason = null;
    if (invoice.status !== "open") reason = invoice.status;
    else if (invoice.amountRemaining === 0) reason = "settled";
    else if (invoice.disputed) reason = "disputed";
    else if (invoice.paused || (invoice.pauseUntil && invoice.pauseUntil >= today))
      reason = "paused";
    else if (!invoice.dueDate) reason = "missing_due_date";
    else if (invoice.dueDate >= today) reason = "not_overdue";
    if (reason) {
      excluded.push({ invoiceId: invoice.id, reason });
      continue;
    }
    const key = invoice.accountId + ":" + invoice.currency;
    let group = groups.get(key);
    if (!group) {
      group = {
        accountId: invoice.accountId,
        currency: invoice.currency,
        invoiceIds: [],
        amountRemaining: 0,
        oldestDaysOverdue: 0,
      };
      groups.set(key, group);
    }
    group.invoiceIds.push(invoice.id);
    group.amountRemaining += invoice.amountRemaining;
    if (!Number.isSafeInteger(group.amountRemaining))
      throw new Error("Unsafe invoice balance total");
    group.oldestDaysOverdue = Math.max(
      group.oldestDaysOverdue,
      Math.floor((Date.parse(today) - Date.parse(invoice.dueDate)) / dayMs),
    );
  }
  const output = [];
  for (const [key, group] of groups) {
    const policy = policies.get(key);
    if (!policy) throw new Error("Missing account collection policy");
    let action = "prepare_reminder";
    let reason = "Review one consolidated reminder for these overdue invoices.";
    let nextCheckAt = null;
    if (policy.communicationSuppressed) {
      action = "blocked";
      reason = "Account communication is suppressed. An operator must resolve the restriction.";
    } else if (policy.promiseDate && policy.promiseDate >= today) {
      action = "wait_for_promise";
      reason = "An agreed payment date has not passed; do not send another reminder.";
      nextCheckAt = new Date(Date.parse(policy.promiseDate) + dayMs).toISOString();
    } else if (policy.promiseDate) {
      action = "review_broken_promise";
      reason =
        "The agreed payment date passed with an outstanding balance. Review before further contact.";
    } else if (
      policy.lastReminderAt &&
      now < Date.parse(policy.lastReminderAt) + snapshot.cooldownHours * 3600000
    ) {
      action = "wait_for_cooldown";
      reason = "A recorded reminder is still inside the configured contact cooldown.";
      nextCheckAt = new Date(
        Date.parse(policy.lastReminderAt) + snapshot.cooldownHours * 3600000,
      ).toISOString();
    }
    output.push({ ...group, action, reason, nextCheckAt });
  }
  output.sort((a, b) => {
    const ak = a.accountId + ":" + a.currency,
      bk = b.accountId + ":" + b.currency;
    return ak < bk ? -1 : ak > bk ? 1 : 0;
  });
  return {
    version: 1,
    tenantId: snapshot.tenantId,
    asOf: snapshot.asOf,
    observedAt: snapshot.observedAt,
    groups: output,
    excluded,
  };
})();
