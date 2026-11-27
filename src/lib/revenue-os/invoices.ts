import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import { encryptTenantSecret, decryptTenantSecret } from "./encryption";
import { isModuleEnabled } from "./modules";
import { readWorkspaceBrand } from "./branding";
import { recordAudit } from "./audit";
import { tenantStripeClient } from "./stripe-adapter";
import {
  INVOICE_PAYMENT_METHODS,
  invoiceCommandSchema,
  invoiceLinkTokenSchema,
  invoicePath,
  type InvoiceRecord,
  type InvoiceStatus,
} from "./invoice-contract";

/**
 * Invoices are owned by this workspace. Stripe is only the payment rail: an
 * issued invoice gets exactly one PaymentIntent, which the customer pays on our
 * own invoice page. No Stripe Invoice, invoice item, coupon, Billing object or
 * post-payment invoice is ever created, so Stripe's Invoicing fee never applies.
 */
type Row = {
  id: string;
  tenant_id: string;
  number: string | null;
  contact_id: string | null;
  customer_name: string;
  customer_email: string;
  currency: "usd";
  lines: InvoiceRecord["lines"];
  total_cents: number;
  amount_paid_cents: number;
  refunded_cents: number;
  memo: string;
  due_date: string | null;
  payment_methods: InvoiceRecord["paymentMethods"];
  status: InvoiceStatus;
  stripe_account_id: string | null;
  livemode: boolean | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  encrypted_link_token: string | null;
  issued_at: string | null;
  paid_at: string | null;
  voided_at: string | null;
  external_payment_note: string;
  revision: number;
  created_at: string;
};
type ProviderObject = Record<string, unknown>;
const PAYABLE = ["requires_payment_method", "requires_confirmation", "requires_action"];
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

function tenantOf(db: SupabaseClient) {
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("Invoicing requires a tenant-bound host");
  return tenantId;
}
export async function requireInvoicing(db: SupabaseClient) {
  const tenantId = tenantOf(db);
  const { data, error } = await db
    .from("tenants")
    .select("config,status,slug")
    .eq("id", tenantId)
    .maybeSingle();
  if (error || !data || data.status !== "active" || !isModuleEnabled("invoicing", data.config))
    throw new Error("Invoicing is disabled or the workspace is unavailable");
  return { tenantId, tenantSlug: data.slug as string };
}
async function rpc(db: SupabaseClient, name: string, args: Record<string, unknown>) {
  const { data, error } = await db.rpc(name, args);
  if (error || !data) throw new Error(error?.message || "The invoice could not be saved");
  return data as Row;
}
function linkToken(row: Row) {
  return row.encrypted_link_token
    ? decryptTenantSecret(row.encrypted_link_token, row.tenant_id, "invoices", "link_token")
    : null;
}
function toRecord(row: Row, tenantSlug: string): InvoiceRecord {
  const token = row.status === "void" ? null : linkToken(row);
  return {
    id: row.id,
    number: row.number,
    contactId: row.contact_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    currency: "usd",
    lines: row.lines,
    totalCents: row.total_cents,
    amountPaidCents: row.amount_paid_cents,
    refundedCents: row.refunded_cents,
    memo: row.memo,
    dueDate: row.due_date,
    paymentMethods: row.payment_methods,
    status: row.status,
    testMode: row.livemode === null ? null : !row.livemode,
    issuedAt: row.issued_at,
    paidAt: row.paid_at,
    voidedAt: row.voided_at,
    externalPaymentNote: row.external_payment_note,
    revision: row.revision,
    createdAt: row.created_at,
    shareUrl: token ? invoicePath(tenantSlug, token) : null,
  };
}
async function readRow(db: SupabaseClient, id: string) {
  const { data, error } = await db
    .from("invoices")
    .select("*")
    .eq("tenant_id", tenantOf(db))
    .eq("id", z.uuid().parse(id))
    .maybeSingle();
  if (error) throw new Error("The invoice could not be read");
  if (!data) throw new Error("Invoice not found");
  return data as Row;
}

