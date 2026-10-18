import "server-only";
import { configurationDigest } from "./module-configuration-read";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tenantStripeClient } from "./stripe-adapter";
import { assertCurrentTenantAdmin } from "./tenant-admin-authority";
import { checkpointActionResult, proposeAction } from "./actions";
import {
  billingApprovalSchema,
  billingCommandSchema,
  type BillingCommand,
  type BillingReceipt,
  type BillingPreview,
} from "./billing-command-contract";
import { formatInvoiceAmount } from "./stripe-contract";
import { invoiceIndexPageSchema } from "./invoice-index-contract";

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const amount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const chargeSchema = z
  .object({
    id: z.string().regex(/^ch_[A-Za-z0-9]{1,120}$/),
    amount,
    amount_captured: amount,
    amount_refunded: amount,
    currency: z.string().regex(/^[a-z]{3}$/),
    status: z.enum(["succeeded", "failed", "pending"]),
    paid: z.boolean(),
    captured: z.boolean(),
    disputed: z.boolean(),
    livemode: z.boolean(),
    created: z.number().int().nonnegative(),
    metadata: z.record(z.string(), z.string()),
    billing_details: z.object({ name: z.string().nullable(), email: z.string().nullable() }),
    description: z.string().nullable(),
    receipt_url: z.string().nullable(),
    payment_intent: z.string().nullable(),
  })
  .refine((charge) => charge.amount_refunded <= charge.amount_captured);
const safeReceipt = (value: string | null) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "pay.stripe.com" ? url.toString() : null;
  } catch {
    console.warn("[billing] Invalid provider receipt URL omitted");
    return null;
  }
};
export async function readBillingPayments(
  db: SupabaseClient,
  input: { cursor?: string; connection?: string; limit?: number } = {},
) {
  const limit = z
    .number()
    .int()
    .min(1)
    .max(50)
    .parse(input.limit ?? 50);
  const client = await tenantStripeClient(db);
  const connection = `${client.accountId}:${client.credentialVersion}:${client.mode}`;
  if (input.connection && input.connection !== connection)
    throw new Error("The Stripe connection changed. Refresh payments before loading more.");
  const { object: response } = await client.charges(input.cursor);
  const page = z
    .object({ data: z.array(chargeSchema).max(50), has_more: z.boolean() })
    .parse(response);
  const charges = page.data.slice(0, limit);
  if (charges.some((charge) => charge.livemode !== (client.mode === "live")))
    throw new Error("Stripe returned a payment from the wrong account mode");
  return {
    connection,
    testMode: client.mode === "test",
    payments: charges.map((charge) => ({
      id: charge.id,
      amount: charge.amount,
      captured: charge.amount_captured,
      refunded: charge.amount_refunded,
      currency: charge.currency,
      status: charge.status,
      createdAt: new Date(charge.created * 1000).toISOString(),
      name: charge.billing_details.name,
      email: charge.billing_details.email,
      description: charge.description,
      receiptUrl: safeReceipt(charge.receipt_url),
      disputed: charge.disputed,
      workspaceOwned: charge.metadata.accelerate_tenant_id === client.tenantId,
      ownershipNeedsCheck: !charge.metadata.accelerate_tenant_id && Boolean(charge.payment_intent),
      refundable:
        (charge.metadata.accelerate_tenant_id === client.tenantId ||
          (!charge.metadata.accelerate_tenant_id && Boolean(charge.payment_intent))) &&
        charge.status === "succeeded" &&
        charge.paid &&
        charge.captured &&
        !charge.disputed &&
        charge.amount_captured > charge.amount_refunded,
    })),
    hasMore: page.has_more || page.data.length > limit,
    nextCursor: charges.at(-1)?.id ?? null,
  };
}

