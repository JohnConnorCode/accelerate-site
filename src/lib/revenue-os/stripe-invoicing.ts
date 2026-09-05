import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { tenantStripeClient } from "./stripe-adapter";
import { stripeInvoiceInputSchema, type StripeInvoiceReceipt } from "./stripe-contract";
import { checkpointActionResult, proposeAction } from "./actions";

type ProviderObject = Record<string, unknown>;
const idSchema = z.string().regex(/^in_[A-Za-z0-9]{1,80}$/);
const invoicePayloadSchema = z.object({
  expectedEmail: z.email(),
  total: z.number().int().positive(),
  credentialVersion: z.number().int(),
  accountId: z.string().min(1),
  testMode: z.boolean(),
});
function validUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      ["invoice.stripe.com", "pay.stripe.com"].includes(url.hostname)
      ? url.toString()
      : null;
  } catch {
    console.warn("[stripe] Invalid hosted invoice URL omitted");
    return null;
  }
}
function receipt(
  invoice: ProviderObject,
  requestId: string | null,
  delivery: StripeInvoiceReceipt["delivery"],
  complete: boolean,
): StripeInvoiceReceipt {
  idSchema.parse(invoice.id);
  if (
    !z.enum(["draft", "open", "paid", "void", "uncollectible"]).safeParse(invoice.status).success ||
    !z.enum(["usd", "eur", "gbp", "cad", "aud"]).safeParse(invoice.currency).success ||
    !Number.isSafeInteger(invoice.amount_due) ||
    !Number.isSafeInteger(invoice.amount_paid) ||
    !Number.isSafeInteger(invoice.amount_remaining) ||
    typeof invoice.livemode !== "boolean"
  )
    throw new Error("Stripe returned an incomplete invoice receipt");
  return {
    invoiceId: invoice.id as string,
    status: invoice.status as string,
    currency: invoice.currency as string,
    amountDue: invoice.amount_due as number,
    amountPaid: invoice.amount_paid as number,
    amountRemaining: invoice.amount_remaining as number,
    customerEmail: typeof invoice.customer_email === "string" ? invoice.customer_email : null,
    testMode: !invoice.livemode,
    hostedInvoiceUrl: validUrl(invoice.hosted_invoice_url),
    providerRequestId: requestId,
    delivery,
    complete,
  };
}
function invoiceFingerprint(invoice: ProviderObject): string {
  const lines = invoice.lines as { data?: unknown[]; has_more?: boolean } | undefined;
  if (!Array.isArray(lines?.data) || lines.has_more)
    throw new Error("Invoice lines are incomplete; inspect Stripe before approval");
  return createHash("sha256")
    .update(
      JSON.stringify({
        customer: invoice.customer,
        email: invoice.customer_email,
        currency: invoice.currency,
        total: invoice.total,
        amountDue: invoice.amount_due,
        lines: lines.data.map((value) => {
          const line = value as ProviderObject;
          return {
            id: line.id,
            description: line.description,
            amount: line.amount,
            currency: line.currency,
            quantity: line.quantity,
            pricing: line.pricing,
            discounts: line.discounts,
            taxes: line.taxes,
          };
        }),
        collection: invoice.collection_method,
      }),
    )
    .digest("hex");
}
async function canonicalContact(db: SupabaseClient, contactId: string, expectedEmail?: string) {
  const { data, error } = await db
    .from("contacts")
    .select("id,full_name,primary_email")
    .eq("id", contactId)
    .maybeSingle();
  if (
    error ||
    !data ||
    typeof data.primary_email !== "string" ||
    !z.email().safeParse(data.primary_email).success
  )
    throw new Error("Customer billing identity is unavailable");
  if (expectedEmail && data.primary_email.toLowerCase() !== expectedEmail.toLowerCase())
    throw new Error("Customer billing email changed; prepare a fresh invoice review");
  return data;
}
function validateOwnedInvoice(invoice: ProviderObject, tenantId: string, mode: "test" | "live") {
  const metadata = invoice.metadata as Record<string, unknown> | undefined;
  if (metadata?.accelerate_tenant_id !== tenantId || invoice.livemode !== (mode === "live"))
    throw new Error("Invoice does not belong to this workspace and Stripe mode");
}
/** Enrich a prepared plan with authoritative provider/account and customer facts
 * before it enters the approval queue. No provider mutation occurs here. */
