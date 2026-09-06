import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { AuthorizedMemorySupabase } from "./autonomy-fixture";
import { bindTenantDatabase } from "../../src/lib/supabase/server";
import { encryptSecret, encryptTenantSecret } from "../../src/lib/revenue-os/encryption";

/** Controlled Stripe/email transport shared by Collections host and entrypoint tests. */
export function createCollectionsFixture({ allowSends = false } = {}) {
  const oldKey = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "controlled-collections-reminder-fixture";
  const tenant = randomUUID(),
    contact = randomUUID(),
    caseId = randomUUID(),
    invoiceAction = randomUUID(),
    observation = randomUUID(),
    workItemId = randomUUID();
  const config = { modules: { "receivables-collections": true, "stripe-invoicing": true } };
  const mem = new AuthorizedMemorySupabase({
    tenants: [{ id: tenant, name: "Example & Sons", status: "active", config }],
    contacts: [
      {
        id: contact,
        tenant_id: tenant,
        full_name: "Canonical customer",
        primary_email: "billing@example.test",
        communication_status: "active",
      },
    ],
    collection_cases: [
      {
        id: caseId,
        tenant_id: tenant,
        contact_id: contact,
        currency: "usd",
        status: "open",
        revision: 1,
        disputed: false,
        paused: false,
        pause_until: null,
        promise_date: null,
        owner_email: null,
        next_action: "Review overdue invoices",
        updated_at: new Date().toISOString(),
      },
    ],
    collection_case_invoices: [
      {
        tenant_id: tenant,
        case_id: caseId,
        creation_action_id: invoiceAction,
        observation_id: observation,
      },
    ],
    collection_observations: [
      {
        id: observation,
        tenant_id: tenant,
        invoice_id: "in_fixture",
        remaining: 7500,
        status: "open",
        due_date: "2025-01-01",
        observed_at: "2025-01-02T00:00:00.000Z",
      },
    ],
    collection_reminder_attempts: [],
    collection_events: [],
    work_items: [
      {
        id: workItemId,
        tenant_id: tenant,
        kind: "review_collection_case",
        entity_type: "collection_case",
        entity_id: caseId,
        status: "pending",
        objective: "Review canonical case",
        next_check_at: null,
        next_check_reason: "Observed overdue invoice",
      },
    ],
    integration_connections: [
      {
        id: randomUUID(),
        tenant_id: tenant,
        provider: "stripe",
        status: "connected",
        credential_version: 1,
        account_email: "acct_fixture",
        encrypted_credentials: {
          api_key: encryptTenantSecret("rk_test_fixture0000000000", tenant, "stripe", "api_key"),
        },
      },
      {
        id: randomUUID(),
        tenant_id: tenant,
        provider: "resend",
        status: "connected",
        account_email: "finance@example.test",
        encrypted_credentials: { api_key: encryptSecret("re_controlled_fixture") },
      },
    ],
    action_queue: [
      {
        id: invoiceAction,
        tenant_id: tenant,
        action_type: "create_stripe_invoice_draft",
        status: "executed",
        payload: {
          accountId: "acct_fixture",
          testMode: true,
          contactId: contact,
          customerId: "cus_fixture",
          currency: "usd",
        },
        result: { invoiceId: "in_fixture", complete: true },
      },
    ],
  });
  mem.idFactory = () => randomUUID();
  function table(name: string) {
    const rows = mem.tables[name];
    assert.ok(rows);
    return rows;
  }
  const db = bindTenantDatabase(mem.client, tenant, true);
  const original = globalThis.fetch;
  const state = { balance: 7500, timeout: false, sends: 0, reads: 0, providerFailure: false };
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === "api.stripe.com") {
      assert.equal(init?.method ?? "GET", "GET", "Collection reads cannot mutate Stripe");
      assert.equal(url.pathname, "/v1/invoices/in_fixture");
      state.reads++;
      if (state.providerFailure)
        return Response.json(
          { error: { message: "Controlled provider unavailable" } },
          { status: 503 },
        );
      return Response.json({
        id: "in_fixture",
        status: state.balance ? "open" : "paid",
        currency: "usd",
        amount_due: 10000,
        amount_paid: 10000 - state.balance,
        amount_remaining: state.balance,
        livemode: false,
        due_date: 1735689600,
        customer: "cus_fixture",
        hosted_invoice_url: "https://invoice.stripe.com/i/fixture",
        metadata: {
          accelerate_tenant_id: tenant,
          accelerate_action_id: invoiceAction,
          accelerate_contact_id: contact,
        },
      });
    }
    assert.equal(url.hostname, "api.resend.com", "Unexpected provider request");
    state.sends++;
    assert.ok(allowSends, "Agent entrypoints may never send");
    if (state.timeout) throw new Error("controlled provider timeout");
    return Response.json({ id: "email_fixture" });
  };
  mem.rpc("reserve_collection_reminder", ({ p_action }) => {
    assert.equal(table("collection_reminder_attempts").length, 0);
    table("collection_reminder_attempts").push({
      tenant_id: tenant,
      case_id: caseId,
      action_id: p_action,
      state: "dispatching",
    });
    return { state: "dispatching", reserved: true };
  });
  mem.rpc("reconcile_collection_reminder", ({ p_action }) => {
    const attempt = table("collection_reminder_attempts").find((r) => r.action_id === p_action)!;
    const message = table("messages")?.find((r) => r.idempotency_key === `action:${p_action}`);
    if (message?.provider_id && message.sent_at)
      Object.assign(attempt, {
        state: "sent",
        provider_id: message.provider_id,
        sent_at: message.sent_at,
      });
    else attempt.state = "uncertain";
    return attempt;
  });
  return {
    tenant,
    contact,
    caseId,
    invoiceAction,
    observation,
    workItemId,
    mem,
    db,
    table,
    state,
    row: () => table("collection_cases")[0]!,
    restore() {
      globalThis.fetch = original;
      if (oldKey === undefined) delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
      else process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = oldKey;
    },
  };
}