async function owningInvoices(
  client: Awaited<ReturnType<typeof tenantStripeClient>>,
  charge: z.infer<typeof chargeSchema>,
): Promise<string[] | null> {
  if (charge.metadata.accelerate_tenant_id)
    return charge.metadata.accelerate_tenant_id === client.tenantId ? [] : null;
  if (!charge.payment_intent) return null;
  const { object: response } = await client.paymentInvoices(charge.payment_intent);
  const page = z
    .object({
      data: z
        .array(
          z.object({
            status: z.literal("paid"),
            livemode: z.boolean(),
            payment: z.object({
              type: z.literal("payment_intent"),
              payment_intent: z.literal(charge.payment_intent),
            }),
            invoice: z.object({
              id: z.string().regex(/^in_[A-Za-z0-9]{1,80}$/),
              livemode: z.boolean(),
              metadata: z.record(z.string(), z.string()),
            }),
          }),
        )
        .max(50),
      has_more: z.boolean(),
    })
    .parse(response);
  if (page.has_more)
    throw new Error("Invoice ownership evidence is incomplete. Refresh before preparing a refund.");
  if (
    !page.data.length ||
    page.data.some(
      (item) =>
        item.livemode !== (client.mode === "live") ||
        item.invoice.livemode !== (client.mode === "live") ||
        item.invoice.metadata.accelerate_tenant_id !== client.tenantId,
    )
  )
    return null;
  return [...new Set(page.data.map((item) => item.invoice.id))].sort();
}