export async function reviewStripeInvoice(db: SupabaseClient, payload: Record<string, unknown>) {
  const input = stripeInvoiceInputSchema.parse(
    Object.fromEntries(
      Object.keys(stripeInvoiceInputSchema.shape ?? {}).map((key) => [key, payload[key]]),
    ),
  );
  const client = await tenantStripeClient(db);
  const contact = await canonicalContact(
    db,
    input.contactId,
    typeof payload.expectedEmail === "string" ? payload.expectedEmail : undefined,
  );
  const { object: customer } = await client.customer(input.customerId);
  if (
    customer.deleted ||
    customer.livemode !== (client.mode === "live") ||
    typeof customer.email !== "string" ||
    customer.email.toLowerCase() !== contact.primary_email.toLowerCase()
  )
    throw new Error("Stripe customer must match the selected CRM billing email and account mode");
  const total = input.lines.reduce((sum, line) => sum + line.quantity * line.unitAmount, 0);
  return {
    ...input,
    expectedEmail: contact.primary_email,
    total,
    credentialVersion: client.credentialVersion,
    accountId: client.accountId,
    testMode: client.mode === "test",
  };
}
export async function stripeBillingChoices(db: SupabaseClient, search = "", contactId?: string) {
  z.string().max(100).parse(search);
  const contact = contactId ? await canonicalContact(db, z.uuid().parse(contactId)) : null;
  const client = await tenantStripeClient(db);
  const [{ object }, { data: contacts, error }] = await Promise.all([
    client.customers(contact?.primary_email),
    db
      .from("contacts")
      .select("id,full_name,primary_email")
      .ilike("full_name", `%${search.replace(/[\\%_]/g, "\\$&")}%`)
      .order("full_name")
      .limit(100),
  ]);
  if (error || !Array.isArray(object.data))
    throw new Error("Billing customer choices could not be read");
  return {
    testMode: client.mode === "test",
    customers: (object.data as ProviderObject[])
      .filter((customer) => customer.livemode === (client.mode === "live") && !customer.deleted)
      .map((customer) => ({ id: customer.id, name: customer.name, email: customer.email })),
    contacts: contacts ?? [],
    truncated: Boolean(object.has_more) || (contacts?.length ?? 0) === 100,
  };
}
/** The shared action executor calls this only after an explicit approval. The
 * service independently verifies the persisted claim before provider access. */
