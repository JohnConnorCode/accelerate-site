import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server";
import { MemorySupabase } from "./lib/memory-supabase";
import { bindTenantDatabase } from "../src/lib/supabase/server";

async function main() {
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const foreignId = "22222222-2222-4222-8222-222222222222";
  const tables = [
    "contacts",
    "solution_requests",
    "contact_submissions",
    "subscribers",
    "chat_leads",
  ];
  const memory = new MemorySupabase({
    contacts: [
      { tenant_id: tenantId, full_name: "Test Owner", primary_email: "owner@example.test" },
      {
        tenant_id: foreignId,
        full_name: "Foreign Owner",
        primary_email: "foreign-owner@example.test",
      },
    ],
    solution_requests: [
      { tenant_id: tenantId, contact_name: "Legacy Owner", contact_email: "owner@example.test" },
    ],
  });
  // Model the row isolation supplied by production RLS in this in-memory fixture.
  let authorization: unknown = {
    database: bindTenantDatabase(memory.client as never, tenantId, true),
  };
  const require = createRequire(resolve("package.json"));
  const exported: { GET?: (request: NextRequest) => Promise<NextResponse> } = {};
  runInNewContext(
    ts.transpileModule(readFileSync("src/app/api/admin/search/route.ts", "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports: exported,
      URL,
      require: (name: string) =>
        name === "@/lib/admin/auth" ? { requireAdmin: async () => authorization } : require(name),
    },
  );
  const get = (query: string) =>
    exported.GET!(
      new NextRequest(`https://example.test/api/admin/search?q=${encodeURIComponent(query)}`),
    );
  let response = await get("owner");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    results: [{ name: "Test Owner", email: "owner@example.test", type: "Canonical contact" }],
  });
  const before = memory.queryTables.length;
  assert.deepEqual(await (await get("a")).json(), { results: [] });
  assert.equal(memory.queryTables.length, before, "short queries do not read records");
  assert.deepEqual(await (await get('owner),(tenant_id.eq.foreign)"')).json(), { results: [] });
  for (const table of tables) {
    memory.fail(table, { message: "Controlled private database error", code: "XX000" });
    response = await get("owner");
    assert.equal(
      response.status,
      503,
      `${table} failure must not become an empty or partial success`,
    );
    assert.deepEqual(await response.json(), {
      error: "People search is temporarily unavailable. Try again.",
    });
    memory.recover(table);
  }
  assert.equal((await get("owner")).status, 200, "same query recovers after a failed read");
  assert.deepEqual(await (await get("missing-person")).json(), { results: [] });
  for (const status of [401, 403]) {
    authorization = NextResponse.json({ error: "Not authorized" }, { status });
    const queried = memory.queryTables.length;
    assert.equal((await get("owner")).status, status);
    assert.equal(
      memory.queryTables.length,
      queried,
      "authorization failure precedes all data reads",
    );
  }
  console.log(
    "Admin search: canonical identity, tenant scope, sanitization, short/empty results, all five read failures, recovery and authorization passed.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