async function inspect(
  db: SupabaseClient,
  command: BillingCommand,
): Promise<{
  client: Awaited<ReturnType<typeof tenantStripeClient>>;
  snapshot: Record<string, unknown>;
  review: BillingPreview["review"];
}> {
  const client = await tenantStripeClient(db);
  const connection = {
    tenantId: client.tenantId,
    accountId: client.accountId,
    credentialVersion: client.credentialVersion,
    testMode: client.mode === "test",
  };
  if (command.operation === "create_customer") {
    const { data, error } = await db
      .from("contacts")
      .select("id,full_name,primary_email")
      .eq("id", command.contactId)
      .maybeSingle();
    if (
      error ||
      !data ||
      !z.email().safeParse(data.primary_email).success ||
      !z.string().trim().min(1).max(160).safeParse(data.full_name).success
    )
      throw new Error("Choose an existing contact with a valid billing email.");
    return {
      client,
      snapshot: {
        ...connection,
        contactId: data.id,
        name: data.full_name,
        email: String(data.primary_email).trim().toLowerCase(),
      },
      review: {
        Operation: "Create billing customer",
        Customer: String(data.full_name),
        Email: String(data.primary_email),
        Mode: client.mode,
        Consequence:
          "Creates a billing profile only. No invoice is created and no payment is taken.",
      },
    };
  }
  if (command.operation === "void_invoice") {
    const { object: invoice } = await client.invoice(command.invoiceId);
    if (
      object(invoice.metadata).accelerate_tenant_id !== client.tenantId ||
      invoice.livemode !== (client.mode === "live")
    )
      throw new Error("Only invoices created by this workspace can be voided here.");
    if (
      !["open", "uncollectible", "void"].includes(String(invoice.status)) ||
      invoice.amount_paid !== 0
    )
      throw new Error(
        "Only a finalized unpaid invoice can be voided. Paid invoices need a refund or credit note.",
      );
    return {
      client,
      snapshot: {
        ...connection,
        invoiceId: invoice.id,
        status: invoice.status,
        customer: invoice.customer,
        email: invoice.customer_email,
        currency: invoice.currency,
        amountDue: amount.parse(invoice.amount_due),
        remaining: amount.parse(invoice.amount_remaining),
        paid: invoice.amount_paid,
      },
      review: {
        Operation: "Void unpaid invoice",
        Invoice: String(invoice.number ?? invoice.id),
        Customer: String(invoice.customer_email ?? invoice.customer),
        Amount: formatInvoiceAmount(invoice.amount_remaining, invoice.currency),
        Mode: client.mode,
        Consequence:
          "Permanently cancels this unpaid invoice. Its document and audit history remain. No refund is issued.",
      },
    };
  }
  const { object: raw } = await client.charge(command.chargeId);
  const charge = chargeSchema.parse(raw);
  const invoiceIds = await owningInvoices(client, charge);
  if (invoiceIds === null || charge.livemode !== (client.mode === "live"))
    throw new Error("Only payments belonging to this workspace can be refunded here.");
  if (charge.status !== "succeeded" || !charge.paid || !charge.captured || charge.disputed)
    throw new Error(
      "This payment is not eligible for a refund. Refresh its current payment status.",
    );
  return {
    client,
    snapshot: {
      ...connection,
      chargeId: charge.id,
      currency: charge.currency,
      captured: charge.amount_captured,
      refunded: charge.amount_refunded,
      paymentIntent: charge.payment_intent,
      orderId: charge.metadata.accelerate_order_id ?? null,
      invoiceIds,
    },
    review: {
      Operation: "Refund payment",
      Payment: charge.id,
      Customer:
        charge.billing_details.email ?? charge.billing_details.name ?? "Customer not provided",
      Refund: formatInvoiceAmount(command.amount, charge.currency),
      "Available to refund": formatInvoiceAmount(
        charge.amount_captured - charge.amount_refunded,
        charge.currency,
      ),
      Reason: command.reason === "duplicate" ? "Duplicate payment" : "Requested by customer",
      Mode: client.mode,
      Consequence:
        "Returns this exact amount to the original payment method. Refunds cannot be undone. A pending refund is not reported as completed.",
    },
  };
}
function digest(
  command: BillingCommand,
  snapshot: Record<string, unknown>,
  review: Record<string, string>,
) {
  return configurationDigest({ command, snapshot, review });
}
export async function previewBillingCommand(db: SupabaseClient, raw: unknown) {
  const command = billingCommandSchema.parse(raw);
  const { snapshot, review } = await inspect(db, command);
  if (command.operation === "void_invoice" && snapshot.status === "void")
    throw new Error("This invoice is already void.");
  if (
    command.operation === "refund_payment" &&
    command.amount > Number(snapshot.captured) - Number(snapshot.refunded)
  )
    throw new Error("The refund exceeds the remaining payment amount.");
  return { command, snapshot, review, digest: digest(command, snapshot, review) };
}
export async function proposeBillingCommand(
  db: SupabaseClient,
  raw: unknown,
  expectedDigest: string,
  actorEmail: string,
) {
  await assertCurrentTenantAdmin(db, actorEmail);
  await tenantStripeClient(db);
  const command = billingCommandSchema.parse(raw);
  const { data: prior, error: priorError } = await db
    .from("action_queue")
    .select("*")
    .eq("dedupe_key", `billing:${command.requestId}`)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (priorError)
    throw new Error("The original billing request could not be checked. Retry the same request.");
  if (prior) {
    const original = billingApprovalSchema.parse(prior.payload);
    if (
      prior.action_type !== "billing_change" ||
      original.digest !== expectedDigest ||
      configurationDigest(original.command) !== configurationDigest(command)
    )
      throw new Error("This billing request ID was used for a different operation.");
    return prior;
  }
  const preview = await previewBillingCommand(db, command);
  if (preview.digest !== expectedDigest)
    throw new Error("Billing details changed. Prepare a fresh review.");
  const action = await proposeAction(db, {
    actionType: "billing_change",
    title: preview.review.Operation,
    description: preview.review.Consequence,
    payload: preview,
    proposedBy: actorEmail,
    explicit: true,
    sourceContext: "Administrator requested an exact billing operation.",
    dedupeKey: `billing:${preview.command.requestId}`,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  });
  if (!action || billingApprovalSchema.parse(action.payload).digest !== preview.digest)
    throw new Error("This billing request ID was used for a different operation.");
  return action;
}

