import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import { loadRevenueReport } from "../src/lib/revenue-os/analytics";
import { summarizeContractRevenue } from "../src/lib/revenue-os/revenue-metrics";
import { MemorySupabase } from "./lib/memory-supabase";

const tenant = "tenant-a";
const clients = [
  {
    id: "a",
    status: "active",
    business_name: "First",
    industry: "home_services",
    monthly_value: "1000.10",
    contract_start: "2026-01-01",
  },
  {
    id: "b",
    status: "active",
    business_name: "Second",
    industry: "home_services",
    monthly_value: 2000.2,
    contract_start: "2026-01-20",
  },
  {
    id: "c",
    status: "active",
    business_name: "Third",
    monthly_value: 0.3,
    contract_start: "invalid",
    created_at: "2026-03-01T00:00:00Z",
  },
  { id: "d", status: "active", business_name: "Undated", monthly_value: 300 },
  {
    id: "e",
    status: "churned",
    monthly_value: 500,
    one_time_value: 50,
    contract_start: "2026-01-01",
  },
  { id: "f", status: "onboarding", monthly_value: 900, contract_start: "2026-01-01" },
  { id: "g", status: "paused", monthly_value: 400, contract_start: "2026-01-01" },
];
const accepted = [{ id: "p", total_monthly: "700.25", status: "accepted" }];
const seeded = () =>
  new MemorySupabase({
    clients: [
      ...clients.map((row) => ({ ...row, tenant_id: tenant })),
      { id: "other", tenant_id: "tenant-b", status: "active", monthly_value: 999999 },
    ],
    proposals: [
      ...accepted.map((row) => ({ ...row, tenant_id: tenant })),
      { id: "draft", tenant_id: tenant, status: "draft", total_monthly: 999999 },
    ],
    opportunities: [
      {
        id: "open",
        tenant_id: tenant,
        stage: "new",
        estimated_value: 10000,
        probability: 30,
        won_value: 0,
      },
      {
        id: "won",
        tenant_id: tenant,
        stage: "won",
        estimated_value: 5000,
        probability: 100,
        won_value: 4500,
      },
      {
        id: "other",
        tenant_id: "tenant-b",
        stage: "new",
        estimated_value: 999999,
        probability: 100,
      },
    ],
    kanban_columns: [
      {
        tenant_id: tenant,
        board_key: "pipeline",
        column_key: "new",
        label: "New",
        metadata: { role: "open" },
        sort_order: 1,
      },
      {
        tenant_id: tenant,
        board_key: "pipeline",
        column_key: "won",
        label: "Won",
        metadata: { role: "won" },
        sort_order: 2,
      },
    ],
  });

