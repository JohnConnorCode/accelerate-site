import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import { MemorySupabase } from "./lib/memory-supabase";
import { bindTenantDatabaseForTest } from "../src/lib/supabase/server";
import { executeRegisteredRevenueTool, getRevenueAiTools } from "../src/lib/revenue-os/ai-tools";
import { handleMcpRequest } from "../src/lib/revenue-os/mcp-server";
import * as analytics from "../src/lib/revenue-os/analytics";
import * as registeredTools from "../src/lib/revenue-os/ai-tools";
import * as toolProfiles from "../src/lib/revenue-os/tool-profiles";
import * as reporting from "../src/lib/revenue-os/reporting-contract";
import { MAX_TOOL_RESULT_CONTEXT_CHARS } from "../src/lib/revenue-os/ai-context";

const tenantId = "11111111-1111-4111-8111-111111111111";
const capturedAt = new Date(Date.now() - 86_400_000).toISOString();
const actorEmail = "admin@fictional.example";
const fixture = new MemorySupabase({
  entity_types: [],
  stage_events: [],
  conversations: [],
  messages: [],
  tenants: [{ id: tenantId, status: "active", config: {} }],
  tenant_memberships: [
    { tenant_id: tenantId, invited_email: actorEmail, role: "admin", status: "active" },
  ],
  kanban_columns: [
    {
      id: "new",
      tenant_id: tenantId,
      board_key: "pipeline",
      column_key: "new",
      label: "New",
      sort_order: 0,
      metadata: { role: "open" },
    },
    {
      id: "won",
      tenant_id: tenantId,
      board_key: "pipeline",
      column_key: "won",
      label: "Won",
      sort_order: 1,
      metadata: { role: "won" },
    },
  ],
  opportunities: [
    {
      id: "one",
      tenant_id: tenantId,
      stage: "new",
      source: "referral",
      owner_email: actorEmail,
      estimated_value: 100,
      won_value: 0,
      probability: 50,
      created_at: new Date().toISOString(),
    },
    {
      id: "two",
      tenant_id: tenantId,
      stage: "won",
      source: "website",
      owner_email: actorEmail,
      estimated_value: 200,
      won_value: 180,
      probability: 100,
      created_at: new Date().toISOString(),
    },
    {
      id: "foreign",
      tenant_id: "other",
      stage: "won",
      won_value: 90000,
      created_at: new Date().toISOString(),
    },
  ],
  clients: Array.from({ length: 7 }, (_, i) => ({
    id: `client-${i}`,
    tenant_id: tenantId,
    business_name: i === 0 ? "=HYPERLINK(unsafe)" : `Client ${i}`,
    status: "active",
    monthly_value: i + 1,
    one_time_value: 0,
    contract_start: "2026-01-01",
  })),
  proposals: [{ id: "proposal", tenant_id: tenantId, status: "accepted", total_monthly: 20 }],
  website_events: [
    {
      tenant_id: tenantId,
      event_name: "page_view",
      path: "/",
      visitor_id: "a",
      created_at: capturedAt,
    },
    {
      tenant_id: "other",
      event_name: "page_view",
      path: "/private",
      visitor_id: "b",
      created_at: new Date().toISOString(),
    },
  ],
});
const database = bindTenantDatabaseForTest(fixture.client, tenantId);
const context = { supabase: database, actorEmail, principalKind: "workspace_member" as const };

function route(path: string, denied = false) {
  const loadedModule = { exports: {} as { GET: (request: Request) => Promise<Response> } };
  vm.runInNewContext(
    ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports: loadedModule.exports,
      module: loadedModule,
      URL,
      console,
      require: (name: string) => {
        if (name === "next/server") return { NextResponse };
        if (name.endsWith("admin/auth"))
          return {
            requireAdmin: async () =>
              denied
                ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
                : { database, tenant: fixture.tables.tenants![0] },
          };
        if (name.endsWith("/ai-tools")) return registeredTools;
        if (name.endsWith("/tool-profiles")) return toolProfiles;
        if (name.endsWith("module-guard"))
          return {
            requireAdminForModule: async () =>
              denied
                ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
                : { database, tenant: { id: tenantId } },
          };
        if (name.endsWith("/analytics")) return analytics;
        if (name.endsWith("/reporting-contract")) return reporting;
        throw new Error(`Unexpected import: ${name}`);
      },
    },
  );
  return loadedModule.exports.GET;
}