export async function executeBillingCommand(
  db: SupabaseClient,
  actionId: string,
  actorEmail: string,
): Promise<BillingReceipt> {
  await assertCurrentTenantAdmin(db, actorEmail);
  const { data: action, error } = await db
    .from("action_queue")
    .select("*")
    .eq("id", actionId)
    .eq("status", "executing")
    .maybeSingle();
  if (
    error ||
    !action ||
    action.action_type !== "billing_change" ||
    action.approved_by !== actorEmail ||
    !action.expires_at ||
    Date.parse(action.expires_at) <= Date.now()
  )
    throw new Error("A current human-approved billing action is required.");
  const approved = billingApprovalSchema.parse(action.payload);
  if (digest(approved.command, approved.snapshot, approved.review) !== approved.digest)
    throw new Error("The reviewed billing action changed.");
  const { command } = approved;
  const current = await inspect(db, command);
  const { client } = current;
  if (
    approved.snapshot.accountId !== client.accountId ||
    approved.snapshot.credentialVersion !== client.credentialVersion ||
    approved.snapshot.testMode !== (client.mode === "test") ||
    approved.snapshot.tenantId !== client.tenantId
  )
    throw new Error(
      "The billing connection changed. Reconcile the original operation before a new review.",
    );
  const key = `billing:${client.tenantId}:${command.requestId}`;
  const finish = async (receipt: BillingReceipt) => {
    await checkpointActionResult(db, actionId, receipt);
    return receipt;
  };
  if (command.operation === "refund_payment") {
    // Reconcile an earlier timed-out attempt before checking its old balance.
    const { object: refunds } = await client.refunds(command.chargeId);
    const list = z
      .object({ data: z.array(z.record(z.string(), z.unknown())).max(100), has_more: z.boolean() })
      .parse(refunds);
    const prior = list.data.find(
      (refund) =>
        object(refund.metadata).accelerate_billing_request_id === command.requestId &&
        object(refund.metadata).accelerate_tenant_id === client.tenantId,
    );
    if (prior)
      return finish(
        refundReceipt(
          prior,
          command,
          String(approved.snapshot.currency),
          client.mode === "test",
          null,
          true,
        ),
      );
    if (list.has_more)
      throw new Error(
        "Refund history is incomplete. Reconcile the original action before retrying.",
      );
  }
  if (command.operation === "void_invoice" && current.snapshot.status === "void")
    return finish({
      operation: command.operation,
      providerId: command.invoiceId,
      status: "void",
      message: "Stripe confirms this invoice is void. No additional cancellation was sent.",
      testMode: client.mode === "test",
      providerRequestId: null,
      reconciled: true,
    });
  if (digest(command, current.snapshot, current.review) !== approved.digest)
    throw new Error("Billing facts changed after review. Refresh and prepare a new action.");
  if (command.operation === "create_customer") {
    const { object: choices } = await client.customers(String(current.snapshot.email));
    if (!Array.isArray(choices.data) || typeof choices.has_more !== "boolean" || choices.has_more)
      throw new Error("Billing customer lookup is incomplete. Refresh before retrying.");
    const matching = choices.data.filter(
      (item) => String(object(item).email).trim().toLowerCase() === current.snapshot.email,
    );
    if (matching.length > 1)
      throw new Error(
        "Several billing customers share this email. Choose the intended customer in the invoice form.",
      );
    const existing = matching[0] ? object(matching[0]) : null;
    const result = existing
      ? { object: existing, requestId: null }
      : await client.createCustomer(
          new URLSearchParams({
            email: String(current.snapshot.email),
            name: String(current.snapshot.name),
            "metadata[accelerate_tenant_id]": client.tenantId,
            "metadata[accelerate_contact_id]": command.contactId,
            "metadata[accelerate_action_id]": action.id,
          }),
          `billing:${client.tenantId}:customer:${command.contactId}:${configurationDigest({ accountId: client.accountId, email: current.snapshot.email })}`,
        );
    const customer = z
      .object({
        id: z.string().regex(/^cus_[A-Za-z0-9]{1,80}$/),
        email: z.email(),
        livemode: z.boolean(),
      })
      .parse(result.object);
    if (
      customer.email.trim().toLowerCase() !== current.snapshot.email ||
      customer.livemode !== (client.mode === "live")
    )
      throw new Error(
        "Stripe returned a different billing customer. Reconcile the original operation.",
      );
    return finish({
      operation: command.operation,
      providerId: customer.id,
      status: "ready",
      message: existing
        ? "An existing matching billing customer is ready to select. No duplicate was created."
        : "Billing customer created. Refresh the invoice customer choices to select it.",
      testMode: client.mode === "test",
      providerRequestId: result.requestId,
      reconciled: Boolean(existing),
    });
  }
  if (command.operation === "void_invoice") {
    const result = await client.invoiceOperation(
      command.invoiceId,
      "void",
      new URLSearchParams(),
      key,
    );
    if (result.object.id !== command.invoiceId || result.object.status !== "void")
      throw new Error(
        "Stripe has not confirmed cancellation. Reconcile this operation before retrying.",
      );
    return finish({
      operation: command.operation,
      providerId: command.invoiceId,
      status: "void",
      message: "Stripe confirms that the unpaid invoice is void.",
      testMode: client.mode === "test",
      providerRequestId: result.requestId,
    });
  }
  const result = await client.createRefund(
    new URLSearchParams({
      charge: command.chargeId,
      amount: String(command.amount),
      reason: command.reason,
      "metadata[accelerate_tenant_id]": client.tenantId,
      "metadata[accelerate_billing_request_id]": command.requestId,
    }),
    key,
  );
  return finish(
    refundReceipt(
      result.object,
      command,
      String(approved.snapshot.currency),
      client.mode === "test",
      result.requestId,
      false,
    ),
  );
}
function refundReceipt(
  raw: Record<string, unknown>,
  command: Extract<BillingCommand, { operation: "refund_payment" }>,
  currency: string,
  testMode: boolean,
  requestId: string | null,
  reconciled: boolean,
): BillingReceipt {
  const refund = z
    .object({
      id: z.string().regex(/^re_[A-Za-z0-9]{1,120}$/),
      charge: z.literal(command.chargeId),
      amount: z.literal(command.amount),
      currency: z.literal(currency),
      status: z.enum(["succeeded", "pending", "requires_action", "failed", "canceled"]),
    })
    .parse(raw);
  return {
    operation: command.operation,
    providerId: refund.id,
    status: refund.status,
    testMode,
    providerRequestId: requestId,
    reconciled,
    message:
      refund.status === "succeeded"
        ? "Stripe confirms the refund succeeded. Bank processing may continue."
        : `Stripe reports this refund as ${refund.status.replaceAll("_", " ")}. No second refund was requested.`,
  };
}

