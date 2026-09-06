(() => {
  const input = workflowInput();
  const contact = readSource("contact")[0];
  if (!contact || !contact.primary_email)
    throw new Error("Choose a customer with a canonical billing email");
  const total = input.lines.reduce((sum, line) => sum + line.quantity * line.unitAmount, 0);
  if (!Number.isSafeInteger(total) || total <= 0 || total > 100000000)
    throw new Error("Invoice total is outside the supported range");
  return {
    title: "Invoice for " + contact.full_name,
    summary:
      "Create a " +
      input.currency.toUpperCase() +
      " " +
      (total / 100).toFixed(2) +
      " draft for " +
      contact.primary_email +
      ". Sending requires a separate approval.",
    action: {
      type: "create_stripe_invoice_draft",
      payload: { ...input, expectedEmail: contact.primary_email, total },
    },
  };
})();
