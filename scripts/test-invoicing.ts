/**
 * Workspace-owned invoicing: invoices live in our database and Stripe is only a
 * payment rail. Proves that no Stripe Invoice, invoice item or Billing endpoint
 * is ever called, that issuing creates exactly one PaymentIntent with our
 * metadata, and that webhook/refresh reconciliation reads Stripe before marking
 * an invoice paid. The SQL functions themselves are covered by
 * scripts/test-invoicing-postgres.mjs.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { AuthorizedMemorySupabase } from "./lib/autonomy-fixture";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import { encryptTenantSecret } from "../src/lib/revenue-os/encryption";
import {
  listInvoices,
  runInvoiceCommand,
  processInvoiceStripeWebhook,
  invoicePaymentDetails,
} from "../src/lib/revenue-os/invoices";
import { emptyInvoiceDraft, invoiceDraftSchema } from "../src/lib/invoices/schema";

type Row = Record<string, unknown>;
async function main() {
  // Contract checks (schema ported from SuperDebate)
  const base = {
    ...emptyInvoiceDraft(),
    company_name: "A",
    contact_name: "A",
    contact_email: "a@example.example",
    description: "Work",
  };
  assert.equal(
    invoiceDraftSchema.safeParse({
      ...base,
      lines: [{ description: "x", quantity: 1, unit_cents: 10 }],
    }).success,
    false,
    "amounts under $0.50 are refused",
  );
  assert.equal(
    invoiceDraftSchema.safeParse({
      ...base,
      lines: [{ description: "x", quantity: 1, unit_cents: 1000 }],
      discount_cents: 500,
      notes: "20% discount",
    }).success,
    false,
    "a typed percentage must match the real discount",
  );

  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "controlled-invoice-fixture-key-not-a-provider-secret";
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const contactId = "22222222-2222-4222-8222-222222222222";
  const enc = (value: string, key: string) => encryptTenantSecret(value, tenantId, "stripe", key);
  const mem = new AuthorizedMemorySupabase({
    tenants: [
      {
        id: tenantId,
        slug: "fixture",
        name: "Fixture business",
        status: "active",
        config: { modules: { invoicing: true } },
      },
    ],
    contacts: [
      {
        id: contactId,
        tenant_id: tenantId,
        full_name: "Example Customer",
        primary_email: "billing@example.example",
      },
    ],
    integration_connections: [
      {
        id: "connection",
        tenant_id: tenantId,
        provider: "stripe",
        status: "connected",
        credential_version: 1,
        account_email: "acct_fixture",
        encrypted_credentials: {
          api_key: enc("rk_test_fixture0000000000", "api_key"),
          publishable_key: enc("pk_test_fixture0000000000", "publishable_key"),
          webhook_secret: enc("whsec_fixture000000", "webhook_secret"),
        },
      },
    ],
    invoices: [],
    invoice_payment_receipts: [],
    audit_log: [],
  });
  const invoices = () => mem.rows("invoices");
  // Happy-path stand-ins for the SQL functions (atomicity is proven in Postgres).
  let counter = 0;
  mem.rpc("save_invoice_draft", ({ p_id, p_draft, p_actor }) => {
    const draft = p_draft as Row & {
      lines: { quantity: number; unit_cents: number }[];
      discount_cents: number;
    };
    const amount =
      draft.lines.reduce((n, l) => n + l.quantity * l.unit_cents, 0) - draft.discount_cents;
    const fields = {
      ...draft,
      contact_email: String(draft.contact_email).toLowerCase(),
      amount_cents: amount,
    };
    if (p_id) {
      const row = invoices().find((r) => r.id === p_id)!;
      Object.assign(row, fields, { revision: Number(row.revision) + 1 });
      return row;
    }
    const row = {
      ...fields,
      id: randomUUID(),
      tenant_id: tenantId,
      number: null,
      currency: "usd",
      amount_paid_cents: 0,
      refunded_cents: 0,
      status: "draft",
      stripe_account_id: null,
      livemode: null,
      stripe_payment_intent_id: null,
      stripe_charge_id: null,
      encrypted_link_token: null,
      link_token_hash: null,
      issued_at: null,
      due_at: null,
      paid_at: null,
      voided_at: null,
      external_payment_note: "",
      created_by: p_actor,
      revision: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    invoices().push(row);
    return row;
  });
  mem.rpc(
    "issue_invoice",
    ({ p_id, p_intent, p_account, p_livemode, p_link_hash, p_encrypted_link }) => {
      const row = invoices().find((r) => r.id === p_id)!;
      if (row.status !== "draft") return row;
      counter++;
      Object.assign(row, {
        status: "open",
        number: `INV-${String(counter).padStart(4, "0")}`,
        issued_at: new Date().toISOString(),
        stripe_payment_intent_id: p_intent,
        stripe_account_id: p_account,
        livemode: p_livemode,
        link_token_hash: p_link_hash,
        encrypted_link_token: p_encrypted_link,
        revision: Number(row.revision) + 1,
      });
      return row;
    },
  );
  mem.rpc("observe_invoice_payment", ({ p_id, p_external_id, p_observation }) => {
    const row = invoices().find((r) => r.id === p_id)!;
    const o = p_observation as Row;
    if (mem.rows("invoice_payment_receipts").some((r) => r.external_id === p_external_id))
      return row;
    mem.rows("invoice_payment_receipts").push({
      id: randomUUID(),
      tenant_id: tenantId,
      invoice_id: row.id,
      external_id: p_external_id,
      observation: o,
    });
    if (!["paid", "paid_external", "void"].includes(String(row.status)))
      row.status =
        o.intent_status === "succeeded"
          ? "paid"
          : o.intent_status === "processing"
            ? "processing"
            : "open";
    if (row.status === "paid")
      Object.assign(row, { amount_paid_cents: row.amount_cents, paid_at: o.paid_at });
    return row;
  });
  mem.rpc("close_invoice", ({ p_id, p_outcome, p_note }) => {
    const row = invoices().find((r) => r.id === p_id)!;
    Object.assign(row, { status: p_outcome, external_payment_note: p_note ?? "" });
    return row;
  });

  const db = bindTenantDatabase(mem.client as never, tenantId, true);
  const originalFetch = globalThis.fetch;
  const calls: { path: string; method: string; body: URLSearchParams }[] = [];
  let intent: Row | null = null;
  globalThis.fetch = async (url, init) => {
    const parsed = new URL(String(url));
    assert.equal(parsed.origin, "https://api.stripe.com");
    // The point of this whole design: Stripe's invoice product is never touched.
    assert.doesNotMatch(parsed.pathname, /invoice|subscription|coupon|billing/i);
    const method = init?.method ?? "GET";
    const body = new URLSearchParams(String(init?.body ?? ""));
    calls.push({ path: parsed.pathname, method, body });
    const respond = (value: unknown) =>
      new Response(JSON.stringify(value), {
        status: 200,
        headers: { "Content-Type": "application/json", "Request-Id": "req_fixture" },
      });
    if (parsed.pathname === "/v1/payment_intents" && method === "POST") {
      intent = {
        id: "pi_fixture",
        object: "payment_intent",
        amount: Number(body.get("amount")),
        amount_received: 0,
        currency: body.get("currency"),
        status: "requires_payment_method",
        livemode: false,
        client_secret: "pi_fixture_secret_abc",
        metadata: {
          accelerate_purpose: body.get("metadata[accelerate_purpose]"),
          accelerate_tenant_id: body.get("metadata[accelerate_tenant_id]"),
          accelerate_invoice_id: body.get("metadata[accelerate_invoice_id]"),
        },
        latest_charge: null,
      };
      return respond(intent);
    }
    if (parsed.pathname === "/v1/payment_intents/pi_fixture/cancel") {
      intent = { ...intent!, status: "canceled" };
      return respond(intent);
    }
    if (parsed.pathname === "/v1/payment_intents/pi_fixture") return respond(intent);
    throw new Error(`Unexpected Stripe call ${method} ${parsed.pathname}`);
  };
  try {
    const actor = "owner@example.example";
    const draft = {
      ...emptyInvoiceDraft(),
      contact_id: contactId,
      company_name: "MLIVM",
      contact_name: "Example Customer",
      contact_email: "Billing@Example.example",
      description: "MLIVM application build",
      lines: [{ description: "Kickoff payment", quantity: 1, unit_cents: 200000 }],
      due_date: "2026-12-11",
    };
    const saved = await runInvoiceCommand(
      db,
      { operation: "save_draft", id: null, revision: null, draft },
      actor,
    );
    assert.equal(saved.invoice.status, "draft");
    assert.equal(saved.invoice.amount_cents, 200000);
    assert.equal(saved.invoice.share_url, null, "drafts have no customer link");
    assert.equal(calls.length, 0, "saving a draft never calls Stripe");

    const issued = await runInvoiceCommand(
      db,
      { operation: "issue", id: saved.invoice.id, revision: 1 },
      actor,
    );
    assert.equal(issued.invoice.status, "open");
    assert.equal(issued.invoice.invoice_number, "INV-0001");
    assert.match(issued.invoice.share_url!, /^\/t\/fixture\/invoice\/[A-Za-z0-9_-]{43}$/);
    const create = calls.find((c) => c.path === "/v1/payment_intents" && c.method === "POST")!;
    assert.equal(create.body.get("amount"), "200000");
    assert.equal(create.body.get("currency"), "usd");
    assert.equal(create.body.get("payment_method_types[0]"), "us_bank_account");
    assert.equal(create.body.get("payment_method_types[1]"), "card");
    assert.equal(create.body.get("metadata[accelerate_invoice_id]"), saved.invoice.id);
    assert.equal(create.body.get("receipt_email"), "billing@example.example");
    assert.equal(
      [...create.body.keys()].some((key) => /invoice_creation|invoice\b|customer$/.test(key)),
      false,
      "no Stripe invoice or post-payment invoice parameters",
    );

    // Re-issuing is idempotent and does not create a second payment.
    await runInvoiceCommand(db, { operation: "issue", id: saved.invoice.id, revision: 2 }, actor);
    assert.equal(
      calls.filter((c) => c.path === "/v1/payment_intents" && c.method === "POST").length,
      1,
    );

    const token = issued.invoice.share_url!.split("/").at(-1)!;
    const details = await invoicePaymentDetails(db, token);
    assert.equal(details.status, "open");
    assert.equal("clientSecret" in details && details.clientSecret, "pi_fixture_secret_abc");

    // Bank transfer submitted: webhook says processing; we read Stripe, not the body.
    intent = { ...intent!, status: "processing" };
    const event = (type: string, id: string) => ({
      id,
      type,
      livemode: false,
      data: { object: { id: "pi_fixture", metadata: intent!.metadata, amount: 1 } },
    });
    const processing = await processInvoiceStripeWebhook(
      db,
      event("payment_intent.processing", "evt_1"),
    );
    assert.deepEqual(processing, { handled: true, state: "processing" });

    // Settled: Stripe confirms full amount with a paid charge.
    intent = {
      ...intent!,
      status: "succeeded",
      amount_received: 200000,
      latest_charge: {
        id: "py_fixture",
        paid: true,
        amount: 200000,
        amount_refunded: 0,
        created: 1764000000,
      },
    };
    const paid = await processInvoiceStripeWebhook(db, event("payment_intent.succeeded", "evt_2"));
    assert.deepEqual(paid, { handled: true, state: "paid" });
    const listing = await listInvoices(db);
    assert.equal(listing.invoices[0]!.status, "paid");
    assert.equal(listing.stripe.canTakePayments, true);

    // Payments for other systems are ignored.
    const foreign = await processInvoiceStripeWebhook(db, {
      id: "evt_3",
      type: "payment_intent.succeeded",
      livemode: false,
      data: { object: { metadata: { accelerate_purpose: "event_ticket" } } },
    });
    assert.deepEqual(foreign, { handled: false });

    // Voiding an unpaid invoice cancels its PaymentIntent.
    const second = await runInvoiceCommand(
      db,
      { operation: "save_draft", id: null, revision: null, draft },
      actor,
    );
    intent = null;
    const secondIssued = await runInvoiceCommand(
      db,
      { operation: "issue", id: second.invoice.id, revision: 1 },
      actor,
    );
    const voided = await runInvoiceCommand(
      db,
      { operation: "void", id: second.invoice.id, revision: secondIssued.invoice.revision },
      actor,
    );
    assert.equal(voided.invoice.status, "void");
    assert.ok(calls.some((c) => c.path === "/v1/payment_intents/pi_fixture/cancel"));
    assert.equal(voided.invoice.share_url, null, "void invoices have no customer link");

    console.log("invoicing: owned invoices, PaymentIntent rail only, webhook reconciliation — ok");
  } finally {
    globalThis.fetch = originalFetch;
  }
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
