import assert from "node:assert/strict";
import { AuthorizedMemorySupabase } from "./lib/autonomy-fixture";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import { encryptTenantSecret } from "../src/lib/revenue-os/encryption";
import {
  prepareWorkflowPlugin,
  proposeWorkflowPlugin,
} from "../src/lib/revenue-os/workflow-plugins";
import { approveAndExecuteAction } from "../src/lib/revenue-os/action-executor";
import { retryPluginAction } from "../src/lib/revenue-os/actions";
import {
  proposeStripeInvoiceSend,
  readStripeInvoiceForAction,
} from "../src/lib/revenue-os/stripe-invoicing";
import {
  generateInvoiceDesign,
  previewInvoicePage,
  proposeInvoicePage,
  listInvoicePages,
  readPublicInvoicePage,
  revokeInvoicePage,
} from "../src/lib/revenue-os/invoice-pages";
import { defaultInvoiceDesign } from "../src/lib/revenue-os/invoice-page-contract";
import { stripeBillingChoices } from "../src/lib/revenue-os/stripe-invoicing";
async function main() {
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "controlled-stripe-fixture-key-not-a-provider-secret";
  const tenantId = "11111111-1111-4111-8111-111111111111",
    contactId = "22222222-2222-4222-8222-222222222222";
  const mem = new AuthorizedMemorySupabase({
    tenants: [
      {
        id: tenantId,
        name: "Fixture business",
        status: "active",
        config: { modules: { "stripe-invoicing": true } },
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
    entity_types: [
      {
        id: "contacts",
        tenant_id: tenantId,
        type_key: "workflow_contacts",
        backing_table: "contacts",
        id_column: "id",
        is_disabled: false,
        metadata: { readable_columns: ["full_name", "primary_email"] },
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
          api_key: encryptTenantSecret("rk_test_fixture0000000000", tenantId, "stripe", "api_key"),
        },
      },
    ],
  });
  mem.idFactory = (sequence) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(sequence).padStart(12, "0")}`;
  const db = bindTenantDatabase(mem.client, tenantId, true);
  const originalFetch = globalThis.fetch;
  let invoice: Record<string, unknown> | null = null,
    creates = 0,
    lineWrites = 0,
    sends = 0,
    failLines = false;
  let invalidDesign = false;
  const cache = new Map<string, unknown>();
  const customer = {
    id: "cus_fixture",
    email: "billing@example.example",
    name: "Example Customer",
    livemode: false,
  };
  globalThis.fetch = async (url, init) => {
    const parsed = new URL(String(url));
    if (parsed.origin === "https://openrouter.ai") {
      assert.equal(String(init?.body).includes("billing@example.example"), false);
      return new Response(
        JSON.stringify({
          id: "generation-fixture",
          model: "controlled-model",
          choices: [
            {
              message: {
                role: "assistant",
                content: JSON.stringify(
                  invalidDesign ? { ...defaultInvoiceDesign, total: 1 } : defaultInvoiceDesign,
                ),
              },
            },
          ],
          usage: { prompt_tokens: 30, completion_tokens: 25 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    assert.equal(parsed.origin, "https://api.stripe.com");
    assert.equal(new Headers(init?.headers).get("Stripe-Version"), "2025-06-30.basil");
    const respond = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", "Request-Id": "req_fixture" },
      });
    if (parsed.pathname === "/v1/customers") return respond({ data: [customer], has_more: false });
    if (parsed.pathname === "/v1/customers/cus_fixture") return respond(customer);
    if (init?.method !== "POST") return respond(invoice);
    const key = new Headers(init.headers).get("Idempotency-Key");
    assert.ok(key);
    if (cache.has(key)) return respond(cache.get(key));
    const body = new URLSearchParams(String(init.body));
    if (parsed.pathname === "/v1/invoices") {
      creates++;
      assert.equal(body.get("auto_advance"), "false");
      assert.equal(body.get("pending_invoice_items_behavior"), "exclude");
      assert.equal(body.get("collection_method"), "send_invoice");
      invoice = {
        id: "in_fixture",
        customer: customer.id,
        customer_email: customer.email,
        currency: "usd",
        status: "draft",
        auto_advance: false,
        collection_method: "send_invoice",
        livemode: false,
        total: 0,
        amount_due: 0,
        amount_paid: 0,
        amount_remaining: 0,
        metadata: {
          accelerate_tenant_id: body.get("metadata[accelerate_tenant_id]"),
          accelerate_action_id: body.get("metadata[accelerate_action_id]"),
        },
        lines: { data: [], has_more: false },
      };
    } else if (parsed.pathname.endsWith("/add_lines")) {
      if (failLines) {
        failLines = false;
        return respond({ error: "fixture gateway failure before execution" }, 503);
      }
      lineWrites++;
      const amount = Number(body.get("lines[0][amount]"));
      invoice = {
        ...invoice,
        total: amount,
        amount_due: amount,
        amount_remaining: amount,
        lines: {
          data: [{ id: "il_fixture", amount, description: body.get("lines[0][description]") }],
          has_more: false,
        },
      };
    } else if (parsed.pathname.endsWith("/finalize"))
      invoice = {
        ...invoice,
        status: "open",
        hosted_invoice_url: "https://invoice.stripe.com/i/fixture",
      };
    else if (parsed.pathname.endsWith("/send")) {
      sends++;
      invoice = { ...invoice, status: "open" };
    } else throw new Error("Unexpected provider operation");
    cache.set(key, structuredClone(invoice));
    return respond(invoice);
  };
  try {
    const input = {
      contactId,
      customerId: "cus_fixture",
      currency: "usd",
      daysUntilDue: 14,
      memo: "Discovery engagement",
      lines: [{ description: "Discovery workshop", quantity: 2, unitAmount: 25000 }],
    };
    assert.equal((await stripeBillingChoices(db)).customers.length, 1);
    const preview = await prepareWorkflowPlugin(db, "stripe-invoicing", input);
    assert.equal(preview.payload.total, 50000);
    assert.equal(creates, 0, "Preparation must not mutate Stripe");
    await assert.rejects(
      () =>
        prepareWorkflowPlugin(db, "stripe-invoicing", {
          ...input,
          contactId: "33333333-3333-4333-8333-333333333333",
        }),
      /unavailable/,
    );
    await assert.rejects(() =>
      prepareWorkflowPlugin(db, "stripe-invoicing", {
        ...input,
        lines: [{ description: "x", quantity: 1, unitAmount: -1 }],
      }),
    );
    const requestId = "44444444-4444-4444-8444-444444444444";
    const proposed = await proposeWorkflowPlugin(
      db,
      "stripe-invoicing",
      input,
      preview.digest,
      requestId,
      "qa@example.example",
    );
    const same = await proposeWorkflowPlugin(
      db,
      "stripe-invoicing",
      input,
      preview.digest,
      requestId,
      "qa@example.example",
    );
    assert.equal(same.id, proposed.id);
    assert.equal(creates, 0, "Queueing must not mutate Stripe");
    failLines = true;
    await assert.rejects(
      () => approveAndExecuteAction(db, proposed.id, "qa@example.example"),
      /Stripe request failed/,
    );
    const row = mem.rows("action_queue").find((item) => item.id === proposed.id)!;
    assert.equal(row.status, "failed");
    assert.equal((row.result as { invoiceId: string }).invoiceId, "in_fixture");
    assert.equal(creates, 1);
    assert.equal(lineWrites, 0);
    await retryPluginAction(db, proposed.id, "qa@example.example");
    const created = (await approveAndExecuteAction(db, proposed.id, "qa@example.example")) as {
      complete: boolean;
      amountDue: number;
    };
    assert.equal(created.complete, true);
    assert.equal(created.amountDue, 50000);
    assert.equal(creates, 1);
    assert.equal(lineWrites, 1);
    await assert.rejects(
      () => approveAndExecuteAction(db, proposed.id, "qa@example.example"),
      /already handled/,
    );
    const send = await proposeStripeInvoiceSend(db, proposed.id, "qa@example.example");
    assert.equal(sends, 0);
    const tenant = mem.rows("tenants")[0]!;
    (tenant.config as { modules: Record<string, boolean> }).modules["stripe-invoicing"] = false;
    await assert.rejects(
      () => approveAndExecuteAction(db, send.id, "qa@example.example"),
      /disabled/,
    );
    assert.equal(sends, 0);
    (tenant.config as { modules: Record<string, boolean> }).modules["stripe-invoicing"] = true;
    await retryPluginAction(db, send.id, "qa@example.example");
    const sent = (await approveAndExecuteAction(db, send.id, "qa@example.example")) as {
      delivery: string;
      status: string;
    };
    assert.equal(sent.delivery, "not_sent_test_mode");
    assert.equal(sent.status, "open");
    assert.equal(sends, 1);
    const current = await readStripeInvoiceForAction(db, proposed.id);
    assert.equal(current.receipt.amountPaid, 0);
    assert.equal(current.receipt.amountRemaining, 50000);
    mem.rows("integration_connections").push({
      tenant_id: tenantId,
      provider: "openrouter",
      status: "connected",
      encrypted_credentials: {
        api_key: encryptTenantSecret(
          "controlled-openrouter-fixture",
          tenantId,
          "openrouter",
          "api_key",
        ),
      },
    });
    const generated = await generateInvoiceDesign(db, proposed.id, "A clear professional invoice");
    assert.equal(generated.design.heading, "Invoice");
    assert.ok(generated.provenance.runId);
    assert.equal(
      mem.rows("agent_runs").find((row) => row.id === generated.provenance.runId)?.status,
      "completed",
    );
    invalidDesign = true;
    await assert.rejects(
      () => generateInvoiceDesign(db, proposed.id, "Attempt unsupported fields"),
      /Unrecognized/,
    );
    invalidDesign = false;
    assert.equal(mem.rows("agent_runs").at(-1)?.status, "failed");
    const pagePreview = await previewInvoicePage(db, proposed.id, defaultInvoiceDesign);
    assert.equal(pagePreview.document.total, 50000);
    const publication = await proposeInvoicePage(
      db,
      {
        creationActionId: proposed.id,
        design: defaultInvoiceDesign,
        digest: pagePreview.digest,
        requestId: "44444444-4444-4444-8444-444444444444",
      },
      "qa@example.example",
    );
    assert.equal(mem.rows("invoice_pages").length, 0);
    const published = (await approveAndExecuteAction(db, publication.id, "qa@example.example")) as {
      pageId: string;
    };
    assert.ok(published.pageId);
    const links = await listInvoicePages(db, proposed.id);
    assert.equal(links.length, 1);
    const token = links[0]!.token!;
    assert.equal(mem.rows("invoice_pages")[0]!.token_hash === token, false);
    assert.equal((await readPublicInvoicePage(db, token)).document.amountRemaining, 50000);
    await assert.rejects(() => readPublicInvoicePage(db, "x".repeat(43)), /unavailable/);
    invoice = {
      ...(invoice as unknown as Record<string, unknown>),
      status: "paid",
      amount_paid: 50000,
      amount_remaining: 0,
    };
    assert.equal((await readPublicInvoicePage(db, token)).document.amountRemaining, 0);
    await revokeInvoicePage(db, published.pageId, "qa@example.example");
    await assert.rejects(() => readPublicInvoicePage(db, token), /unavailable/);
    const paid = await readStripeInvoiceForAction(db, proposed.id);
    assert.equal(paid.receipt.amountRemaining, 0);
    assert.equal(paid.receipt.status, "paid");
    await assert.rejects(() => proposeStripeInvoiceSend(db, proposed.id, "qa"), /not ready/);
    await assert.rejects(
      () => stripeBillingChoices(bindTenantDatabase(mem.client, "another-tenant", true)),
      /disabled|unavailable/,
    );
    console.log(
      "Stripe workflow: real isolate preparation, identity validation, approval, partial receipt, same-operation retry, exact amounts, disabled queued send and truthful test-mode provider acceptance passed. Provider transport is a deterministic fixture, not live Stripe proof.",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