async function main() {
  const snapshot = JSON.stringify(fixture.tables);
  const capabilityRoute = route("src/app/api/admin/revenue-os/ai/capabilities/route.ts");
  const capabilityPayload = await (
    await capabilityRoute(
      new Request("https://workspace.example/api/admin/revenue-os/ai/capabilities"),
    )
  ).json();
  assert.equal(
    capabilityPayload.readinessEvaluated,
    false,
    "registration cannot establish operational readiness",
  );
  assert.equal(capabilityPayload.coverage.universalCoverage, false);
  assert.ok(
    capabilityPayload.capabilities
      .filter((item: { state: string }) => item.state === "available")
      .every(
        (item: { operationalReadiness: string }) => item.operationalReadiness === "not_evaluated",
      ),
  );
  const revenueRoute = route("src/app/api/admin/revenue/route.ts");
  const dashboard = await (
    await revenueRoute(new Request("https://workspace.example/api/admin/revenue"))
  ).json();
  const revenue = (await executeRegisteredRevenueTool(context, "get_revenue_report", {}))
    .output as Awaited<ReturnType<typeof analytics.readRevenueReport>>;
  assert.ok("totalMRR" in revenue.data && "canonical" in revenue.data);
  assert.equal(revenue.data.totalMRR, dashboard.totalMRR);
  assert.equal(revenue.data.totalMRR, 28);
  assert.deepEqual(revenue.data.canonical, dashboard.canonical);
  assert.equal(revenue.data.canonical.wonRevenue, 180, "foreign workspace is excluded");
  const request = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "get_revenue_report", arguments: { section: "clients", limit: 2 } },
  };
  const response = await handleMcpRequest(request, context);
  const result = response?.result as { isError: boolean; content: { text: string }[] };
  assert.equal(result.isError, false);
  const page = JSON.parse(result.content[0]!.text);
  assert.equal(page.data.rows.length, 2);
  assert.equal(page.data.totalRows, 7);
  assert.equal(page.data.nextOffset, 2);
  assert.equal(page.data.truncated, true);
  const lastPage = await analytics.readRevenueReport(database, {
    section: "clients",
    offset: 6,
    limit: 1,
  });
  assert.ok("rows" in lastPage.data);
  assert.equal(lastPage.data.nextOffset, null);
  assert.equal(lastPage.data.truncated, true, "last page still omits prior rows");
  assert.equal(lastPage.data.offset, 6);
  assert.throws(
    () => analytics.exportReportingResult({ data: "x".repeat(4000) }, { format: "json" }),
    /evidence limit/,
  );

  const analyticsRoute = route("src/app/api/admin/revenue-os/analytics/route.ts");
  const funnel = await (
    await analyticsRoute(
      new Request("https://workspace.example/api/admin/revenue-os/analytics?source=website"),
    )
  ).json();
  const filtered = (
    await executeRegisteredRevenueTool(context, "get_revenue_analytics", {
      source: "website",
      section: "funnel",
    })
  ).output as Awaited<ReturnType<typeof analytics.readAnalyticsReport>>;
  assert.ok(filtered.data && "funnel" in filtered.data);
  assert.deepEqual(filtered.data?.funnel, funnel.funnel);
  assert.equal(funnel.funnel.wonRevenue, 180);
  const web = await analytics.loadWebsiteAnalytics(database, 30);
  assert.equal(web.pageViews, 1);
  assert.equal(
    web.lastCapturedAt,
    capturedAt,
    "freshness describes capture, not opening the report",
  );
  assert.equal(web.topPages[0]?.label, "/");
  const readsBeforeWebsite = fixture.queryTables.length;
  const website = await analytics.readAnalyticsReport(database, { section: "website" });
  assert.equal(website.status, "ready");
  assert.ok(
    !fixture.queryTables.slice(readsBeforeWebsite).includes("opportunities"),
    "website activity does not depend on unrelated opportunity storage",
  );
  for (const [name, input] of [
    ["get_revenue_report", { tenantId: "other" }],
    ["get_revenue_analytics", { days: 1000 }],
    ["get_revenue_analytics", { rawSql: "select *" }],
    ["get_revenue_report", { section: "cash" }],
    ["get_revenue_analytics", { section: "website", owner: actorEmail }],
  ] as const)
    await assert.rejects(executeRegisteredRevenueTool(context, name, input));
  for (const name of [
    "get_revenue_report",
    "get_revenue_analytics",
    "export_revenue_report",
    "export_revenue_analytics",
  ]) {
    const { output } = await executeRegisteredRevenueTool(context, name, {});
    assert.ok(
      JSON.stringify(output).length <= MAX_TOOL_RESULT_CONTEXT_CHARS,
      `${name} summary fits evidence budget`,
    );
  }
  const csv = (
    await executeRegisteredRevenueTool(context, "export_revenue_report", {
      section: "clients",
      offset: 6,
      format: "csv",
    })
  ).output as { contents: string };
  assert.ok(csv.contents.includes("'=HYPERLINK"), "CSV cells cannot become formulas");
  assert.equal(JSON.stringify(fixture.tables), snapshot, "reads and exports do not mutate");
  const beforeDenied = fixture.queryTables.length;
  assert.equal(
    (
      await route(
        "src/app/api/admin/revenue/route.ts",
        true,
      )(new Request("https://workspace.example"))
    ).status,
    401,
  );
  assert.equal(fixture.queryTables.length, beforeDenied);
  fixture.maxReadRows = 1;
  await assert.rejects(executeRegisteredRevenueTool(context, "get_revenue_report", {}), /Complete/);
  await assert.rejects(analytics.loadRevenueAnalytics(database, tenantId, 30), /Complete/);
  fixture.tables.website_events!.push({
    path: "/",
    visitor_id: "second",
    tenant_id: tenantId,
    event_name: "page_view",
    created_at: new Date().toISOString(),
  });
  await assert.rejects(analytics.loadWebsiteAnalytics(database, 30), /Complete/);
  fixture.maxReadRows = Infinity;
  fixture.fail("website_events", { message: "unavailable" });
  assert.equal(
    (await analytics.loadDashboardAnalytics(database, tenantId, {})).web?.status,
    "degraded",
  );
  fixture.recover("website_events");
  fixture.fail("conversations", { message: "unavailable" });
  const quality = await analytics.readAnalyticsReport(database, { section: "quality" });
  assert.ok(quality.data && "communication" in quality.data);
  const communication = quality.data.communication;
  assert.ok(
    communication &&
      "status" in communication &&
      "inboundConversations" in communication &&
      "repliedConversations" in communication,
  );
  assert.equal(communication.status, "degraded");
  assert.equal(communication.inboundConversations, null);
  assert.equal(communication.repliedConversations, null);
  fixture.recover("conversations");
  fixture.tables.tenants![0]!.config = { modules: { revenue: false, analytics: false } };
  for (const name of ["get_revenue_report", "get_revenue_analytics"])
    await assert.rejects(executeRegisteredRevenueTool(context, name, {}), /unavailable/);
  const hidden = (await handleMcpRequest({ jsonrpc: "2.0", id: 2, method: "tools/list" }, context))
    ?.result as { tools: { name: string }[] };
  assert.ok(
    !hidden.tools.some((tool) =>
      ["get_revenue_report", "get_revenue_analytics"].includes(tool.name),
    ),
  );
  fixture.tables.tenants![0]!.config = {};
  fixture.tables.tenant_memberships![0]!.status = "revoked";
  assert.ok(
    (await handleMcpRequest(request, context))?.error,
    "revoked member cannot read reports",
  );
  assert.ok(getRevenueAiTools().filter((tool) => tool.operation).length >= 4);
  console.log(
    "PASS: dashboard/AI/MCP report parity, filters, bounded drilldown, safe exports, source limits, tenant isolation, module and membership revocation.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
