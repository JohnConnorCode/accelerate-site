import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { AuthorizedMemorySupabase } from "./lib/autonomy-fixture";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import { readCollectionWorkspace } from "../src/lib/revenue-os/collection-workspace";
async function main() {
  const tenant = randomUUID(),
    foreign = randomUUID(),
    contact = randomUUID(),
    id = randomUUID(),
    operation = randomUUID(),
    observation = randomUUID();
  const mem = new AuthorizedMemorySupabase({
    tenants: [
      { id: tenant, status: "active", config: { modules: { "receivables-collections": true } } },
    ],
    contacts: [
      {
        id: contact,
        tenant_id: tenant,
        full_name: "Canonical customer",
        primary_email: "finance@customer.example",
      },
    ],
    collection_cases: [
      {
        id,
        tenant_id: tenant,
        contact_id: contact,
        currency: "usd",
        status: "open",
        revision: 2,
        disputed: false,
        paused: false,
        pause_until: null,
        promise_date: null,
        owner_email: null,
        next_action: "Review verified invoices",
      },
      { id: randomUUID(), tenant_id: foreign, contact_id: randomUUID() },
    ],
    collection_case_invoices: [
      {
        tenant_id: tenant,
        case_id: id,
        creation_action_id: operation,
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
        observed_at: new Date().toISOString(),
      },
    ],
    work_items: [
      {
        id: randomUUID(),
        tenant_id: tenant,
        entity_id: id,
        kind: "review_collection_case",
        status: "pending",
        objective: "Review canonical case",
        next_check_at: null,
        next_check_reason: "Verified invoice remains overdue",
      },
    ],
    collection_events: [],
    action_queue: [
      {
        id: operation,
        tenant_id: tenant,
        action_type: "create_stripe_invoice_draft",
        status: "executed",
        title: "Invoice source",
      },
    ],
  });
  const db = bindTenantDatabase(mem.client, tenant, true),
    oldFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Workspace reads must never call providers");
  };
  try {
    const view = await readCollectionWorkspace(db);
    assert.equal(view.cases.length, 1);
    assert.equal(view.cases[0]!.name, "Canonical customer");
    assert.equal(view.cases[0]!.invoices[0]!.remaining, 7500);
    assert.equal(view.cases[0]!.work[0]!.id, mem.tables.work_items![0]!.id);
    assert.equal((await readCollectionWorkspace(db, randomUUID())).cases.length, 0);
    await assert.rejects(() => readCollectionWorkspace(db, "not-a-contact-id"));
    mem.tables.collection_observations = [];
    await assert.rejects(() => readCollectionWorkspace(db), /Incomplete/);
    mem.tables.tenants![0]!.status = "suspended";
    await assert.rejects(() => readCollectionWorkspace(db), /unavailable/);
    console.log(
      "PASS: workspace reads canonical contact IDs, partial balances and same WorkItems; tenant scope, customer filtering, missing-evidence refusal and no provider calls.",
    );
  } finally {
    globalThis.fetch = oldFetch;
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