const invoiceSchema = z.object({
  id: z.string().regex(/^in_[A-Za-z0-9]{1,80}$/),
  number: z.string().nullable().optional(),
  status: z.enum(["draft", "open", "paid", "uncollectible", "void"]).nullable().optional(),
  currency: z
    .string()
    .regex(/^[a-z]{3}$/)
    .nullable()
    .optional(),
  amount_due: z.number().nullable().optional(),
  amount_paid: z.number().nullable().optional(),
  amount_remaining: z.number().nullable().optional(),
  customer_name: z.string().nullable().optional(),
  customer_email: z.string().nullable().optional(),
  created: z.number(),
  due_date: z.number().nullable().optional(),
  hosted_invoice_url: z.string().url().nullable().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export async function readBillingInvoices(
  db: SupabaseClient,
  input: { cursor?: string; connection?: string; limit?: number } = {},
) {
  const limit = z
    .number()
    .int()
    .min(1)
    .max(50)
    .parse(input.limit ?? 50);
  const client = await tenantStripeClient(db);
  const connection = `${client.accountId}:${client.credentialVersion}:${client.mode}`;
  const expectedConnection = input.connection;
  if (expectedConnection && expectedConnection !== connection)
    throw new Error("The Stripe connection changed. Refresh invoices before loading more.");
  const { object } = await client.invoices(input.cursor);
  const response = z
    .object({ data: z.array(z.unknown()), has_more: z.boolean() })
    .safeParse(object);
  if (!response.success) throw new Error("Stripe returned an unexpected invoice list");
  const all = response.data.data.map((value) => invoiceSchema.parse(value));
  const invoices = all.slice(0, limit);
  return invoiceIndexPageSchema.parse({
    connection,
    testMode: client.mode === "test",
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      number: invoice.number ?? null,
      status: invoice.status ?? null,
      currency: invoice.currency ?? null,
      amountDue: invoice.amount_due ?? null,
      amountPaid: invoice.amount_paid ?? null,
      remaining: invoice.amount_remaining ?? null,
      contactName: invoice.customer_name ?? null,
      contactEmail: invoice.customer_email ?? null,
      dueDate: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      createdAt: new Date(invoice.created * 1000).toISOString(),
      managed: invoice.metadata?.accelerate_tenant_id === client.tenantId,
    })),
    hasMore: response.data.has_more || all.length > limit,
    nextCursor: invoices.length ? invoices[invoices.length - 1]!.id : null,
  });
}

