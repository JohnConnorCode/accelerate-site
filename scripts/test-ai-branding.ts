import type { SupabaseClient } from "@supabase/supabase-js";
import { handleMcpRequest } from "../src/lib/revenue-os/mcp-server";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { AuthorizedMemorySupabase } from "./lib/autonomy-fixture";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import { runWithTenantRequestContext, type TenantActorContext } from "../src/lib/tenancy/context";
import { executeRegisteredRevenueTool, toOpenRouterTools } from "../src/lib/revenue-os/ai-tools";
import { approveAndExecuteAction } from "../src/lib/revenue-os/action-executor";
import { readWorkspaceBrand, saveWorkspaceBrandAsAdmin } from "../src/lib/revenue-os/branding";
import { assertCurrentTenantAdmin } from "../src/lib/revenue-os/tenant-admin-authority";
import {
  previewWorkspaceBrandUpdate,
  proposeWorkspaceBrandUpdate,
} from "../src/lib/revenue-os/branding-actions";
import { BRANDING_TOOL_NAMES } from "../src/lib/revenue-os/branding-actions-contract";

async function main() {
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
  let saves = 0,
    hostFailure = false;
  // Exercise the real privileged Supabase client and shared CAS writer against
  // controlled REST transport, with no production connection or runtime injection seam.
  globalThis.fetch = async (raw, init) => {
    const url = new URL(String(raw));
    assert.equal(url.origin, "https://branding-fixture.example.test");
    const table = url.pathname.split("/").at(-1)!;
    assert.ok(["tenants", "audit_log"].includes(table), `Unexpected host table ${table}`);
    if (hostFailure)
      return new Response(JSON.stringify({ message: "Controlled host failure" }), { status: 503 });
    const method = init?.method ?? "GET";
    const transport = mem.client as SupabaseClient;
    if (method === "PATCH") saves++;
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
  try {
    for (const pack of ["core", "pipeline", "outreach"] as const)
      for (const name of BRANDING_TOOL_NAMES)
        assert.ok(toOpenRouterTools(pack).some((t) => t.function.name === name));
    const context = { supabase: db, actorEmail: email, toolPack: "pipeline" as const };
    await executeRegisteredRevenueTool(context, "get_workspace_brand", {});
    for (const input of [
      { changes: {} },
      { changes: { tenantId: other } },
      { changes: { inkColor: "#ffffff" } },
      { changes: { logoUrl: "javascript:bad" } },
      { changes: { version: 1 } },
    ])
      await assert.rejects(() => previewWorkspaceBrandUpdate(db, input));
    const changes = {
      accentColor: "#234567",
      name: "Updated Studio",
      logoUrl: "https://assets.example.test/logo.svg",
    };
    const preview = await previewWorkspaceBrandUpdate(db, { changes });
    assert.equal(preview.changes.length, 3);
    const staged = await executeRegisteredRevenueTool(context, "propose_workspace_brand_update", {
      changes,
      digest: preview.digest,
    });
    const action = staged.output as { id: string; status: string };
    const mcp = await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "propose_workspace_brand_update",
          arguments: { changes, digest: preview.digest },
        },
      },
      context,
    );
    const mcpResult = mcp?.result as { isError?: boolean; content: { text: string }[] };
    assert.equal(mcpResult.isError, false);
    assert.equal(JSON.parse(mcpResult.content[0]!.text).id, action.id);

    assert.equal(action.status, "pending");
    assert.equal((await readWorkspaceBrand(db)).brand.name, "Original Studio");
    assert.equal(saves, 0);
    assert.equal(
      (await proposeWorkspaceBrandUpdate(db, { changes, digest: preview.digest }, email)).id,
      action.id,
    );
    await assert.rejects(() => assertCurrentTenantAdmin(db, email), /authenticated/);
    await runWithTenantRequestContext(actor, async () => {
      const result = (await approveAndExecuteAction(db, action.id, email)) as {
        brand: { name: string };
      };
      assert.equal(result.brand.name, "Updated Studio");
      assert.equal(saves, 1);
      assert.equal(mem.rows("action_queue").find((a) => a.id === action.id)?.status, "executed");
      await assert.rejects(() => approveAndExecuteAction(db, action.id, email), /already handled/);
      assert.equal(saves, 1);
      assert.equal((mem.rows("tenants")[0]!.config as Record<string, unknown>).unrelated, "retain");
      assert.equal(
        (await readWorkspaceBrand(bindTenantDatabase(mem.client, other, true))).brand.name,
        "Other Studio",
      );
      await assert.rejects(
        () => assertCurrentTenantAdmin(db, "imposter@example.test"),
        /authenticated/,
      );
      await assert.rejects(
        () => assertCurrentTenantAdmin(bindTenantDatabase(mem.client, other, true), email),
        /authenticated/,
      );
      const next = { tagline: "Reviewed tagline" };
      const p = await previewWorkspaceBrandUpdate(db, { changes: next });
      const stale = await proposeWorkspaceBrandUpdate(
        db,
        { changes: next, digest: p.digest },
        email,
      );
      const current = await readWorkspaceBrand(db);
      await saveWorkspaceBrandAsAdmin(
        db,
        { ...current.brand, tagline: "Concurrent human edit" },
        current.revision,
        email,
      );
      await assert.rejects(() => approveAndExecuteAction(db, stale.id, email), /another session/);
      await assert.rejects(
        () => proposeWorkspaceBrandUpdate(db, { changes: next, digest: p.digest }, email),
        /preview changed/,
      );
      assert.equal((await readWorkspaceBrand(db)).brand.tagline, "Concurrent human edit");
      for (const scenario of ["revoked", "suspended", "tampered", "provider"] as const) {
        const draft = await previewWorkspaceBrandUpdate(db, { changes: next });
        const pending = await proposeWorkspaceBrandUpdate(
          db,
          { changes: next, digest: draft.digest },
          email,
        );
        const count: number = saves;
        if (scenario === "revoked") mem.rows("tenant_memberships")[0]!.status = "revoked";
        if (scenario === "suspended") mem.rows("tenants")[0]!.status = "suspended";
        if (scenario === "tampered")
          (
            mem.rows("action_queue").find((a) => a.id === pending.id)!.payload as Record<
              string,
              unknown
            >
          ).tenantId = other;
        if (scenario === "provider") hostFailure = true;
        await assert.rejects(() => approveAndExecuteAction(db, pending.id, email));
        assert.equal(saves, count);
        assert.equal(mem.rows("action_queue").find((a) => a.id === pending.id)?.status, "failed");
        mem.rows("tenant_memberships")[0]!.status = "active";
        mem.rows("tenants")[0]!.status = "active";
        hostFailure = false;
      }
      const p2 = await previewWorkspaceBrandUpdate(db, { changes: next });
      const autonomous = await proposeWorkspaceBrandUpdate(
        db,
        { changes: next, digest: p2.digest },
        email,
      );
      const count: number = saves;
      await assert.rejects(() =>
        approveAndExecuteAction(db, autonomous.id, email, { mode: "autonomous" }),
      );
      assert.equal(saves, count);
    });
    console.log(
      "PASS: branding registry preview/proposal, exact human-approved state change, shared direct save, CAS stale refusal, dedupe/replay, permissions/tenant denial, host failure, and no autonomous write.",
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
