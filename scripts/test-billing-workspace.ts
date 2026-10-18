import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createAdminConfigurationFixture } from "./lib/admin-configuration-fixture";
import { runWithTenantRequestContext } from "../src/lib/tenancy/context";
import { encryptTenantSecret } from "../src/lib/revenue-os/encryption";
import {
  previewBillingCommand,
  proposeBillingCommand,
  executeBillingCommand,
  readBillingPayments,
  readBillingInvoices,
} from "../src/lib/revenue-os/billing-workspace";
import { approveAndExecuteAction } from "../src/lib/revenue-os/action-executor";
import { retryPluginAction } from "../src/lib/revenue-os/actions";
import { executeRegisteredRevenueTool } from "../src/lib/revenue-os/ai-tools";
import {
  paymentOverview,
  paymentsCsv,
  type BillingCommand,
  type BillingReceipt,
} from "../src/lib/revenue-os/billing-command-contract";
import { formatInvoiceAmount } from "../src/lib/revenue-os/stripe-contract";
import {
  invoiceIndexPageSchema,
  invoiceOverview,
  loadedInvoices,
  selectInvoices,
  type InvoiceIndexEntry,
} from "../src/lib/revenue-os/invoice-index-contract";

async function main() {
  const f = createAdminConfigurationFixture();
  const encryption = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "controlled-billing-encryption-key-no-provider-access";
  const fallback = globalThis.fetch;
  const contactId = randomUUID();
  const contact = {
    id: contactId,
    tenant_id: f.tenantId,
    full_name: "Example Customer",
    primary_email: "billing@customer.example",
  };
  f.mem.tables.contacts = [contact];
  (f.mem.rows("tenants")[0]!.config as { modules: Record<string, boolean> }).modules = {
    "stripe-invoicing": true,
  };
  f.mem.tables.integration_connections = [];
  f.mem.rows("integration_connections").push({
    tenant_id: f.tenantId,
    provider: "stripe",
    status: "connected",
    account_email: "acct_controlled",
    credential_version: 1,
    encrypted_credentials: {
      api_key: encryptTenantSecret(
        "rk_test_controlledfixture123456789",
        f.tenantId,
        "stripe",
        "api_key",
      ),
    },
  });
  const charge = {
    id: "ch_controlled1",
    amount: 10000,
    amount_captured: 10000,
    amount_refunded: 0,
    currency: "usd",
    status: "succeeded",
    paid: true,
    captured: true,
    disputed: false,
    livemode: false,
    created: 1792320000,
    metadata: { accelerate_tenant_id: f.tenantId },
    billing_details: { name: contact.full_name, email: contact.primary_email },
    description: "Controlled payment",
    receipt_url: "https://pay.stripe.com/receipts/fixture",
    payment_intent: "pi_controlled",
  };
  const invoice = {
    id: "in_controlled1",
    number: "EXAMPLE-1001",
    status: "open",
    currency: "usd",
    amount_due: 10000,
    amount_paid: 0,
    amount_remaining: 10000,
    customer: "cus_controlled1",
    customer_name: contact.full_name,
    customer_email: contact.primary_email,
    livemode: false,
    metadata: { accelerate_tenant_id: f.tenantId },
    created: 1792320000,
    due_date: 1792100000,
    hosted_invoice_url: null,
  };
  const refunds: Record<string, unknown>[] = [];
  const customers: Record<string, unknown>[] = [];
  const writes: { path: string; key: string | null }[] = [];
  let timeoutAfterRefund = false;
  let refundStatus = "succeeded";
  let failReads = false;
  let linkedInvoiceOwner = f.tenantId;
  let incompleteInvoiceLinks = false;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.origin !== "https://api.stripe.com") return fallback(input, init);
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("stripe-version"), "2025-06-30.basil");
    const method = init?.method ?? "GET";
    if (method === "GET" && failReads)
      return Response.json({ error: "controlled unavailable" }, { status: 503 });
    if (method === "GET") {
      if (url.pathname === "/v1/charges") return Response.json({ data: [charge], has_more: false });
      if (url.pathname === "/v1/charges/ch_controlled1") return Response.json(charge);
      if (url.pathname === "/v1/invoices")
        return Response.json({ data: [invoice], has_more: false });
      if (url.pathname === "/v1/invoices/in_controlled1") return Response.json(invoice);
      if (url.pathname === "/v1/invoice_payments") {
        assert.equal(url.searchParams.get("payment[payment_intent]"), charge.payment_intent);
        assert.equal(url.searchParams.get("payment[type]"), "payment_intent");
        assert.equal(url.searchParams.get("expand[]"), "data.invoice");
        return Response.json({
          data: [
            {
              status: "paid",
              livemode: false,
              payment: { type: "payment_intent", payment_intent: charge.payment_intent },
              invoice: {
                id: invoice.id,
                livemode: false,
                metadata: { accelerate_tenant_id: linkedInvoiceOwner },
              },
            },
          ],
          has_more: incompleteInvoiceLinks,
        });
      }
      if (url.pathname === "/v1/refunds") return Response.json({ data: refunds, has_more: false });
      if (url.pathname === "/v1/customers")
        return Response.json({ data: customers, has_more: false });
      throw new Error(`Unexpected controlled provider read ${url.pathname}`);
    }
    const body = new URLSearchParams(String(init?.body));
    const key = headers.get("idempotency-key");
    assert.ok(key?.startsWith(`billing:${f.tenantId}:`));
    writes.push({ path: url.pathname, key });
    if (url.pathname === "/v1/refunds") {
      const result = {
        id: `re_controlled${refunds.length + 1}`,
        charge: charge.id,
        amount: Number(body.get("amount")),
        currency: charge.currency,
        status: refundStatus,
        metadata: {
          accelerate_tenant_id: f.tenantId,
          accelerate_billing_request_id: body.get("metadata[accelerate_billing_request_id]"),
        },
      };
      refunds.push(result);
      if (!["failed", "canceled"].includes(refundStatus)) charge.amount_refunded += result.amount;
      if (timeoutAfterRefund) {
        timeoutAfterRefund = false;
        throw new TypeError("Controlled disconnect after provider acceptance");
      }
      return Response.json(result, { headers: { "request-id": "req_refund" } });
    }
    if (url.pathname === "/v1/invoices/in_controlled1/void") {
      invoice.status = "void";
      invoice.amount_remaining = 0;
      return Response.json(invoice);
    }
    if (url.pathname === "/v1/customers") {
      const result = {
        id: "cus_controlled1",
        email: body.get("email"),
        name: body.get("name"),
        livemode: false,
      };
      customers.push(result);
      return Response.json(result);
    }
    throw new Error(`Unexpected controlled provider write ${url.pathname}`);
  };
  const toolContext = {
    supabase: f.db,
    actorEmail: f.email,
    tenantConfig: { modules: { "stripe-invoicing": true } },
  };
  async function stage(command: BillingCommand) {
    const preview = await previewBillingCommand(f.db, command);
    return proposeBillingCommand(f.db, command, preview.digest, f.email);
  }
  try {
    const invoicePage = await readBillingInvoices(f.db);
    invoiceIndexPageSchema.parse(invoicePage);
    assert.equal(invoicePage.invoices[0]!.managed, true);
    const page = await readBillingPayments(f.db);
    assert.equal(page.payments[0]!.refundable, true);
    await assert.rejects(
      () => readBillingPayments(f.db, { connection: "changed" }),
      /connection changed/,
    );
    await assert.rejects(() => readBillingInvoices(f.db, { cursor: "bad" }), /cursor/);
    failReads = true;
    await assert.rejects(() => readBillingPayments(f.db), /HTTP 503/);
    failReads = false;
    await assert.rejects(() => executeBillingCommand(f.db, randomUUID(), f.email), /authenticated/);
    await runWithTenantRequestContext(f.actor, async () => {
      const command = {
        operation: "refund_payment" as const,
        chargeId: charge.id,
        amount: 1500,
        reason: "requested_by_customer" as const,
        requestId: randomUUID(),
      };
      await assert.rejects(
        () => previewBillingCommand(f.db, { ...command, amount: 10001 }),
        /exceeds/,
      );
      await assert.rejects(() => previewBillingCommand(f.db, { ...command, amount: -1 }));
      charge.metadata.accelerate_tenant_id = "";
      const invoiceLinked = await previewBillingCommand(f.db, command);
      assert.deepEqual(invoiceLinked.snapshot.invoiceIds, [invoice.id]);
      linkedInvoiceOwner = f.other;
      await assert.rejects(() => previewBillingCommand(f.db, command), /belonging/);
      linkedInvoiceOwner = f.tenantId;
      incompleteInvoiceLinks = true;
      await assert.rejects(() => previewBillingCommand(f.db, command), /incomplete/);
      incompleteInvoiceLinks = false;
      charge.metadata.accelerate_tenant_id = f.tenantId;
      const toolPreview = (
        await executeRegisteredRevenueTool(toolContext, "preview_billing_change", { command })
      ).output as { digest: string };
      assert.equal(writes.length, 0, "Preview must never write to Stripe");
      const action = (
        await executeRegisteredRevenueTool(toolContext, "propose_billing_change", {
          command,
          digest: toolPreview.digest,
        })
      ).output as { id: string };
      assert.equal(
        (await stage(command))?.id,
        action.id,
        "A repeated pending request must reuse its action",
      );
      assert.equal(writes.length, 0, "Proposal must never write to Stripe");
      const stored = f.mem.rows("action_queue").find((item) => item.id === action.id)!;
      const sorted = (value: unknown): unknown =>
        value && typeof value === "object" && !Array.isArray(value)
          ? Object.fromEntries(
              Object.entries(value)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([k, v]) => [k, sorted(v)]),
            )
          : value;
      stored.payload = sorted(stored.payload); // PostgreSQL jsonb reorders object keys.
      const receipt = (await approveAndExecuteAction(f.db, action.id, f.email)) as BillingReceipt;
      assert.equal(receipt.status, "succeeded");
      assert.equal(charge.amount_refunded, 1500);
      assert.equal(writes.length, 1);
      const repeatedCompleted = await proposeBillingCommand(
        f.db,
        command,
        toolPreview.digest,
        f.email,
      );
      assert.equal(
        repeatedCompleted.id,
        action.id,
        "A completed request keeps its original action",
      );
      assert.equal(repeatedCompleted.status, "executed");
      await assert.rejects(
        () => approveAndExecuteAction(f.db, action.id, f.email),
        /already handled/,
      );
      const interrupted = await stage({ ...command, amount: 500, requestId: randomUUID() });
      timeoutAfterRefund = true;
      await assert.rejects(
        () => approveAndExecuteAction(f.db, interrupted!.id, f.email),
        /disconnect/,
      );
      assert.equal(charge.amount_refunded, 2000);
      assert.equal(writes.length, 2);
      await retryPluginAction(f.db, interrupted!.id, f.email);
      const recovered = (await approveAndExecuteAction(
        f.db,
        interrupted!.id,
        f.email,
      )) as BillingReceipt;
      assert.equal(recovered.reconciled, true);
      assert.equal(writes.length, 2, "A timed-out accepted refund must never be posted twice");
      refundStatus = "pending";
      const pending = await stage({ ...command, amount: 100, requestId: randomUUID() });
      const pendingReceipt = (await approveAndExecuteAction(
        f.db,
        pending!.id,
        f.email,
      )) as BillingReceipt;
      assert.equal(pendingReceipt.status, "pending");
      assert.match(pendingReceipt.message, /pending/);
      assert.ok(!pendingReceipt.message.includes("succeeded"));
      refundStatus = "succeeded";
      const stale = await stage({ ...command, amount: 100, requestId: randomUUID() });
      charge.amount_refunded++;
      await assert.rejects(
        () => approveAndExecuteAction(f.db, stale!.id, f.email),
        /facts changed/,
      );
      const count = writes.length;
      charge.metadata.accelerate_tenant_id = f.other;
      await assert.rejects(
        () => previewBillingCommand(f.db, { ...command, requestId: randomUUID() }),
        /belonging/,
      );
      charge.metadata.accelerate_tenant_id = f.tenantId;
      charge.disputed = true;
      await assert.rejects(
        () => previewBillingCommand(f.db, { ...command, requestId: randomUUID() }),
        /eligible/,
      );
      charge.disputed = false;
      const revoked = await stage({ ...command, amount: 100, requestId: randomUUID() });
      f.mem.rows("tenant_memberships")[0]!.status = "revoked";
      await assert.rejects(
        () => approveAndExecuteAction(f.db, revoked!.id, f.email),
        /revoked|membership/,
      );
      f.mem.rows("tenant_memberships")[0]!.status = "active";
      assert.equal(writes.length, count);
      const voidAction = await stage({
        operation: "void_invoice",
        invoiceId: invoice.id,
        requestId: randomUUID(),
      });
      const voidReceipt = (await approveAndExecuteAction(
        f.db,
        voidAction!.id,
        f.email,
      )) as BillingReceipt;
      assert.equal(voidReceipt.status, "void");
      assert.equal(invoice.amount_remaining, 0);
      invoice.status = "paid";
      invoice.amount_paid = 10000;
      await assert.rejects(
        () =>
          previewBillingCommand(f.db, {
            operation: "void_invoice",
            invoiceId: invoice.id,
            requestId: randomUUID(),
          }),
        /unpaid/,
      );
      const customer = await stage({
        operation: "create_customer",
        contactId,
        requestId: randomUUID(),
      });
      const customerReceipt = (await approveAndExecuteAction(
        f.db,
        customer!.id,
        f.email,
      )) as BillingReceipt;
      assert.equal(customerReceipt.status, "ready");
      assert.equal(customers.length, 1);
      const repeated = await stage({
        operation: "create_customer",
        contactId,
        requestId: randomUUID(),
      });
      await approveAndExecuteAction(f.db, repeated!.id, f.email);
      assert.equal(
        customers.length,
        1,
        "Customer setup must reuse an unambiguous existing billing profile",
      );
      const changed = {
        operation: "refund_payment" as const,
        chargeId: charge.id,
        amount: 100,
        reason: "duplicate" as const,
        requestId: randomUUID(),
      };
      const before = await previewBillingCommand(f.db, changed);
      charge.amount_refunded++;
      await assert.rejects(
        () => proposeBillingCommand(f.db, changed, before.digest, f.email),
        /details changed/,
      );
      const current = await stage({ ...changed, requestId: randomUUID() });
      f.mem.rows("integration_connections")[0]!.credential_version = 2;
      await assert.rejects(
        () => approveAndExecuteAction(f.db, current!.id, f.email),
        /connection changed/,
      );
      f.mem.rows("integration_connections")[0]!.credential_version = 1;
    });
    const overview = paymentOverview([
      { ...page.payments[0]!, captured: 10000, refunded: 1500 },
      { ...page.payments[0]!, id: "ch_eur", currency: "eur", captured: 3000, refunded: 0 },
      { ...page.payments[0]!, id: "ch_failed", status: "failed", captured: 1000000 },
    ]);
    assert.deepEqual(overview, [
      ["eur", { captured: 3000, refunded: 0, retained: 3000 }],
      ["usd", { captured: 10000, refunded: 1500, retained: 8500 }],
    ]);
    assert.ok(
      paymentsCsv([{ ...page.payments[0]!, name: "=DANGEROUS()" }]).includes("'=DANGEROUS()"),
    );
    const base: InvoiceIndexEntry = {
      ...invoicePage.invoices[0]!,
      status: "open",
      remaining: 10000,
      amountPaid: 0,
      dueDate: "2026-10-01T12:00:00.000Z",
    };
    const entries = [
      base,
      { ...base, id: "in_eur", currency: "eur", remaining: 2000 },
      { ...base, id: "in_draft", status: "draft" as const, amountDue: 5000 },
      { ...base, id: "in_paid", status: "paid" as const, remaining: 0 },
      { ...base, id: "in_unknown", remaining: null },
    ];
    const summary = invoiceOverview(entries, Date.parse("2026-10-18T12:00:00Z"));
    assert.equal(summary.unknownBalances, 1);
    assert.equal(summary.counts.overdue, 2);
    assert.equal(summary.counts.draft, 1);
    assert.equal(
      selectInvoices(entries, {
        search: "EXAMPLE",
        status: "overdue",
        sort: "due",
        now: Date.parse("2026-10-18T12:00:00Z"),
      }).length,
      2,
    );
    assert.equal(
      loadedInvoices([
        { ...invoicePage, invoices: [base] },
        { ...invoicePage, invoices: [base] },
      ]).length,
      1,
    );
    assert.match(formatInvoiceAmount(500, "jpy"), /500/);
    assert.match(formatInvoiceAmount(500, "isk"), /5/);
    assert.match(formatInvoiceAmount(500, "ugx"), /5/);
    assert.match(formatInvoiceAmount(1050, "huf"), /10[.,]50/);
    assert.ok(f.mem.rows("audit_log").length > 0);
    console.log(
      "Billing workspace: reviewed UI/AI service parity, exact snapshots across jsonb ordering, tenant/admin boundaries, replay, accepted-refund timeout reconciliation, provider failures, pending receipts, customer dedupe, unpaid invoice cancellation, currency-separated reports and honest partial invoice balances passed. Provider transport is controlled; no live money moved.",
    );
  } finally {
    f.restore();
    if (encryption === undefined) delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
    else process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = encryption;
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
