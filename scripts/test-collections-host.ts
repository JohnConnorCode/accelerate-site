import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { AuthorizedMemorySupabase } from "./lib/autonomy-fixture";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import {
  syncCollectionCases,
  updateCollectionCase,
  collectionCasePatchSchema,
} from "../src/lib/revenue-os/collections";

// Collections observe this workspace's own invoices. Stripe is never read.
async function main() {
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "controlled-collections-fixture-key";
  const tenant = "11111111-1111-4111-8111-111111111111",
    contact = "22222222-2222-4222-8222-222222222222",
    ids = [randomUUID(), randomUUID()];
  const invoice = (id: string, i: number) => ({
    id,
    tenant_id: tenant,
    number: `INV-000${i + 1}`,
    contact_id: contact,
    livemode: false,
    currency: "usd",
    status: "open",
    amount_cents: 10000,
    amount_paid_cents: 2500,
    due_at: "2025-01-01T00:00:00.000Z",
    encrypted_link_token: null,
  });
  const mem = new AuthorizedMemorySupabase({
    tenants: [
      {
        id: tenant,
        slug: "fixture",
        status: "active",
        config: { modules: { "receivables-collections": true, invoicing: true } },
      },
    ],
    invoices: ids.map(invoice),
  });
  const db = bindTenantDatabase(mem.client, tenant, true),
    originalFetch = globalThis.fetch;
  let writes = 0;
  const request = randomUUID();
  mem.rpc("sync_collection_observations", (args) => {
    writes++;
    const observations = args.p_observations as { invoiceId: string }[];
    const result = { caseIds: [contact], observations: observations.length };
    (mem.tables.collection_commands ??= []).push({
      tenant_id: tenant,
      request_id: args.p_request,
      command_hash: createHash("sha256")
        .update(
          "observe:" +
            observations
              .map((o) => o.invoiceId)
              .sort()
              .join(","),
        )
        .digest("hex"),
      result,
    });
    return result;
  });
  mem.rpc("update_collection_case", () => ({ revision: 3 }));
  globalThis.fetch = async () => {
    throw new Error("Collections never call a provider");
  };
  try {
    // A missing or draft invoice prevents the whole write.
    await assert.rejects(
      () => syncCollectionCases(db, [ids[0]!, randomUUID()], request, "owner@example.test"),
      /unavailable/,
    );
    mem.rows("invoices")[1]!.status = "draft";
    await assert.rejects(
      () => syncCollectionCases(db, ids, randomUUID(), "owner@example.test"),
      /issued invoices/,
    );
    mem.rows("invoices")[1]!.status = "open";
    mem.rows("invoices")[1]!.contact_id = null;
    await assert.rejects(
      () => syncCollectionCases(db, ids, randomUUID(), "owner@example.test"),
      /linked to a contact/,
    );
    mem.rows("invoices")[1]!.contact_id = contact;
    assert.equal(writes, 0);
    assert.deepEqual(await syncCollectionCases(db, ids, request, "owner@example.test"), {
      caseIds: [contact],
      observations: 2,
    });
    assert.equal(writes, 1);
    const sent = mem.rpcCalls.find((c) => c.name === "sync_collection_observations")!.args
      .p_observations as Record<string, unknown>[];
    assert.deepEqual(
      Object.keys(sent[0]!),
      ["invoiceId"],
      "callers name invoices; SQL reads balances",
    );
    await syncCollectionCases(db, [...ids].reverse(), request, "owner@example.test");
    assert.equal(writes, 1);
    await assert.rejects(
      () => syncCollectionCases(db, [ids[0]!], request, "owner@example.test"),
      /identity conflict/,
    );
    await assert.rejects(
      () => syncCollectionCases(db, [ids[0]!, ids[0]!], randomUUID(), "owner@example.test"),
      /Duplicate/,
    );
    assert.equal(collectionCasePatchSchema.safeParse({ remaining: 0 }).success, false);
    assert.equal(collectionCasePatchSchema.safeParse({ nextAction: "" }).success, false);
    await updateCollectionCase(
      db,
      contact,
      2,
      randomUUID(),
      { promiseDate: "2030-01-01" },
      "owner@example.test",
    );
    mem.rows("tenants")[0]!.config = {
      modules: { "receivables-collections": false, invoicing: true },
    };
    await assert.rejects(
      () => syncCollectionCases(db, ids, randomUUID(), "owner@example.test"),
      /disabled/,
    );
    await assert.rejects(
      () =>
        updateCollectionCase(db, contact, 3, randomUUID(), { paused: true }, "owner@example.test"),
      /disabled/,
    );
    assert.equal(writes, 1);
    console.log(
      "PASS: collections observe workspace invoices, refuse missing/draft/unlinked invoices with zero writes, replay safely, detect identity conflicts and respect the disabled host.",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