/** A fresh provider observation never rewrites the original execution receipt. */
export async function readBillingActionReceipt(
  db: SupabaseClient,
  actionId: string,
): Promise<BillingReceipt> {
  const { data: action, error } = await db
    .from("action_queue")
    .select("*")
    .eq("id", z.uuid().parse(actionId))
    .eq("action_type", "billing_change")
    .maybeSingle();
  if (error || !action) throw new Error("This billing action is unavailable in this workspace.");
  const approved = billingApprovalSchema.parse(action.payload);
  const client = await tenantStripeClient(db);
  if (
    approved.snapshot.tenantId !== client.tenantId ||
    approved.snapshot.accountId !== client.accountId ||
    approved.snapshot.testMode !== (client.mode === "test")
  )
    throw new Error("Reconnect the original Stripe account and mode before checking this result.");
  const { command } = approved;
  if (command.operation === "refund_payment") {
    const { object: response, requestId } = await client.refunds(command.chargeId);
    const page = z
      .object({ data: z.array(z.record(z.string(), z.unknown())).max(100), has_more: z.boolean() })
      .parse(response);
    const found = page.data.find(
      (refund) =>
        object(refund.metadata).accelerate_billing_request_id === command.requestId &&
        object(refund.metadata).accelerate_tenant_id === client.tenantId,
    );
    if (found)
      return refundReceipt(
        found,
        command,
        String(approved.snapshot.currency),
        client.mode === "test",
        requestId,
        true,
      );
    if (page.has_more)
      throw new Error("Refund history is incomplete; no outcome can be confirmed from this page.");
    return {
      operation: command.operation,
      providerId: command.chargeId,
      status: "not_found",
      message:
        "Stripe's complete refund history contains no refund for this original request. No money was moved by this check.",
      testMode: client.mode === "test",
      providerRequestId: requestId,
      reconciled: true,
    };
  }
  if (command.operation === "void_invoice") {
    const { object: invoice, requestId } = await client.invoice(command.invoiceId);
    if (
      object(invoice.metadata).accelerate_tenant_id !== client.tenantId ||
      invoice.livemode !== (client.mode === "live")
    )
      throw new Error("The invoice no longer has verified workspace ownership.");
    const status = z.enum(["draft", "open", "paid", "uncollectible", "void"]).parse(invoice.status);
    return {
      operation: command.operation,
      providerId: command.invoiceId,
      status,
      message: `Stripe currently reports this invoice as ${status}. This check makes no change.`,
      testMode: client.mode === "test",
      providerRequestId: requestId,
      reconciled: true,
    };
  }
  const { object: response, requestId } = await client.customers(String(approved.snapshot.email));
  const page = z
    .object({ data: z.array(z.record(z.string(), z.unknown())).max(50), has_more: z.boolean() })
    .parse(response);
  if (page.has_more)
    throw new Error(
      "Billing customer history is incomplete; refine the original contact before reviewing again.",
    );
  const customers = page.data.filter(
    (customer) =>
      String(customer.email).toLowerCase() === approved.snapshot.email &&
      customer.livemode === (client.mode === "live") &&
      !customer.deleted,
  );
  if (customers.length > 1)
    throw new Error(
      "Several matching billing customers exist. Select the intended profile in the invoice form.",
    );
  return {
    operation: command.operation,
    providerId: customers[0]
      ? z
          .string()
          .regex(/^cus_[A-Za-z0-9]{1,80}$/)
          .parse(customers[0].id)
      : command.contactId,
    status: customers.length ? "ready" : "not_found",
    message: customers.length
      ? "A matching billing customer is available in the invoice choices. This check creates no profile."
      : "Stripe has no matching billing customer. This check creates no profile.",
    testMode: client.mode === "test",
    providerRequestId: requestId,
    reconciled: true,
  };
}
