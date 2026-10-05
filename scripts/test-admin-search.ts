import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server";
import {
  normalizeSearchQuery,
  parseSearchResponse,
  searchRecordHref,
} from "../src/lib/admin/workspace-search";
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
    "tasks",
    "opportunities",
    "clients",
    "proposals",
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
  for (const [table, row] of Object.entries({
    tasks: {
      id: "task-1",
      title: "Owner review",
      status: "in_progress",
      related_name: "Test Owner",
    },
    opportunities: { id: "opportunity-1", name: "Owner expansion", stage: "negotiation" },
    clients: {
      id: "client-1",
      business_name: "Owner Studio",
      contact_name: "Test Owner",
      contact_email: "owner@example.test",
      status: "active",
    },
    proposals: {
      id: "proposal-1",
      title: "Owner scope",
      client_name: "Owner Studio",
      status: "sent",
    },
  })) {
    memory.tables[table] = [
      { ...row, tenant_id: tenantId },
      { ...row, id: `foreign-${row.id}`, tenant_id: foreignId },
    ];
  }
  // Model the row isolation supplied by production RLS in this in-memory fixture.
  let authorization: unknown = {
    tenant: { config: { modules: { clients: true, proposals: true } } },
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
        name === "@/lib/admin/auth"
          ? { requireAdmin: async () => authorization }
          : require(name.startsWith("@/") ? resolve("src", name.slice(2)) : name),
    },
  );
  const get = (query: string, scope = "workspace") =>
    exported.GET!(
      new NextRequest(
        `https://example.test/api/admin/search?scope=${scope}&q=${encodeURIComponent(query)}`,
      ),
    );
  let response = await get("owner");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.results, [
    { name: "Test Owner", email: "owner@example.test", type: "Canonical contact" },
  ]);
  assert.deepEqual(
    body.records.map((row: { kind: string; id: string }) => [row.kind, row.id]),
    [
      ["work", "task-1"],
      ["opportunities", "opportunity-1"],
      ["clients", "client-1"],
      ["proposals", "proposal-1"],
    ],
  );
  for (const row of body.records) assert.equal(row.href, searchRecordHref(row.kind, row.id));
  assert.equal(body.records[0].description, "Test Owner · in progress");
  assert.equal(parseSearchResponse(body).length, 5);
  assert.throws(() =>
    parseSearchResponse({
      results: [],
      records: [{ ...body.records[0], href: "https://evil.example" }],
    }),
  );
  assert.throws(() =>
    parseSearchResponse({
      results: [],
      records: [{ ...body.records[0], href: "/admin/settings" }],
    }),
  );
  assert.throws(() => parseSearchResponse({ results: [], records: null as never }));
  assert.equal(normalizeSearchQuery("x".repeat(200)).length, 100);
  memory.tables.tasks!.push(
    {
      tenant_id: tenantId,
      id: "literal",
      title: "review_owner",
      status: "pending",
      related_name: null,
    },
    {
      tenant_id: tenantId,
      id: "wildcard",
      title: "reviewXowner",
      status: "pending",
      related_name: null,
    },
  );
  assert.deepEqual(
    (await (await get("review_owner")).json()).records.map((row: { id: string }) => row.id),
    ["literal"],
    "underscore remains literal",
  );
  assert.deepEqual(await (await get("%*%")).json(), { results: [], records: [] });
  memory.tables.tasks = memory.tables.tasks!.filter(
    (row) => !["literal", "wildcard"].includes(String(row.id)),
  );
  memory.tables.chat_leads = [{ tenant_id: tenantId, name: null, email: "unnamed@example.test" }];
  assert.equal(
    (await (await get("unnamed")).json()).results[0].name,
    "unnamed@example.test",
    "unnamed captures remain searchable",
  );
  memory.tables.chat_leads = [];
  const before = memory.queryTables.length;
  assert.deepEqual(await (await get("a")).json(), { results: [], records: [] });
  assert.equal(memory.queryTables.length, before, "short queries do not read records");
  assert.deepEqual(await (await get('owner),(tenant_id.eq.foreign)"')).json(), {
    results: [],
    records: [],
  });
  for (const table of tables) {
    memory.fail(table, { message: "Controlled private database error", code: "XX000" });
    response = await get("owner");
    assert.equal(
      response.status,
      503,
      `${table} failure must not become an empty or partial success`,
    );
    assert.deepEqual(await response.json(), {
      error: "Workspace search is temporarily unavailable. Try again.",
    });
    memory.recover(table);
  }
  assert.equal((await get("owner")).status, 200, "same query recovers after a failed read");
  assert.deepEqual(await (await get("missing-person")).json(), { results: [], records: [] });
  const beforePeopleOnly = memory.queryTables.length;
  for (const table of ["tasks", "opportunities", "clients", "proposals"])
    memory.fail(table, { message: "Unrelated record source unavailable" });
  const peopleOnly = await get("owner", "people");
  assert.equal(
    peopleOnly.status,
    200,
    "person attachments remain available when unrelated records fail",
  );
  const peopleBody = await peopleOnly.json();
  assert.equal(peopleBody.records.length, 0);
  assert.equal(peopleBody.results[0].email, "owner@example.test");
  assert(
    memory.queryTables.slice(beforePeopleOnly).every((table) => tables.slice(0, 5).includes(table)),
    "people-only callers never read unrelated records",
  );
  for (const table of ["tasks", "opportunities", "clients", "proposals"]) memory.recover(table);
  const actor = authorization as { tenant: { config: { modules: Record<string, boolean> } } };
  actor.tenant.config.modules = { clients: false, proposals: false };
  const queriedBeforeDisabled = memory.queryTables.length;
  memory.fail("clients", { message: "Disabled table must not be read" });
  memory.fail("proposals", { message: "Disabled table must not be read" });
  const disabled = await get("owner");
  assert.equal(disabled.status, 200);
  assert.deepEqual(
    (await disabled.json()).records.map((row: { kind: string }) => row.kind),
    ["work", "opportunities"],
  );
  assert(
    !memory.queryTables
      .slice(queriedBeforeDisabled)
      .some((table) => ["clients", "proposals"].includes(table)),
    "disabled sources never queried",
  );
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
    "Admin search: canonical identity, tenant scope, sanitization, short/empty results, all nine read failures and disabled-module gates, recovery and authorization passed.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