// Execute the actual adapter; replace only request-bound authorization with controlled tenant fixtures.
function route(db: MemorySupabase, deniedStatus?: number) {
  const routeModule = { exports: {} as { GET: () => Promise<NextResponse> } };
  vm.runInNewContext(
    ts.transpileModule(readFileSync("src/app/api/admin/revenue/route.ts", "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module: routeModule,
      exports: routeModule.exports,
      require(name: string) {
        if (name === "next/server") return { NextResponse };
        if (name === "@/lib/revenue-os/analytics") return { loadRevenueReport };
        if (name === "@/lib/admin/module-guard")
          return {
            requireAdminForModule: async (owner: string) => {
              assert.equal(owner, "revenue");
              return deniedStatus
                ? NextResponse.json({ error: "Access denied" }, { status: deniedStatus })
                : { database: db.client, tenant: { id: tenant } };
            },
          };
        throw new Error(`Unexpected adapter import ${name}`);
      },
    },
  );
  return routeModule.exports.GET;
}

async function main() {
  const originalTimezone = process.env.TZ;
  try {
    for (const timezone of ["UTC", "America/Chicago"]) {
      process.env.TZ = timezone;
      const report = summarizeContractRevenue(clients, accepted);
      assert.equal(report.totalMRR, 3300.6);
      assert.equal(report.totalOneTime, 50);
      assert.equal(report.proposalRevenue, 700.25);
      assert.equal(report.activeCount, 4);
      assert.equal(report.churnRate, 17);
      assert.deepEqual(report.mrrTimeline, [
        { date: "Jan 26", mrr: 3000.3 },
        { date: "Mar 26", mrr: 3000.6 },
        { date: "Date unavailable", mrr: 3300.6 },
      ]);
      assert.deepEqual(report.timelineDates, { creationDateFallbackCount: 1, unknownDateCount: 1 });
      assert.equal(
        Math.round(report.byClient.reduce((sum, row) => sum + row.monthly * 100, 0)),
        report.totalMRR * 100,
      );
      assert.equal(
        Math.round(report.industryBreakdown.reduce((sum, row) => sum + row.value * 100, 0)),
        report.totalMRR * 100,
      );
    }
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
  for (const amount of [NaN, Infinity, -1, "bad"])
    assert.throws(() =>
      summarizeContractRevenue([{ status: "active", monthly_value: amount }], []),
    );
  assert.deepEqual(summarizeContractRevenue([], []).mrrTimeline, []);

  const db = seeded(),
    GET = route(db);
  const snapshot = JSON.stringify(db.tables);
  const response = await GET();
  assert.equal(response.status, 200);
  const report = await response.json();
  assert.equal(report.totalMRR, 3300.6);
  assert.equal(report.proposalRevenue, 700.25);
  assert.deepEqual(report.canonical, {
    openOpportunities: 1,
    pipelineValue: 10000,
    weightedValue: 3000,
    wonRevenue: 4500,
    opportunityCount: 2,
  });
  assert.deepEqual(await (await GET()).json(), report, "repeated reads agree");
  assert.equal(JSON.stringify(db.tables), snapshot, "reads must not write");
  for (const status of [401, 403]) {
    const unauthorized = seeded();
    assert.equal((await route(unauthorized, status)()).status, status);
    assert.deepEqual(unauthorized.queryTables, [], "denied access never queries data");
  }
  for (const source of ["clients", "proposals", "opportunities", "kanban_columns"]) {
    db.fail(source, { message: "private provider detail: secret" });
    const failed = await GET();
    assert.equal(failed.status, 503, source);
    const failure = await failed.json();
    assert.equal(failure.retryable, true);
    assert.equal("totalMRR" in failure, false);
    assert.equal(JSON.stringify(failure).includes("secret"), false);
    db.recover(source);
    assert.deepEqual(await (await GET()).json(), report, `${source} retry recovers`);
  }
  const empty = await (await route(new MemorySupabase())()).json();
  assert.equal(empty.totalMRR, 0);
  assert.equal(empty.canonical.opportunityCount, 0);
  for (const source of ["clients", "proposals", "opportunities", "kanban_columns"]) {
    const partial = new MemorySupabase({
      [source]: [
        { id: "one", tenant_id: tenant, status: "accepted", board_key: "pipeline" },
        { id: "two", tenant_id: tenant, status: "accepted", board_key: "pipeline" },
      ],
    });
    partial.maxReadRows = 1;
    assert.equal((await route(partial)()).status, 503, `${source} truncation is unavailable`);
  }
  for (const source of ["clients", "proposals", "opportunities"]) {
    const paged = new MemorySupabase({
      [source]: Array.from({ length: 1001 }, (_, i) => ({
        id: String(i).padStart(5, "0"),
        tenant_id: tenant,
        status: source === "proposals" ? "accepted" : "active",
        monthly_value: 1,
        total_monthly: 1,
        stage: "new",
        estimated_value: 1,
        probability: 100,
      })),
    });
    const full = await route(paged)();
    assert.equal(full.status, 200);
    const body = await full.json();
    assert.equal(
      source === "clients"
        ? body.totalMRR
        : source === "proposals"
          ? body.proposalRevenue
          : body.canonical.pipelineValue,
      1001,
    );
    assert.equal(paged.queryTables.filter((table) => table === source).length, 3);
    paged.rows(source).push(
      ...Array.from({ length: 4000 }, (_, i) => ({
        id: `extra-${i}`,
        tenant_id: tenant,
        status: "accepted",
      })),
    );
    assert.equal((await route(paged)()).status, 503, "over-budget totals are never partial");
  }
  console.log(
    "PASS: Revenue totals, UTC cohorts, tenant/module boundary, complete pagination, empty/error/retry and read-only replay.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
