import {
  billingApprovalSchema,
  billingCommandSchema,
  type BillingPayment,
  type BillingPreview,
} from "@/lib/revenue-os/billing-command-contract";
import { formatInvoiceAmount } from "@/lib/revenue-os/stripe-contract";
import type { DemoBusinessState } from "./business-runtime";
import type { DemoScenarioPack } from "./scenarios";
export type DemoBillingState = { payments: BillingPayment[]; createdCustomers: string[] };

/** Browser-session simulation only. No provider, database or customer-message access. */
export async function handleDemoBilling(
  pack: DemoScenarioPack,
  state: DemoBusinessState,
  modules: Record<string, boolean>,
  url: URL,
  method: string,
  body: Record<string, unknown>,
  save: () => void,
  hash: (value: unknown) => Promise<string>,
) {
  const action =
    url.pathname === "/api/admin/revenue-os/actions" && method === "PATCH"
      ? state.actions.find((item) => item.id === body.id && item.action_type === "billing_change")
      : undefined;
  if (
    !action &&
    !["/api/admin/invoicing/commands", "/api/admin/invoicing/payments"].includes(url.pathname)
  )
    return null;
  if (!modules["stripe-invoicing"])
    throw new Error("Stripe invoicing is disabled in this demo workspace.");
  const respond = (value: unknown) => Response.json({ ...(value as object), simulated: true });
  if (!state.billing) {
    const paid = state.invoices.find((item) => item.receipt.status === "paid")!;
    const amount = paid.receipt.amountPaid;
    const base = {
      amount,
      captured: amount,
      refunded: 0,
      currency: "usd",
      status: "succeeded" as const,
      createdAt: new Date().toISOString(),
      name: paid.document.customerName,
      email: paid.document.customerEmail,
      description: "Fictional invoice payment",
      receiptUrl: null,
      refundable: true,
      workspaceOwned: true,
      disputed: false,
    };
    state.billing = {
      createdCustomers: [],
      payments: [
        { ...base, id: "ch_demopayment1" },
        {
          ...base,
          id: "ch_demopayment2",
          currency: "eur",
          amount: 24000,
          captured: 24000,
          refunded: 4000,
          name: "Example account payment",
          email: "accounts@outside.example",
          workspaceOwned: false,
          refundable: false,
        },
        { ...base, id: "ch_demofailed3", status: "failed", captured: 0, refundable: false },
      ],
    };
  }
  const billing = state.billing;
  if (url.pathname === "/api/admin/invoicing/payments" && method === "GET")
    return respond({
      payments: billing.payments,
      hasMore: false,
      nextCursor: null,
      connection: `demo:${pack.id}`,
      testMode: true,
    });
  if (url.pathname === "/api/admin/invoicing/commands" && method === "GET") {
    const original = state.actions.find(
      (item) =>
        item.id === url.searchParams.get("actionId") && item.action_type === "billing_change",
    );
    if (!original) throw new Error("Choose an existing fictional billing action.");
    if (!original.result)
      throw new Error("This fictional billing action has no provider result yet.");
    return respond({
      ...original.result,
      reconciled: true,
      message: "Simulated · Current fictional result checked. No provider effect occurred.",
    });
  }
  const preview = async (raw: unknown): Promise<BillingPreview> => {
    const command = billingCommandSchema.parse(raw);
    let snapshot: Record<string, unknown>;
    let review: BillingPreview["review"];
    if (command.operation === "create_customer") {
      const contact = pack.people.find((item) => item.id === command.contactId);
      if (!contact) throw new Error("Choose a fictional contact.");
      snapshot = { contactId: contact.id, name: contact.name, email: contact.email };
      review = {
        Operation: "Create billing customer",
        Customer: contact.name,
        Email: contact.email,
        Mode: "test",
        Consequence: "Simulates a billing profile. No invoice or payment is created.",
      };
    } else if (command.operation === "void_invoice") {
      const invoice = state.invoices.find((item) => item.receipt.invoiceId === command.invoiceId);
      if (
        !invoice ||
        !["open", "uncollectible"].includes(invoice.receipt.status) ||
        invoice.receipt.amountPaid !== 0
      )
        throw new Error("Choose a finalized unpaid fictional invoice.");
      snapshot = {
        invoiceId: invoice.receipt.invoiceId,
        status: invoice.receipt.status,
        remaining: invoice.receipt.amountRemaining,
      };
      review = {
        Operation: "Void unpaid invoice",
        Invoice: invoice.document.number,
        Customer: invoice.document.customerName,
        Amount: formatInvoiceAmount(invoice.receipt.amountRemaining, invoice.receipt.currency),
        Mode: "test",
        Consequence: "Simulates invoice cancellation. No Stripe invoice is changed.",
      };
    } else {
      const payment = billing.payments.find((item) => item.id === command.chargeId);
      if (!payment?.refundable || command.amount > payment.captured - payment.refunded)
        throw new Error("Choose a refundable demo workspace payment and an available amount.");
      snapshot = { chargeId: payment.id, captured: payment.captured, refunded: payment.refunded };
      review = {
        Operation: "Refund payment",
        Payment: payment.id,
        Customer: payment.email ?? "Example customer",
        Refund: formatInvoiceAmount(command.amount, payment.currency),
        Reason: command.reason,
        Mode: "test",
        Consequence: "Simulates this exact refund. No money moves and no provider is called.",
      };
    }
    return { command, snapshot, review, digest: await hash({ command, snapshot, review }) };
  };
  if (action) {
    if (body.decision === "reject" && action.status === "pending") {
      action.status = "rejected";
      save();
      return respond({ success: true });
    }
    if (body.decision === "retry" && action.status === "failed") {
      action.status = "pending";
      save();
      return respond({ success: true });
    }
    if (body.decision !== "approve" || action.status !== "pending")
      throw new Error("This fictional billing action is already handled.");
    const approved = billingApprovalSchema.parse(action.payload);
    const current = await preview(approved.command);
    if (current.digest !== approved.digest)
      throw new Error("Fictional billing details changed. Prepare a new review.");
    const command = approved.command;
    let providerId: string;
    if (command.operation === "refund_payment") {
      const payment = billing.payments.find((item) => item.id === command.chargeId)!;
      payment.refunded += command.amount;
      payment.refundable = payment.refunded < payment.captured;
      providerId = "re_demo" + action.id.replaceAll("-", "");
    } else if (command.operation === "void_invoice") {
      const invoice = state.invoices.find((item) => item.receipt.invoiceId === command.invoiceId)!;
      invoice.receipt.status = "void";
      invoice.receipt.amountRemaining = 0;
      invoice.document.status = "void";
      invoice.document.amountRemaining = 0;
      providerId = invoice.receipt.invoiceId;
    } else {
      billing.createdCustomers.push(command.contactId);
      providerId = "cus_demo" + command.contactId.replaceAll("-", "");
    }
    action.status = "executed";
    action.result = {
      operation: command.operation,
      providerId,
      status:
        command.operation === "void_invoice"
          ? "void"
          : command.operation === "create_customer"
            ? "ready"
            : "succeeded",
      testMode: true,
      providerRequestId: null,
      message:
        "Simulated · Billing operation completed in this browser session. No provider effect occurred.",
    };
    state.receipts.unshift({
      id: crypto.randomUUID(),
      operation: "Simulated billing operation",
      at: new Date().toISOString(),
      simulated: true,
      sourceType: "approval",
      sourceId: action.id,
    });
    save();
    return respond({ success: true, result: action.result });
  }
  if (url.pathname === "/api/admin/invoicing/commands" && method === "POST") {
    const current = await preview(body.command);
    if (body.mode === "preview") return respond(current);
    if (body.mode !== "propose" || current.digest !== body.digest)
      throw new Error("Prepare a fresh fictional billing preview.");
    const prior = state.actions.find(
      (item) =>
        item.action_type === "billing_change" && item.requestId === current.command.requestId,
    );
    if (prior) {
      if (prior.digest !== current.digest) throw new Error("Request ID already used.");
      return respond(prior);
    }
    if (state.actions.length >= 100) throw new Error("Reset the demo to start a fresh session.");
    const staged = {
      id: crypto.randomUUID(),
      action_type: "billing_change",
      title: current.review.Operation!,
      description: current.review.Consequence!,
      status: "pending",
      error: null,
      payload: current,
      result: null,
      pluginId: "billing",
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      requestId: current.command.requestId,
      digest: current.digest,
    };
    state.actions.unshift(staged);
    save();
    return respond(staged);
  }
  throw new Error("Unsupported fictional billing operation.");
}
