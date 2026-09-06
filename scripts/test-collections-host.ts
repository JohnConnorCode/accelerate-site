import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { AuthorizedMemorySupabase } from "./lib/autonomy-fixture";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import { encryptTenantSecret } from "../src/lib/revenue-os/encryption";
import {
  syncCollectionCases,
  updateCollectionCase,
  collectionCasePatchSchema,
} from "../src/lib/revenue-os/collections";
async function main() {
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "controlled-collections-fixture-key";
  const tenant = "11111111-1111-4111-8111-111111111111",
    contact = "22222222-2222-4222-8222-222222222222",
    ids = [randomUUID(), randomUUID()];
  const mem = new AuthorizedMemorySupabase({
    tenants: [
      {
        id: tenant,
        status: "active",
        config: { modules: { "receivables-collections": true, "stripe-invoicing": true } },
      },
    ],
    integration_connections: [
      {
        id: "connection",
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
    action_queue: ids.map((id, i) => ({
      id,
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
      result: { invoiceId: "in_" + i, complete: true },
    })),
  });
  const db = bindTenantDatabase(mem.client, tenant, true),
    originalFetch = globalThis.fetch;
  let mode = "success",
    reads = 0,
    writes = 0;
  const request = randomUUID();
  mem.rpc("sync_collection_observations", (args) => {
    writes++;
    const observations = args.p_observations as { creationActionId: string }[];
    const result = { caseIds: [contact], observations: observations.length };
    (mem.tables.collection_commands ??= []).push({
      tenant_id: tenant,
      request_id: args.p_request,
      command_hash: createHash("sha256")
        .update(
          "observe:" +
            observations
              .map((o) => o.creationActionId)
              .sort()
              .join(","),
        )
        .digest("hex"),
      result,
    });
    return result;
  });
  mem.rpc("update_collection_case", () => ({ revision: 3 }));
  globalThis.fetch = async (input) => {
    reads++;
    const path = new URL(String(input)).pathname;
    assert.match(path, /^\/v1\/invoices\/in_[01]$/);
    const i = Number(path.slice(-1));
    if (mode === "failure" && i === 1) return new Response("Unavailable", { status: 503 });
    return Response.json(
      {
        id: "in_" + i,
        status: "open",
        currency: "usd",
        amount_due: 10000,
        amount_paid: 2500,
        amount_remaining: mode === "bad-balance" ? -1 : 7500,
        livemode: false,
        due_date: 1735689600,
        customer: mode === "wrong-customer" ? "cus_other" : "cus_fixture",
        metadata: {
          accelerate_tenant_id: mode === "foreign" ? contact : tenant,
          accelerate_action_id: ids[i],
          accelerate_contact_id: contact,
        },
      },
      { headers: { "request-id": "req_fixture" } },
    );
  };
  try {
    mode = "failure";
    await assert.rejects(
      () => syncCollectionCases(db, ids, request, "owner@example.test"),
      /Stripe request failed/,
    );
    assert.equal(writes, 0);
    for (mode of ["bad-balance", "wrong-customer", "foreign"]) {
      await assert.rejects(() => syncCollectionCases(db, ids, randomUUID(), "owner@example.test"));
      assert.equal(writes, 0);
    }
    mode = "success";
    assert.deepEqual(await syncCollectionCases(db, ids, request, "owner@example.test"), {
      caseIds: [contact],
      observations: 2,
    });
    assert.equal(writes, 1);
    const observations = mem.rpcCalls.find((c) => c.name === "sync_collection_observations")!.args
      .p_observations as { remaining: number; complete: boolean }[];
    assert.ok(observations.every((o) => o.remaining === 7500 && o.complete));
    const priorReads = reads;
    await syncCollectionCases(db, [...ids].reverse(), request, "owner@example.test");
    assert.equal(reads, priorReads);
    assert.equal(writes, 1);
    await assert.rejects(
      () => syncCollectionCases(db, [ids[0]], request, "owner@example.test"),
      /identity conflict/,
    );
    await assert.rejects(
      () => syncCollectionCases(db, [ids[0], ids[0]], randomUUID(), "owner@example.test"),
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
      modules: { "receivables-collections": false, "stripe-invoicing": true },
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
    assert.equal(reads, priorReads);
    assert.equal(writes, 1);
    console.log(
      "PASS: canonical Stripe projection, partial provider failure with zero writes, foreign/malformed facts, partial balances, no-read replay, identity conflicts, bounded input, reviewed edits and disabled host.",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