export async function listInvoices(db: SupabaseClient, options: { contactId?: string } = {}) {
  const { tenantSlug } = await requireInvoicing(db);
  const linkedId = options.contactId ? z.uuid().parse(options.contactId) : null;
  const [{ data, error }, contacts, stripe] = await Promise.all([
    db
      .from("invoices")
      .select("*")
      .eq("tenant_id", tenantOf(db))
      .order("created_at", { ascending: false })
      .limit(200),
    db
      .from("contacts")
      .select("id,full_name,primary_email")
      .not("primary_email", "is", null)
      .order("full_name")
      .limit(500),
    tenantStripeClient(db).then(
      (client) => ({ connected: true, testMode: client.mode === "test", canTakePayments: Boolean(client.publishableKey && client.webhookSecret) }),
      () => ({ connected: false, testMode: false, canTakePayments: false }),
    ),
  ]);
  if (error || contacts.error) throw new Error("Invoices could not be read");
  type Contact = { id: string; full_name: string; primary_email: string };
  let choices = (contacts.data ?? []) as Contact[];
  // A contact chosen from another page (e.g. a won deal) always stays selectable.
  if (linkedId && !choices.some((c) => c.id === linkedId)) {
    const { data: linked } = await db
      .from("contacts")
      .select("id,full_name,primary_email")
      .eq("id", linkedId)
      .maybeSingle();
    if (!linked || !z.email().safeParse(linked.primary_email).success)
      throw new Error("Customer billing identity is unavailable");
    choices = [linked as Contact, ...choices];
  }
  return {
    invoices: ((data ?? []) as Row[]).map((row) => toRecord(row, tenantSlug)),
    contacts: choices,
    stripe,
  };
}

/** Creates the PaymentIntent for an issued invoice. Bank transfer (ACH) costs
 * 0.8% capped at $5; card follows the account's card rate. Nothing else. */
async function createIntent(db: SupabaseClient, row: Row) {
  const client = await tenantStripeClient(db);
  const brand = await readWorkspaceBrand(db).catch(() => null);
  const body = new URLSearchParams({
    amount: String(row.total_cents),
    currency: "usd",
    receipt_email: row.customer_email,
    description: `${brand?.brand.name ? `${brand.brand.name} ` : ""}invoice for ${row.customer_name}`.slice(0, 1000),
    "metadata[accelerate_purpose]": "invoice",
    "metadata[accelerate_tenant_id]": row.tenant_id,
    "metadata[accelerate_invoice_id]": row.id,
  });
  row.payment_methods
    .filter((method) => (INVOICE_PAYMENT_METHODS as readonly string[]).includes(method))
    .forEach((method, index) => body.set(`payment_method_types[${index}]`, method));
  if (row.payment_methods.includes("us_bank_account"))
    body.set("payment_method_options[us_bank_account][verification_method]", "automatic");
  const { object: intent } = await client.createPaymentIntent(
    body,
    `accelerate-invoice:${row.tenant_id}:${row.id}`,
  );
  if (
    typeof intent.id !== "string" ||
    !/^pi_[A-Za-z0-9_]+$/.test(intent.id) ||
    intent.amount !== row.total_cents ||
    intent.currency !== "usd" ||
    (intent.metadata as ProviderObject)?.accelerate_invoice_id !== row.id ||
    intent.livemode !== (client.mode === "live")
  )
    throw new Error("Stripe returned a payment that does not match this invoice. Retry issuing.");
  return { client, intent };
}

