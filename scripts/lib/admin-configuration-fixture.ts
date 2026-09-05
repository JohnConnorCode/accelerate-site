import type { SupabaseClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { AuthorizedMemorySupabase } from "./autonomy-fixture";
import { bindTenantDatabase } from "../../src/lib/supabase/server";
import type { TenantActorContext } from "../../src/lib/tenancy/context";
/** Shared real-host-client transport fixture for approved admin configuration. */
export function createAdminConfigurationFixture() {
  const tenantId = randomUUID(),
    other = randomUUID(),
    userId = randomUUID();
  const email = "admin@example.test";
  const mem = new AuthorizedMemorySupabase({
    tenants: [
      {
        id: tenantId,
        name: "Original Studio",
        status: "active",
        config: { modules: { "stripe-invoicing": true }, unrelated: "retain" },
      },
      { id: other, name: "Other Studio", status: "active", config: {} },
    ],
    tenant_memberships: [{ tenant_id: tenantId, user_id: userId, role: "admin", status: "active" }],
  });
  mem.idFactory = () => randomUUID();
  const db = bindTenantDatabase(mem.client, tenantId, true);
  const actor: TenantActorContext = {
    kind: "actor",
    database: db,
    user: { id: userId, email },
    role: "admin",
    isPlatformAdmin: false,
    tenant: { id: tenantId, slug: "studio", name: "Original Studio", status: "active", config: {} },
  };
  const oldFetch = globalThis.fetch;
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
    oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://branding-fixture.example.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "controlled-branding-service-key";
  const controls = { saves: 0, hostFailure: false };
  // Exercise the real privileged Supabase client and shared CAS writer against
  // controlled REST transport, with no production connection or runtime injection seam.
  globalThis.fetch = async (raw, init) => {
    const url = new URL(String(raw));
    assert.equal(url.origin, "https://branding-fixture.example.test");
    const table = url.pathname.split("/").at(-1)!;
    assert.ok(
      ["tenants", "audit_log", "entity_types"].includes(table),
      `Unexpected host table ${table}`,
    );
    if (controls.hostFailure)
      return new Response(JSON.stringify({ message: "Controlled host failure" }), { status: 503 });
    const method = init?.method ?? "GET";
    const transport = mem.client as SupabaseClient;
    if (method === "PATCH") controls.saves++;
    assert.ok(["PATCH", "POST", "GET"].includes(method));
    let query =
      method === "PATCH"
        ? transport.from(table).update(JSON.parse(String(init?.body)))
        : method === "POST"
          ? transport.from(table).insert(JSON.parse(String(init?.body)))
          : transport.from(table).select("*");
    for (const [key, value] of url.searchParams) {
      if (key === "select") continue;
      if (value.startsWith("eq.")) query = query.eq(key, value.slice(3));
      else if (value === "is.null") query = query.is(key, null);
      else throw new Error(`Unhandled host filter ${key}`);
    }
    const result = await query.select("*");
    const headers = new Headers(init?.headers);
    const object = headers.get("accept")?.includes("vnd.pgrst.object");
    return new Response(JSON.stringify(object ? (result.data?.[0] ?? null) : result.data), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  return {
    tenantId,
    other,
    userId,
    email,
    mem,
    db,
    actor,
    controls,
    restore() {
      globalThis.fetch = oldFetch;
      if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
      if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
    },
  };
}