export async function executeStripeInvoiceAction(
  db: SupabaseClient,
  actionId: string,
  actorEmail: string,
) {
  const { data: action, error } = await db
    .from("action_queue")
    .select("*")
    .eq("id", actionId)
    .eq("status", "executing")
    .maybeSingle();
  if (
    error ||
    !action ||
    action.approved_by !== actorEmail ||
    !["create_stripe_invoice_draft", "send_stripe_invoice"].includes(action.action_type)
  )
    throw new Error("A current human-approved invoice action is required");
  if (!action.expires_at || Date.parse(action.expires_at) <= Date.now())
    throw new Error(
      "Invoice operation expired; reconcile with Stripe before preparing a new operation",
    );
  const client = await tenantStripeClient(db);
  const raw = action.payload as Record<string, unknown>;
  if (
    raw.credentialVersion !== client.credentialVersion ||
    raw.accountId !== client.accountId ||
    raw.testMode !== (client.mode === "test")
  )
    throw new Error("Stripe account or credentials changed; fresh approval is required");
  const key = `accelerate:${client.tenantId}:${actionId}`;
  if (action.action_type === "create_stripe_invoice_draft") {
    const { pluginOrigin: _origin, ...withoutOrigin } = raw;
    void _origin;
    // Parse business fields separately: input is strict and host receipt fields
    // cannot smuggle additional provider parameters through the plugin.
    const keys = ["contactId", "customerId", "currency", "daysUntilDue", "memo", "lines"];
    const input = stripeInvoiceInputSchema.parse(
      Object.fromEntries(keys.map((k) => [k, withoutOrigin[k]])),
    );
    const payload = invoicePayloadSchema.parse({
      ...input,
      expectedEmail: raw.expectedEmail,
      total: raw.total,
      credentialVersion: raw.credentialVersion,
      accountId: raw.accountId,
      testMode: raw.testMode,
    });
    await canonicalContact(db, input.contactId, payload.expectedEmail);
    const { object: customer } = await client.customer(input.customerId);
    if (
      customer.deleted ||
      customer.livemode !== (client.mode === "live") ||
      typeof customer.email !== "string" ||
      customer.email.toLowerCase() !== payload.expectedEmail.toLowerCase()
    )
      throw new Error("Stripe billing customer changed; fresh approval required");
    const total = input.lines.reduce((sum, line) => sum + line.quantity * line.unitAmount, 0);
    if (total !== payload.total) throw new Error("Invoice total differs from approval");
    const prior = action.result as StripeInvoiceReceipt | null;
    let created: { object: ProviderObject; requestId: string | null };
    if (prior?.invoiceId) created = await client.invoice(idSchema.parse(prior.invoiceId));
    else {
      const body = new URLSearchParams({
        customer: input.customerId,
        currency: input.currency,
        collection_method: "send_invoice",
        auto_advance: "false",
        pending_invoice_items_behavior: "exclude",
        days_until_due: String(input.daysUntilDue),
        description: input.memo,
        "metadata[accelerate_tenant_id]": client.tenantId,
        "metadata[accelerate_action_id]": actionId,
        "metadata[accelerate_contact_id]": input.contactId,
      });
      created = await client.createInvoice(body, `${key}:draft`);
    }
    validateOwnedInvoice(created.object, client.tenantId, client.mode);
    if (
      (created.object.metadata as ProviderObject)?.accelerate_action_id !== actionId ||
      created.object.status !== "draft" ||
      created.object.auto_advance !== false ||
      created.object.customer !== input.customerId
    )
      throw new Error("Draft invoice differs from this reviewed operation");
    const invoiceId = idSchema.parse(created.object.id);
    await checkpointActionResult(
      db,
      actionId,
      receipt(created.object, created.requestId, "not_requested", false),
    );
    const linesBody = new URLSearchParams();
    input.lines.forEach((line, index) => {
      linesBody.set(
        `lines[${index}][description]`,
        `${line.description} (${line.quantity} × ${(line.unitAmount / 100).toFixed(2)} ${input.currency.toUpperCase()})`,
      );
      linesBody.set(`lines[${index}][amount]`, String(line.quantity * line.unitAmount));
    });
    const populated = await client.invoiceOperation(
      invoiceId,
      "add_lines",
      linesBody,
      `${key}:lines`,
    );
    validateOwnedInvoice(populated.object, client.tenantId, client.mode);
    if (
      populated.object.total !== total ||
      populated.object.currency !== input.currency ||
      populated.object.status !== "draft" ||
      populated.object.auto_advance !== false
    )
      throw new Error("Stripe draft totals or state differ from the reviewed invoice");
    return receipt(populated.object, populated.requestId, "not_requested", true);
  }
  const invoiceId = idSchema.parse(raw.invoiceId);
  const current = await client.invoice(invoiceId);
  validateOwnedInvoice(current.object, client.tenantId, client.mode);
  if (
    invoiceFingerprint(current.object) !== raw.fingerprint ||
    !["draft", "open"].includes(String(current.object.status)) ||
    current.object.collection_method !== "send_invoice" ||
    current.object.auto_advance !== false
  )
    throw new Error("Invoice changed after review; inspect it and request fresh sending approval");
  await checkpointActionResult(
    db,
    actionId,
    receipt(current.object, current.requestId, "not_requested", false),
  );
  if (current.object.status === "draft") {
    const finalized = await client.invoiceOperation(
      invoiceId,
      "finalize",
      new URLSearchParams({ auto_advance: "false" }),
      `${key}:finalize`,
    );
    validateOwnedInvoice(finalized.object, client.tenantId, client.mode);
    if (
      finalized.object.status !== "open" ||
      invoiceFingerprint(finalized.object) !== raw.fingerprint
    )
      throw new Error("Finalized invoice differs from the approved send");
    await checkpointActionResult(
      db,
      actionId,
      receipt(finalized.object, finalized.requestId, "not_requested", false),
    );
  }
  const sent = await client.invoiceOperation(
    invoiceId,
    "send",
    new URLSearchParams(),
    `${key}:send`,
  );
  validateOwnedInvoice(sent.object, client.tenantId, client.mode);
  return receipt(
    sent.object,
    sent.requestId,
    client.mode === "test" ? "not_sent_test_mode" : "requested",
    true,
  );
}
export async function readStripeInvoiceForAction(db: SupabaseClient, creationActionId: string) {
  const client = await tenantStripeClient(db);
  const { data, error } = await db
    .from("action_queue")
    .select("id,result,payload,status")
    .eq("id", creationActionId)
    .eq("action_type", "create_stripe_invoice_draft")
    .maybeSingle();
  if (error || !data || !data.result?.invoiceId)
    throw new Error("No recorded Stripe invoice exists for this operation");
  if (
    data.payload?.accountId !== client.accountId ||
    data.payload?.testMode !== (client.mode === "test")
  )
    throw new Error("This invoice belongs to a different Stripe connection");
  const result = await client.invoice(idSchema.parse(data.result.invoiceId));
  validateOwnedInvoice(result.object, client.tenantId, client.mode);
  if ((result.object.metadata as ProviderObject)?.accelerate_action_id !== creationActionId)
    throw new Error("Invoice operation identity mismatch");
  return {
    client,
    creation: data,
    invoice: result.object,
    receipt: receipt(
      result.object,
      result.requestId,
      "not_requested",
      Boolean(data.result.complete),
    ),
  };
}
export async function proposeStripeInvoiceSend(
  db: SupabaseClient,
  creationActionId: string,
  actorEmail: string,
) {
  const { client, invoice, creation } = await readStripeInvoiceForAction(db, creationActionId);
  if (
    creation.status !== "executed" ||
    !creation.result?.complete ||
    invoice.total !== creation.payload?.total
  )
    throw new Error("Complete and reconcile the invoice draft before requesting sending approval");
  if (
    !["draft", "open"].includes(String(invoice.status)) ||
    typeof invoice.customer_email !== "string" ||
    !z.email().safeParse(invoice.customer_email).success
  )
    throw new Error("This invoice is not ready for sending");
  const fingerprint = invoiceFingerprint(invoice);
  const dedupeKey = `stripe-send:${invoice.id}:${fingerprint}`;
  const { data: prior, error } = await db
    .from("action_queue")
    .select("*")
    .eq("source_context", "plugin")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  if (error) throw new Error("Invoice send history could not be read");
  if (prior) return prior;
  return proposeAction(db, {
    actionType: "send_stripe_invoice",
    title: `Send invoice to ${invoice.customer_email}`,
    description: `${String(invoice.currency).toUpperCase()} ${(Number(invoice.amount_due) / 100).toFixed(2)}. ${client.mode === "test" ? "Stripe test mode: no customer email will be delivered." : "Stripe will be asked to email this invoice to the customer."}`,
    payload: {
      invoiceId: invoice.id,
      fingerprint,
      credentialVersion: client.credentialVersion,
      accountId: client.accountId,
      testMode: client.mode === "test",
      pluginOrigin: { id: "stripe-invoicing" },
    },
    sourceContext: "plugin",
    dedupeKey,
    proposedBy: actorEmail,
    expiresAt: new Date(Date.now() + 20 * 3600000).toISOString(),
  });
}