export async function runInvoiceCommand(db: SupabaseClient, raw: unknown, actorEmail: string) {
  const command = invoiceCommandSchema.parse(raw);
  const { tenantId, tenantSlug } = await requireInvoicing(db);
  const actor = z.email().parse(actorEmail);
  let row: Row;
  if (command.operation === "save_draft") {
    if (command.draft.contactId) {
      const { data } = await db
        .from("contacts")
        .select("id")
        .eq("id", command.draft.contactId)
        .maybeSingle();
      if (!data) throw new Error("Choose a contact from this workspace");
    }
    row = await rpc(db, "save_invoice_draft", {
      p_id: command.id,
      p_revision: command.revision,
      p_draft: command.draft,
      p_actor: actor,
    });
    await recordAudit(db, {
      actorEmail: actor,
      action: command.id ? "invoice.draft_updated" : "invoice.draft_created",
      entityType: "invoice",
      entityId: row.id,
    });
  } else if (command.operation === "issue") {
    const current = await readRow(db, command.id);
    if (current.status !== "draft") return { invoice: toRecord(current, tenantSlug) };
    if (current.revision !== command.revision)
      throw new Error("This draft changed. Reload it before issuing.");
    const { client, intent } = await createIntent(db, current);
    if (!PAYABLE.includes(String(intent.status)))
      throw new Error("Stripe did not open this payment. Check the Stripe connection and retry.");
    const token = randomBytes(32).toString("base64url");
    row = await rpc(db, "issue_invoice", {
      p_id: current.id,
      p_intent: intent.id,
      p_account: client.accountId,
      p_livemode: client.mode === "live",
      p_link_hash: hash(token),
      p_encrypted_link: encryptTenantSecret(token, tenantId, "invoices", "link_token"),
    });
    await recordAudit(db, {
      actorEmail: actor,
      action: "invoice.issued",
      entityType: "invoice",
      entityId: row.id,
      after: { number: row.number, totalCents: row.total_cents, paymentIntent: intent.id },
    });
  } else if (command.operation === "void" || command.operation === "record_external_payment") {
    const current = await readRow(db, command.id);
    if (current.stripe_payment_intent_id && ["open"].includes(current.status)) {
      const client = await tenantStripeClient(db);
      const { object: intent } = await client.paymentIntent(current.stripe_payment_intent_id);
      if (intent.status === "processing" || intent.status === "succeeded") {
        await syncInvoicePayment(db, current, `refresh:${Date.now()}`);
        throw new Error("A payment already started for this invoice. Reload to see it.");
      }
      if (intent.status !== "canceled")
        await client.cancelPaymentIntent(
          current.stripe_payment_intent_id,
          `accelerate-invoice-cancel:${current.tenant_id}:${current.id}`,
        );
    }
    row = await rpc(db, "close_invoice", {
      p_id: current.id,
      p_revision: command.revision,
      p_outcome: command.operation === "void" ? "void" : "paid_external",
      p_note: command.operation === "void" ? "" : command.note,
    });
    await recordAudit(db, {
      actorEmail: actor,
      action: command.operation === "void" ? "invoice.voided" : "invoice.paid_externally",
      entityType: "invoice",
      entityId: row.id,
    });
  } else {
    row = await syncInvoicePayment(db, await readRow(db, command.id), `refresh:${Date.now()}`);
  }
  return { invoice: toRecord(row, tenantSlug) };
}

/** Reads the PaymentIntent from Stripe (never trusting a webhook body) and
 * applies it. Bank transfers pass through "processing" for a few days. */
export async function syncInvoicePayment(db: SupabaseClient, row: Row, externalId: string) {
  if (!row.stripe_payment_intent_id || !row.stripe_account_id) return row;
  const client = await tenantStripeClient(db);
  if (client.accountId !== row.stripe_account_id || (client.mode === "live") !== row.livemode)
    throw new Error("The Stripe connection changed since this invoice was issued");
  const { object: intent } = await client.paymentIntent(row.stripe_payment_intent_id, true);
  const metadata = (intent.metadata ?? {}) as ProviderObject;
  if (
    intent.amount !== row.total_cents ||
    intent.currency !== "usd" ||
    metadata.accelerate_invoice_id !== row.id ||
    metadata.accelerate_tenant_id !== row.tenant_id
  )
    throw new Error("Stripe payment does not match this invoice");
  const charge =
    intent.latest_charge && typeof intent.latest_charge === "object"
      ? (intent.latest_charge as ProviderObject)
      : null;
  if (
    intent.status === "succeeded" &&
    (intent.amount_received !== row.total_cents || !charge?.paid || charge.amount !== row.total_cents)
  )
    throw new Error("Stripe has not confirmed the full payment for this invoice");
  return rpc(db, "observe_invoice_payment", {
    p_id: row.id,
    p_external_id: `${externalId}:${intent.status}:${charge?.amount_refunded ?? 0}`,
    p_observation: {
      intent_id: intent.id,
      account_id: client.accountId,
      livemode: intent.livemode,
      intent_status: intent.status,
      amount_received: intent.amount_received,
      charge_id: typeof charge?.id === "string" ? charge.id : null,
      refunded_cents: typeof charge?.amount_refunded === "number" ? charge.amount_refunded : 0,
      paid_at:
        intent.status === "succeeded" && typeof charge?.created === "number"
          ? new Date(charge.created * 1000).toISOString()
          : null,
    },
  });
}

