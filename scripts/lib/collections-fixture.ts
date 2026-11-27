import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { AuthorizedMemorySupabase } from "./autonomy-fixture";
import { bindTenantDatabase } from "../../src/lib/supabase/server";
import { encryptSecret, encryptTenantSecret } from "../../src/lib/revenue-os/encryption";

/** Controlled invoice records and email transport shared by Collections tests.
 * Collections read the workspace's own invoices table; Stripe is never called. */
export function createCollectionsFixture({ allowSends = false }: { allowSends?: boolean } = {}) {
  const oldKey = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "controlled-collections-reminder-fixture";
  const tenant = randomUUID(),
    contact = randomUUID(),
    caseId = randomUUID(),
    invoiceId = randomUUID(),
    observation = randomUUID(),
    workItemId = randomUUID();
  const config = { modules: { "receivables-collections": true, invoicing: true } };
  const mem = new AuthorizedMemorySupabase({
    tenants: [
      { id: tenant, slug: "example-sons", name: "Example & Sons", status: "active", config },
    ],
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
        invoice_id: invoiceId,
        observation_id: observation,
      },
    ],
    collection_observations: [
      {
        id: observation,
        tenant_id: tenant,
        invoice_id: invoiceId,
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
    action_queue: [],
  });
  mem.idFactory = () => randomUUID();
  function table(name: string) {
    const rows = mem.tables[name];
    assert.ok(rows);
    return rows;
  }
  const db = bindTenantDatabase(mem.client, tenant, true);
  const original = globalThis.fetch;
  const state = {
    balance: 7500,
    timeout: false,
    sends: 0,
    reads: 0,
    providerFailure: false,
  };
  const encryptedLink = encryptTenantSecret("a".repeat(43), tenant, "invoices", "link_token");
  const invoiceRow: Record<string, unknown> = {
    id: invoiceId,
    tenant_id: tenant,
    number: "INV-0007",
    contact_id: contact,
    livemode: false,
    currency: "usd",
    amount_cents: 10000,
    due_at: "2025-01-01T00:00:00.000Z",
    encrypted_link_token: encryptedLink,
  };
  // Balance and status follow the controlled payment state.
  Object.defineProperty(invoiceRow, "amount_paid_cents", {
    enumerable: true,
    get: () => 10000 - state.balance,
  });
  Object.defineProperty(invoiceRow, "status", {
    enumerable: true,
    get: () => (state.balance ? "open" : "paid"),
  });
  // providerFailure now means the invoice record cannot be read.
  Object.defineProperty(mem.tables, "invoices", {
    enumerable: true,
    get: () => {
      state.reads++;
      return state.providerFailure ? [] : [invoiceRow];
    },
  });
  process.env.NEXT_PUBLIC_SITE_URL ||= "https://accelerate.example.test";
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.notEqual(url.hostname, "api.stripe.com", "Collections never call Stripe");
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
    invoiceId,
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
