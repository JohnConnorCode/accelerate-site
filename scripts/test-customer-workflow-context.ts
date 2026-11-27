import assert from "node:assert/strict";
import { MemorySupabase } from "./lib/memory-supabase";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import { encryptTenantSecret } from "../src/lib/revenue-os/encryption";
import { workflowTaskSources } from "../src/lib/revenue-os/workflow-tasks";
import { listInvoices } from "../src/lib/revenue-os/invoices";

const tenant = "11111111-1111-4111-8111-111111111111";
const otherTenant = "22222222-2222-4222-8222-222222222222";
const id = (index: number) => `30000000-0000-4000-8000-${String(index).padStart(12, "0")}`;

async function main() {
  const opportunities = Array.from({ length: 105 }, (_, index) => ({
    id: id(index),
    tenant_id: tenant,
    name: `Won work ${index}`,
    stage: "won",
    updated_at: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
  }));
  const mem = new MemorySupabase({
    opportunities: [
      ...opportunities,
      { ...opportunities[0], id: id(200), stage: "lost" },
      { ...opportunities[0], id: id(201), tenant_id: otherTenant },
    ],
    calendar_events: [
      {
        id: id(210),
        tenant_id: tenant,
        title: "Review",
        status: "confirmed",
        start_at: "2026-10-19",
      },
      {
        id: id(211),
        tenant_id: tenant,
        title: "Cancelled",
        status: "cancelled",
        start_at: "2026-10-19",
      },
    ],
  });
  const db = bindTenantDatabase(mem.client, tenant, true);
  const recent = await workflowTaskSources(db, "client-onboarding");
  assert.equal(recent.records.length, 100);
  assert.equal(recent.truncated, true);
  assert.equal(
    recent.records.some((record) => record.id === id(0)),
    false,
  );
  const linked = await workflowTaskSources(db, "client-onboarding", id(0));
  assert.equal(linked.records[0]?.id, id(0), "An older exact source must remain selectable");
  assert.equal(linked.records.length, 100, "Deep links must not remove the source bound");
  assert.equal(new Set(linked.records.map((record) => record.id)).size, 100);
  const duplicate = await workflowTaskSources(db, "client-onboarding", id(104));
  assert.equal(duplicate.records.filter((record) => record.id === id(104)).length, 1);
  for (const missing of [id(200), id(201), id(999)]) {
    const result = await workflowTaskSources(db, "client-onboarding", missing);
    assert.equal(
      result.records.some((record) => record.id === missing),
      false,
    );
  }
  assert.equal(
    (await workflowTaskSources(db, "meeting-commitments", id(210))).records[0]?.id,
    id(210),
  );
  assert.equal(
    (await workflowTaskSources(db, "meeting-commitments", id(211))).records.some(
      (record) => record.id === id(211),
    ),
    false,
  );
  const beforeInvalid = mem.queryTables.length;
  await assert.rejects(() => workflowTaskSources(db, "client-onboarding", "invalid"));
  await assert.rejects(() => workflowTaskSources(db, "unknown"));
  assert.equal(mem.queryTables.length, beforeInvalid, "Invalid requests must fail before querying");
  await assert.rejects(() => workflowTaskSources(mem.client, "client-onboarding"), /tenant-bound/);
  mem.fail("opportunities", { message: "fixture outage" });
  await assert.rejects(
    () => workflowTaskSources(db, "client-onboarding", id(0)),
    /could not be read/,
  );
  mem.recover("opportunities");
  assert.equal(
    (
      await workflowTaskSources(
        bindTenantDatabase(new MemorySupabase().client, tenant, true),
        "client-onboarding",
      )
    ).records.length,
    0,
  );

  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "controlled-stripe-fixture-key-not-a-provider-secret";
  const contactId = id(300);
  const contact = {
    id: contactId,
    tenant_id: tenant,
    full_name: "Z Selected customer",
    primary_email: "selected@example.example",
  };
  const billingMemory = new MemorySupabase({
    tenants: [
      { id: tenant, slug: "fixture", status: "active", config: { modules: { invoicing: true } } },
    ],
    invoices: [],
    contacts: [
      ...Array.from({ length: 105 }, (_, index) => ({
        id: id(400 + index),
        tenant_id: tenant,
        full_name: `A Customer ${index}`,
        primary_email: `other${index}@example.example`,
      })),
      contact,
      { ...contact, id: id(301), tenant_id: otherTenant },
    ],
    integration_connections: [
      {
        id: "fixture-connection",
        tenant_id: tenant,
        provider: "stripe",
        status: "connected",
        credential_version: 1,
        account_email: "acct_fixture",
        encrypted_credentials: {
          api_key: encryptTenantSecret("rk_test_fixture0000000000", tenant, "stripe", "api_key"),
        },
      },
    ],
  });
  const billingDb = bindTenantDatabase(billingMemory.client, tenant, true);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Listing invoices and contacts never calls Stripe");
  };
  try {
    const unlinked = await listInvoices(billingDb);
    assert.equal(unlinked.contacts.some((row) => row.id === contactId), true);
    const selected = await listInvoices(billingDb, { contactId });
    assert.equal(selected.contacts.filter((row) => row.id === contactId).length, 1);
    await assert.rejects(
      () => listInvoices(billingDb, { contactId: id(301) }),
      /identity is unavailable/,
    );
    await assert.rejects(
      () => listInvoices(billingDb, { contactId: id(999) }),
      /identity is unavailable/,
    );
    await assert.rejects(() => listInvoices(billingDb, { contactId: "invalid" }));
  } finally {
    globalThis.fetch = originalFetch;
  }
  console.log(
    "Customer workflow context passed: exact bounded sources, unavailable/ineligible/foreign records, selected billing contacts and read-only provider lookup.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
