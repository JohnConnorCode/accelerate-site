import assert from "node:assert/strict";
import type { MemorySupabase } from "./memory-supabase";
import type { TenantActorContext } from "../../src/lib/tenancy/context";

/** Exercise the real privileged client boundary without network or provider credentials. */
export async function withSiteHostTransport<T>(
  mem: MemorySupabase,
  actor: TenantActorContext,
  work: () => Promise<T>,
) {
  const previousFetch = globalThis.fetch;
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://site-fixture.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "controlled-site-host-key";
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "site-fixture.supabase.co");
    const operation = url.pathname.split("/").at(-1)!;
    assert.ok(["write_site_draft", "write_site_website"].includes(operation));
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("x-tenant-id"), actor.tenant.id);
    assert.equal(headers.get("authorization"), "Bearer controlled-site-host-key");
    const args = JSON.parse(String(init?.body));
    assert.equal(args.p_actor_email, actor.user.email ?? actor.user.id);
    const result = await mem.client.rpc(operation, args);
    return Response.json(result.error ?? result.data, { status: result.error ? 400 : 200 });
  };
  try {
    return await work();
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  }
}