/** Stripe webhook entry: payment_intent.* and charge.refunded for payments
 * whose metadata names one of this workspace's invoices. */
export async function processInvoiceStripeWebhook(db: SupabaseClient, event: ProviderObject) {
  const type = event.type;
  if (typeof type !== "string" || typeof event.id !== "string" || !/^evt_[A-Za-z0-9_]+$/.test(event.id))
    return { handled: false };
  const handled = [
    "payment_intent.succeeded",
    "payment_intent.processing",
    "payment_intent.payment_failed",
    "payment_intent.canceled",
    "charge.refunded",
  ];
  if (!handled.includes(type)) return { handled: false };
  const value = ((event.data as ProviderObject)?.object ?? {}) as ProviderObject;
  const metadata = (value.metadata ?? {}) as ProviderObject;
  if (metadata.accelerate_purpose !== "invoice") return { handled: false };
  if (metadata.accelerate_tenant_id !== tenantOf(db))
    throw new Error("Invoice payment belongs to another workspace");
  const row = await readRow(db, z.uuid().parse(metadata.accelerate_invoice_id));
  if (event.livemode !== row.livemode) throw new Error("Invoice payment mode mismatch");
  const saved = await syncInvoicePayment(db, row, event.id);
  return { handled: true, state: saved.status };
}

/** Public customer view, addressed only by the unguessable link token. */
export async function readPublicInvoice(db: SupabaseClient, token: string) {
  await requireInvoicing(db);
  invoiceLinkTokenSchema.parse(token);
  const { data, error } = await db
    .from("invoices")
    .select("*")
    .eq("tenant_id", tenantOf(db))
    .eq("link_token_hash", hash(token))
    .neq("status", "void")
    .neq("status", "draft")
    .maybeSingle();
  if (error || !data) throw new Error("Invoice unavailable");
  let row = data as Row;
  if (row.status === "open" || row.status === "processing")
    row = await syncInvoicePayment(db, row, `view:${Math.floor(Date.now() / 60000)}`).catch(
      () => row,
    );
  const { brand } = await readWorkspaceBrand(db);
  return { invoice: row, brand };
}

/** Client secret for the Stripe Payment Element on our invoice page. */
export async function invoicePaymentDetails(db: SupabaseClient, token: string) {
  const { invoice } = await readPublicInvoice(db, token);
  if (invoice.status !== "open") return { status: invoice.status };
  const client = await tenantStripeClient(db);
  if (!client.publishableKey) throw new Error("Online payment is not configured for this workspace");
  const { object: intent } = await client.paymentIntent(invoice.stripe_payment_intent_id!);
  if (
    intent.amount !== invoice.total_cents ||
    (intent.metadata as ProviderObject)?.accelerate_invoice_id !== invoice.id ||
    !PAYABLE.includes(String(intent.status)) ||
    typeof intent.client_secret !== "string"
  )
    return { status: intent.status === "processing" ? "processing" : invoice.status };
  return {
    status: "open" as const,
    clientSecret: intent.client_secret,
    publishableKey: client.publishableKey,
    totalCents: invoice.total_cents,
    email: invoice.customer_email,
    name: invoice.customer_name,
  };
}

/** Collections read our own invoices: open and past due means overdue. */
export async function overdueInvoices(db: SupabaseClient) {
  await requireInvoicing(db);
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await db
    .from("invoices")
    .select("id,number,contact_id,customer_name,customer_email,total_cents,due_date,status")
    .eq("tenant_id", tenantOf(db))
    .eq("status", "open")
    .lt("due_date", today)
    .order("due_date")
    .limit(200);
  if (error) throw new Error("Overdue invoices could not be read");
  return data ?? [];
}
