import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { AuthorizedMemorySupabase } from "./lib/autonomy-fixture";
import { bindTenantDatabase, callCollectionHostRpc } from "../src/lib/supabase/server";
import { runWithTenantRequestContext, type TenantActorContext } from "../src/lib/tenancy/context";
async function main() {
  const tenant = randomUUID(),
    user = randomUUID();
  const mem = new AuthorizedMemorySupabase({
    tenants: [{ id: tenant, status: "active" }],
    tenant_memberships: [{ tenant_id: tenant, user_id: user, role: "admin", status: "active" }],
  });
  const db = bindTenantDatabase(mem.client, tenant);
  const actor: TenantActorContext = {
    kind: "actor",
    tenant: { id: tenant, slug: "fixture", name: "Fixture", status: "active", config: {} },
    user: { id: user, email: "owner@example.test" },
    role: "admin",
    isPlatformAdmin: false,
    database: db,
  };
  let network = 0;
  const oldFetch = globalThis.fetch,
    oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
    oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://collections-fixture.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "controlled-collections-host-key";
  globalThis.fetch = async (input, init) => {
    network++;
    const url = new URL(String(input));
    assert.equal(url.hostname, "collections-fixture.supabase.co");
    assert.match(
      url.pathname,
      /^\/rest\/v1\/rpc\/(sync_collection_observations|update_collection_case|reserve_collection_reminder|reconcile_collection_reminder)$/,
    );
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("x-tenant-id"), tenant);
    assert.equal(headers.get("authorization"), "Bearer controlled-collections-host-key");
    return Response.json({ verified: true });
  };
  try {
    for (const operation of [
      "sync_collection_observations",
      "update_collection_case",
      "reserve_collection_reminder",
      "reconcile_collection_reminder",
    ] as const) {
      const result = await runWithTenantRequestContext(actor, () =>
        callCollectionHostRpc(db, operation, {}),
      );
      assert.equal(result.data.verified, true);
    }
    assert.equal(network, 4);
    mem.tables.tenant_memberships![0]!.status = "revoked";
    await assert.rejects(
      () =>
        runWithTenantRequestContext(actor, () =>
          callCollectionHostRpc(db, "reserve_collection_reminder", {}),
        ),
      /membership/,
    );
    mem.tables.tenant_memberships![0]!.status = "active";
    mem.tables.tenants![0]!.status = "suspended";
    await assert.rejects(
      () =>
        runWithTenantRequestContext(actor, () =>
          callCollectionHostRpc(db, "sync_collection_observations", {}),
        ),
      /membership/,
    );
    await assert.rejects(
      () =>
        runWithTenantRequestContext({ ...actor, database: mem.client }, () =>
          callCollectionHostRpc(db, "update_collection_case", {}),
        ),
      /mismatch/,
    );
    await assert.rejects(
      () => callCollectionHostRpc(db, "delete_tenant" as "update_collection_case", {}),
      /not allowed/,
    );
    assert.equal(network, 4);
    mem.rpc("reserve_collection_reminder", () => ({ originalDatabase: true }));
    assert.equal(
      (await callCollectionHostRpc(db, "reserve_collection_reminder", {})).data.originalDatabase,
      true,
    );
    assert.equal(network, 4);
    console.log(
      "PASS: authenticated actor bridge uses exact tenant RPC scope; revoked/suspended/mismatched actors and unknown operations cannot elevate; background clients remain unchanged.",
    );
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
