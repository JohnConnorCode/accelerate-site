import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createCollectionsFixture } from "./lib/collections-fixture";
import {
  executeRegisteredRevenueTool,
  getRevenueAiTools,
  listRevenueAiCapabilities,
  toOpenRouterTools,
  AI_TOOL_REGISTRY_VERSION,
} from "../src/lib/revenue-os/ai-tools";
import {
  readCollectionAgentContext,
  previewCollectionAgentReminder,
  proposeCollectionAgentReminder,
} from "../src/lib/revenue-os/collection-agent";
import { COLLECTION_AGENT_TOOL_NAMES } from "../src/lib/revenue-os/collection-agent-contract";
import { previewCollectionReminder } from "../src/lib/revenue-os/collection-reminders";
import { handleMcpRequest } from "../src/lib/revenue-os/mcp-server";
import { tenant as defaultTenant } from "../src/config/tenant";
import { DEMO_SCENARIOS } from "../src/lib/admin/demo/scenarios";
import { installAdminDemoRuntime } from "../src/lib/admin/demo/runtime";

type ContextResult = Awaited<ReturnType<typeof readCollectionAgentContext>>;
type PreviewResult = Awaited<ReturnType<typeof previewCollectionAgentReminder>>;
type ProposalResult = Awaited<ReturnType<typeof proposeCollectionAgentReminder>>;
async function main() {
  const f = createCollectionsFixture();
  const context = {
    supabase: f.db,
    actorEmail: "operator@example.test",
    workItemId: f.workItemId,
    tenantConfig: { modules: { "receivables-collections": true, "stripe-invoicing": true } },
  };
  const mcpContext = { ...context, tenantConfig: { ...defaultTenant, ...context.tenantConfig } };
  const call = async <T>(name: string, input: Record<string, unknown>) =>
    (await executeRegisteredRevenueTool(context, name, input)).output as T;
  const mcp = async (name: string, input: Record<string, unknown>) => {
    const response = await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: randomUUID(),
        method: "tools/call",
        params: { name, arguments: input },
      },
      mcpContext,
    );
    assert.ok(response?.result && !response.error);
    return response.result as { content: { type: string; text: string }[]; isError: boolean };
  };
  const config = () => f.table("tenants")[0]!.config as { modules: Record<string, boolean> };
  const pending = () =>
    f.table("action_queue").filter((a) => a.action_type === "send_collection_reminder");
  try {
    for (const name of COLLECTION_AGENT_TOOL_NAMES) {
      assert.ok(getRevenueAiTools("core").some((t) => t.name === name));
      assert.ok(getRevenueAiTools("outreach").some((t) => t.name === name));
      assert.ok(
        toOpenRouterTools("core", context.tenantConfig).some((t) => t.function.name === name),
      );
      assert.ok(listRevenueAiCapabilities(context).find((t) => t.name === name)?.available);
      const disabled = { modules: { "receivables-collections": false } };
      assert.equal(
        listRevenueAiCapabilities({ tenantConfig: disabled }).find((t) => t.name === name)
          ?.available,
        false,
      );
      assert.equal(
        toOpenRouterTools("core", disabled).some((t) => t.function.name === name),
        false,
      );
      await assert.rejects(
        () => executeRegisteredRevenueTool({ ...context, toolPack: "pipeline" }, name, {}),
        /not available/,
      );
    }
    assert.equal(
      getRevenueAiTools().find((t) => t.name === "get_collection_cases")!.connectionRequirement,
      "none",
    );
    for (const name of ["preview_collection_reminder", "propose_collection_reminder"])
      assert.equal(
        getRevenueAiTools().find((t) => t.name === name)!.connectionRequirement,
        "host_verified",
      );
    for (const enabled of [false, true]) {
      const response = await handleMcpRequest(
        { jsonrpc: "2.0", id: 1, method: "tools/list" },
        {
          ...mcpContext,
          tenantConfig: { ...defaultTenant, modules: { "receivables-collections": enabled } },
        },
      );
      const listed = (response!.result as { tools: { name: string }[] }).tools.map((t) => t.name);
      for (const name of COLLECTION_AGENT_TOOL_NAMES) assert.equal(listed.includes(name), enabled);
    }
    for (const input of [
      { maxCases: 0 },
      { maxCases: 11 },
      { maxCases: 1.5 },
      { tenantId: randomUUID() },
      { caseId: "invalid" },
    ])
      await assert.rejects(() => call("get_collection_cases", input));
    const foreignCase = randomUUID();
    f.table("collection_cases").push({
      ...f.row(),
      id: foreignCase,
      tenant_id: randomUUID(),
      updated_at: "2999-01-01",
    });
    const stored = await call<ContextResult>("get_collection_cases", {});
    assert.equal(stored.cases.length, 1);
    assert.equal(stored.cases[0]!.caseId, f.caseId);
    assert.equal(stored.cases[0]!.contactId, f.contact);
    assert.equal(stored.cases[0]!.invoices[0]!.observationId, f.observation);
    assert.equal(stored.cases[0]!.invoices[0]!.creationActionId, f.invoiceAction);
    assert.equal(stored.cases[0]!.observedOpenBalanceMinorUnits, 7500);
    assert.equal(stored.cases[0]!.work[0]!.id, f.workItemId);
    assert.equal(stored.cases[0]!.invoices[0]!.observedAt, "2025-01-02T00:00:00.000Z");
    assert.match(stored.source, /not a live/);
    assert.equal(f.state.reads, 0);
    await assert.rejects(
      () => call("get_collection_cases", { caseId: foreignCase }),
      /unavailable/,
    );
    assert.equal(
      (await call<ContextResult>("get_collection_cases", { contactId: randomUUID() })).cases.length,
      0,
    );
    const originalCases = [...f.table("collection_cases")];
    // If limit is applied only after reading, this older case's missing invoice
    // evidence would poison the otherwise complete first case.
    f.table("collection_cases").push({ ...f.row(), id: randomUUID(), updated_at: "2000-01-01" });
    const limited = await call<ContextResult>("get_collection_cases", { maxCases: 1 });
    assert.equal(limited.cases.length, 1);
    assert.equal(limited.truncated, true);
    assert.equal(
      (await call<ContextResult>("get_collection_cases", { caseId: f.caseId })).truncated,
      false,
    );
    f.mem.tables.collection_cases = originalCases;
    const observations = f.table("collection_observations");
    f.mem.tables.collection_observations = [];
    await assert.rejects(
      () => call("get_collection_cases", { caseId: f.caseId }),
      /Incomplete invoice evidence/,
    );
    f.mem.tables.collection_observations = observations;
    const refs = f.table("collection_case_invoices");
    f.mem.tables.collection_case_invoices = [];
    await assert.rejects(
      () => call("get_collection_cases", { caseId: f.caseId }),
      /incomplete invoice evidence/,
    );
    f.mem.tables.collection_case_invoices = refs;
    const savedRefs = [...refs],
      savedObservations = [...observations];
    for (let i = 0; i < 26; i++) {
      const observationId = randomUUID(),
        creationId = randomUUID();
      refs.push({
        tenant_id: f.tenant,
        case_id: f.caseId,
        creation_action_id: creationId,
        observation_id: observationId,
      });
      observations.push({
        ...savedObservations[0]!,
        id: observationId,
        invoice_id: `in_more${i}`,
        remaining: 100,
      });
    }
    const expanded = await call<ContextResult>("get_collection_cases", { caseId: f.caseId });
    assert.equal(expanded.cases[0]!.invoiceCount, 27);
    assert.equal(expanded.cases[0]!.invoices.length, 25);
    assert.equal(expanded.cases[0]!.invoicesTruncated, true);
    assert.equal(expanded.cases[0]!.observedOpenBalanceMinorUnits, 10100);
    assert.equal(expanded.summary.eligible.usd, 10100);
    f.mem.tables.collection_case_invoices = savedRefs;
    f.mem.tables.collection_observations = savedObservations;
    const originalInvoiceId = savedObservations[0]!.invoice_id;
    savedObservations[0]!.invoice_id = "in_" + "a".repeat(49_000);
    await assert.rejects(() => call("get_collection_cases", { caseId: f.caseId }), /48 KB/);
    savedObservations[0]!.invoice_id = originalInvoiceId;
    const readViaMcp = await mcp("get_collection_cases", { caseId: f.caseId });
    assert.equal(readViaMcp.isError, false);
    assert.equal(JSON.parse(readViaMcp.content[0]!.text).cases[0].caseId, f.caseId);
    assert.equal(f.state.reads, 0);

    const preview = await call<PreviewResult>("preview_collection_reminder", { caseId: f.caseId });
    const authoritative = await previewCollectionReminder(f.db, f.caseId);
    assert.equal(preview.digest, authoritative.digest);
    assert.equal(preview.text, authoritative.text);
    assert.equal(preview.to, "billing@example.test");
    assert.equal(preview.amountRemaining, 7500);
    assert.match(preview.subject, /^\[Test\]/);
    assert.equal(preview.testMode, true);
    assert.equal(preview.requiresHumanApproval, true);
    assert.equal("html" in preview, false);
    assert.equal("tenantId" in preview, false);
    assert.equal("providerAccount" in preview.invoices[0]!, false);
    assert.ok(Buffer.byteLength(JSON.stringify(preview)) < 48_000);
    assert.equal(pending().length, 0);
    for (const input of [
      { caseId: f.caseId, to: "attacker@example.test" },
      { caseId: f.caseId, amountRemaining: 1 },
      { caseId: foreignCase },
    ])
      await assert.rejects(() => call("preview_collection_reminder", input));
    await assert.rejects(() =>
      call("propose_collection_reminder", { caseId: f.caseId, digest: "invalid" }),
    );
    await assert.rejects(() =>
      call("propose_collection_reminder", {
        caseId: f.caseId,
        digest: preview.digest,
        approved: true,
      }),
    );

    const action = await call<ProposalResult>("propose_collection_reminder", {
      caseId: f.caseId,
      digest: preview.digest,
    });
    assert.equal(action.action_type, "send_collection_reminder");
    assert.equal(action.status, "pending");
    assert.equal(action.entity_id, f.caseId);
    assert.equal(action.work_item_id, f.workItemId);
    assert.equal(action.requiresHumanApproval, true);
    assert.equal("payload" in action, false);
    assert.equal(pending().length, 1);
    assert.equal(pending()[0]!.proposed_by, context.actorEmail);
    assert.equal(pending()[0]!.tenant_id, f.tenant);
    assert.ok((pending()[0]!.payload as { preview: { html: string } }).preview.html);
    const repeated = await mcp("propose_collection_reminder", {
      caseId: f.caseId,
      digest: preview.digest,
    });
    assert.equal(repeated.isError, false);
    assert.equal(JSON.parse(repeated.content[0]!.text).id, action.id);
    assert.equal(pending().length, 1);
    const contextAfter = await call<ContextResult>("get_collection_cases", { caseId: f.caseId });
    assert.deepEqual(contextAfter.cases[0]!.recentActions, [
      { actionId: action.id, status: "pending" },
    ]);
    assert.equal(JSON.stringify(contextAfter).includes("<html"), false);

    async function refuses(change: () => void, restore: () => void) {
      change();
      try {
        await assert.rejects(() =>
          call("propose_collection_reminder", { caseId: f.caseId, digest: preview.digest }),
        );
        const result = await mcp("propose_collection_reminder", {
          caseId: f.caseId,
          digest: preview.digest,
        });
        assert.equal(result.isError, true);
        assert.equal(pending().length, 1);
        assert.equal(f.state.sends, 0);
      } finally {
        restore();
      }
    }
    await refuses(
      () => {
        f.state.balance = 0;
      },
      () => {
        f.state.balance = 7500;
      },
    );
    await refuses(
      () => {
        f.row().disputed = true;
      },
      () => {
        f.row().disputed = false;
      },
    );
    await refuses(
      () => {
        f.row().paused = true;
      },
      () => {
        f.row().paused = false;
      },
    );
    await refuses(
      () => {
        f.table("contacts")[0]!.primary_email = "changed@example.test";
      },
      () => {
        f.table("contacts")[0]!.primary_email = "billing@example.test";
      },
    );
    await refuses(
      () => {
        f.table("contacts")[0]!.communication_status = "unsubscribed";
      },
      () => {
        f.table("contacts")[0]!.communication_status = "active";
      },
    );
    await refuses(
      () => {
        f.state.providerFailure = true;
      },
      () => {
        f.state.providerFailure = false;
      },
    );
    const before = f.state.reads;
    await refuses(
      () => {
        config().modules["receivables-collections"] = false;
      },
      () => {
        config().modules["receivables-collections"] = true;
      },
    );
    assert.equal(
      f.state.reads,
      before,
      "Stale enabled discovery cannot bypass the live module gate",
    );
    await refuses(
      () => {
        f.table("tenants")[0]!.status = "suspended";
      },
      () => {
        f.table("tenants")[0]!.status = "active";
      },
    );
    assert.equal(f.state.reads, before);
    await assert.rejects(
      () => call("send_collection_reminder", { id: action.id }),
      /not registered/,
    );
    assert.equal(f.state.sends, 0);
    assert.equal(
      f.mem.rpcCalls.some((r) => r.name === "reserve_collection_reminder"),
      false,
    );
    assert.equal(pending()[0]!.status, "pending");
    console.log(
      "PASS: bounded canonical reads, query-window isolation, verified preview parity, compact pending receipts, work/actor provenance, MCP replay, stale/suppressed/provider/disable refusals and no send authority.",
    );
  } finally {
    f.restore();
  }

  // Exercise the shared fictional runtime's actual HTTP adapter, not a copied
  // capability fixture. Every scenario uses the shared version/tool metadata.
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window"),
    oldStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const values = new Map<string, string>();
  let escaped = 0;
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      fetch: async () => {
        escaped++;
        throw new Error("Demo request escaped");
      },
      open: () => null,
      location: { origin: "https://demo.example", reload: () => {} },
      dispatchEvent: () => true,
    },
  });
  try {
    for (const pack of Object.values(DEMO_SCENARIOS)) {
      const runtime = installAdminDemoRuntime(pack.id);
      try {
        const read = async () =>
          (await (await window.fetch("/api/admin/revenue-os/ai/capabilities")).json()) as {
            registryVersion: string;
            capabilities: { name: string; state: string }[];
          };
        let result = await read();
        assert.equal(result.registryVersion, AI_TOOL_REGISTRY_VERSION);
        for (const name of COLLECTION_AGENT_TOOL_NAMES)
          assert.equal(result.capabilities.find((t) => t.name === name)?.state, "available");
        const toggle = await window.fetch("/api/admin/tenant/modules", {
          method: "PATCH",
          body: JSON.stringify({ moduleId: "receivables-collections", enabled: false }),
        });
        assert.equal(toggle.status, 200);
        result = await read();
        for (const name of COLLECTION_AGENT_TOOL_NAMES)
          assert.equal(result.capabilities.find((t) => t.name === name)?.state, "unavailable");
      } finally {
        runtime.restore();
      }
    }
    assert.equal(escaped, 0);
    console.log(
      "PASS: all five demo runtime capability responses share live tool metadata/version and respect plugin disablement without escaped requests.",
    );
  } finally {
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (oldStorage) Object.defineProperty(globalThis, "sessionStorage", oldStorage);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
