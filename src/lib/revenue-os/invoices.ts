import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import { encryptTenantSecret, decryptTenantSecret } from "./encryption";
import { isModuleEnabled } from "./modules";
import { readWorkspaceBrand } from "./branding";
import { recordAudit } from "./audit";
import { proposeAction } from "./actions";
import { assertCurrentTenantAdmin } from "./tenant-admin-authority";
import { tenantStripeClient } from "./stripe-adapter";
import {
  INVOICE_PAYMENT_METHODS,
  invoiceLinkTokenSchema,
  invoicePath,
  type CommercialInvoice,
  type InvoiceDraft,
  type InvoiceStatus,
} from "@/lib/invoices/schema";
import { invoiceCommandSchema } from "@/lib/invoices/commands";
import { invoiceBrand } from "@/lib/invoices/brand";

/**
 * Invoices are owned by this workspace. Stripe is only the payment rail: an
 * issued invoice gets exactly one PaymentIntent, which the customer pays on our
 * own invoice page. No Stripe Invoice, invoice item, coupon, Billing object or
 * post-payment invoice is ever created, so Stripe's Invoicing fee never applies.
 */
export type InvoiceRow = InvoiceDraft & {
  id: string;
  tenant_id: string;
  number: string | null;
  currency: "usd";
  amount_cents: number;
  amount_paid_cents: number;
  refunded_cents: number;
  status: InvoiceStatus;
  stripe_account_id: string | null;
  livemode: boolean | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  encrypted_link_token: string | null;
  issued_at: string | null;
  due_at: string | null;
  paid_at: string | null;
  voided_at: string | null;
  external_payment_note: string;
  revision: number;
  created_at: string;
  updated_at: string;
};
type Row = InvoiceRow;
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
const DRAFT_FIELDS = [
  "contact_id",
  "kind",
  "due_days",
  "invoice_date",
  "due_date",
  "discount_cents",
  "discount_label",
  "company_name",
  "contact_name",
  "contact_email",
  "billing_line1",
  "billing_line2",
  "billing_city",
  "billing_region",
  "billing_postal",
  "billing_country",
  "purchase_order",
  "description",
  "support_details",
  "service_period",
  "notes",
  "tax_review",
  "lines",
  "payment_methods",
] as const;
export function draftOf(row: Row): InvoiceDraft {
  return Object.fromEntries(DRAFT_FIELDS.map((key) => [key, row[key]])) as InvoiceDraft;
}
function toRecord(row: Row, tenantSlug: string): CommercialInvoice {
  const token = row.status === "void" || row.status === "draft" ? null : linkToken(row);
  return {
    ...draftOf(row),
    id: row.id,
    mode: row.livemode === null ? null : row.livemode ? "live" : "test",
    status: row.status,
    amount_cents: row.amount_cents,
    invoice_number: row.number,
    issued_at: row.issued_at,
    due_at: row.due_at,
    paid_at: row.paid_at,
    voided_at: row.voided_at,
    refunded_cents: row.refunded_cents,
    external_payment_note: row.external_payment_note,
    revision: row.revision,
    created_at: row.created_at,
    updated_at: row.updated_at,
    share_url: token ? invoicePath(tenantSlug, token) : null,
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
      (client) => ({
        connected: true,
        testMode: client.mode === "test",
        canTakePayments: Boolean(client.publishableKey),
      }),
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
  const { brand } = await readWorkspaceBrand(db);
  return {
    invoices: ((data ?? []) as Row[]).map((row) => toRecord(row, tenantSlug)),
    contacts: choices,
    stripe,
    brand: invoiceBrand(brand),
  };
}

/** Creates the PaymentIntent for an issued invoice. Bank transfer (ACH) costs
 * 0.8% capped at $5; card follows the account's card rate. Nothing else. */
async function createIntent(db: SupabaseClient, row: Row) {
  const client = await tenantStripeClient(db);
  const brand = await readWorkspaceBrand(db).catch((error: unknown) => {
    console.warn(
      "[invoicing] Brand unavailable for payment description",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
  });
  const body = new URLSearchParams({
    amount: String(row.amount_cents),
    currency: "usd",
    receipt_email: row.contact_email,
    description:
      `${brand?.brand.name ? `${brand.brand.name} ` : ""}invoice ${row.description} for ${row.company_name}`.slice(
        0,
        1000,
      ),
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
    intent.amount !== row.amount_cents ||
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
    if (command.draft.contact_id) {
      const { data } = await db
        .from("contacts")
        .select("id")
        .eq("id", command.draft.contact_id)
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
      after: { number: row.number, amountCents: row.amount_cents, paymentIntent: intent.id },
    });
  } else if (command.operation === "delete_draft") {
    const current = await readRow(db, command.id);
    if (current.status !== "draft" || current.revision !== command.revision)
      throw new Error("Only an unchanged draft can be deleted. Reload it first.");
    row = await rpc(db, "close_invoice", {
      p_id: current.id,
      p_revision: command.revision,
      p_outcome: "void",
      p_note: "",
    });
    await recordAudit(db, {
      actorEmail: actor,
      action: "invoice.draft_deleted",
      entityType: "invoice",
      entityId: row.id,
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
    intent.amount !== row.amount_cents ||
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
    (intent.amount_received !== row.amount_cents ||
      !charge?.paid ||
      charge.amount !== row.amount_cents)
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
  if (
    typeof type !== "string" ||
    typeof event.id !== "string" ||
    !/^evt_[A-Za-z0-9_]+$/.test(event.id)
  )
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
  return { invoice: toRecord(row, ""), row, brand: invoiceBrand(brand) };
}

/** Client secret for the Stripe Payment Element on our invoice page. */
export async function invoicePaymentDetails(db: SupabaseClient, token: string) {
  const { row: invoice } = await readPublicInvoice(db, token);
  if (invoice.status !== "open") return { status: invoice.status };
  const client = await tenantStripeClient(db);
  if (!client.publishableKey)
    throw new Error("Online payment is not configured for this workspace");
  const { object: intent } = await client.paymentIntent(invoice.stripe_payment_intent_id!);
  if (
    intent.amount !== invoice.amount_cents ||
    (intent.metadata as ProviderObject)?.accelerate_invoice_id !== invoice.id ||
    !PAYABLE.includes(String(intent.status)) ||
    typeof intent.client_secret !== "string"
  )
    return { status: intent.status === "processing" ? "processing" : invoice.status };
  return {
    status: "open" as const,
    clientSecret: intent.client_secret,
    publishableKey: client.publishableKey,
    amountCents: invoice.amount_cents,
    email: invoice.contact_email,
  };
}

/** Collections read our own invoices: open and past due means overdue. */
export async function overdueInvoices(db: SupabaseClient) {
  await requireInvoicing(db);
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await db
    .from("invoices")
    .select("id,number,contact_id,company_name,contact_email,amount_cents,due_at,status")
    .eq("tenant_id", tenantOf(db))
    .eq("status", "open")
    .lt("due_at", today)
    .order("due_at")
    .limit(200);
  if (error) throw new Error("Overdue invoices could not be read");
  return data ?? [];
}

/** The customer's downloadable record, drawn from the same figures as the page. */
export async function invoicePdf(db: SupabaseClient, token: string) {
  const { invoice, brand } = await readPublicInvoice(db, token);
  const { renderInvoicePdf } = await import("@/lib/invoices/pdf.server");
  let logo: Uint8Array | null = null;
  if (/^https:\/\//.test(brand.mark) && brand.mark.endsWith(".png")) {
    try {
      const response = await fetch(brand.mark, { signal: AbortSignal.timeout(4000) });
      if (response.ok) logo = new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      console.warn(
        "[invoicing] Invoice logo unavailable; rendering without it",
        error instanceof Error ? error.name : "unknown",
      );
      logo = null;
    }
  }
  const bytes = await renderInvoicePdf(invoice, brand, logo);
  return {
    bytes,
    filename: `invoice-${(invoice.invoice_number || "draft").replace(/[^A-Za-z0-9_-]/g, "")}.pdf`,
  };
}

/** Assistant-initiated invoice changes are staged for exact human approval.
 * Payment refresh is a read and runs directly; every other command waits. */
const approvableInvoiceCommand = invoiceCommandSchema.refine(
  (command) => command.operation !== "refresh_payment",
  "Payment refresh does not need approval",
);

function invoiceProposalTitle(command: z.output<typeof invoiceCommandSchema>) {
  switch (command.operation) {
    case "save_draft":
      return command.id
        ? `Update invoice draft for ${command.draft.company_name || "customer"}`
        : `Create invoice draft for ${command.draft.company_name || "customer"}`;
    case "issue":
      return "Issue invoice and open its payment link";
    case "void":
      return "Void invoice";
    case "delete_draft":
      return "Delete invoice draft";
    case "record_external_payment":
      return "Mark invoice as paid outside Stripe";
    default:
      return "Invoice change";
  }
}

export async function proposeInvoiceCommand(db: SupabaseClient, raw: unknown, actorEmail: string) {
  const command = approvableInvoiceCommand.parse(raw);
  await assertCurrentTenantAdmin(db, actorEmail);
  await requireInvoicing(db);
  const digest = createHash("sha256").update(JSON.stringify(command)).digest("hex").slice(0, 32);
  const action = await proposeAction(db, {
    actionType: "invoice_change",
    title: invoiceProposalTitle(command),
    description:
      command.operation === "issue"
        ? "Assign the invoice number and open its private payment link. No email is sent and no money moves until the customer pays."
        : "Apply this exact invoice change after checking the invoice's current revision.",
    payload: command,
    sourceContext: "The assistant prepared this invoice change for administrator approval.",
    proposedBy: actorEmail,
    explicit: true,
    expiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
    dedupeKey: `invoice:${digest}`,
  });
  if (!action) throw new Error("The invoice change could not be staged for approval");
  return action;
}

export async function executeApprovedInvoiceCommand(
  db: SupabaseClient,
  payload: unknown,
  actorEmail: string,
) {
  const command = approvableInvoiceCommand.parse(payload);
  return runInvoiceCommand(db, command, actorEmail);
}

/** Bounded, id-ordered invoice summaries for the workspace graph. Reads only
 * this workspace's rows through the tenant-bound client; never calls Stripe. */
export async function listInvoiceGraphRows(
  db: SupabaseClient,
  options: {
    ids?: string[];
    afterId?: string;
    limit: number;
    contactId?: string;
    statuses?: readonly string[];
  },
) {
  let query = db
    .from("invoices")
    .select("id,number,company_name,status,amount_cents,contact_id,due_at")
    .order("id", { ascending: true });
  if (options.contactId) query = query.eq("contact_id", options.contactId);
  if (options.ids) query = query.in("id", options.ids);
  else if (options.afterId) query = query.gt("id", options.afterId);
  if (options.statuses) query = query.in("status", [...options.statuses]);
  const { data, error } = await query.limit(Math.max(1, Math.min(options.limit, 201)));
  if (error) throw new Error("Invoices could not be read");
  return (data ?? []) as {
    id: string;
    number: string | null;
    company_name: string;
    status: string;
    amount_cents: number;
    contact_id: string | null;
    due_at: string | null;
  }[];
}
