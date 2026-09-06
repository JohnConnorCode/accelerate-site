import assert from "node:assert/strict";
import {
  buildToolBundles,
  rankToolBundles,
  ALWAYS_LOADED_AI_TOOLS,
} from "../src/lib/revenue-os/ai-tool-bundles";
import { REVENUE_OS_MODULES } from "../src/lib/revenue-os/modules";
import {
  availableRevenueToolBundles,
  getRevenueAiTools,
  toActivatedOpenRouterTools,
  executeRegisteredRevenueTool,
} from "../src/lib/revenue-os/ai-tools";
import { createAdminConfigurationFixture } from "./lib/admin-configuration-fixture";
import { handleMcpRequest } from "../src/lib/revenue-os/mcp-server";

async function main() {
  const actual = buildToolBundles(REVENUE_OS_MODULES, getRevenueAiTools());
  const reached = new Set(actual.flatMap((bundle) => bundle.toolNames));
  assert.equal(reached.size, getRevenueAiTools().length);
  for (const bundle of actual) assert.ok(toActivatedOpenRouterTools(bundle.bundleId).length <= 40);
  assert.throws(() => buildToolBundles([], [{ name: "orphan" }]), /Unreachable/);
  assert.throws(
    () =>
      buildToolBundles([{ id: "bad", name: "Bad", description: "", aiToolNames: ["unknown"] }], []),
    /ownership/,
  );
  assert.throws(
    () =>
      buildToolBundles(
        [{ id: "a", name: "A", description: "", aiToolNames: ["x", "x"] }],
        [{ name: "x" }],
      ),
    /ownership/,
  );
  // Fifty plugins, including an oversized plugin: chunking never loses a tool.
  const simulated = Array.from({ length: 50 }, (_, i) => ({
    id: `plugin-${i}`,
    name: `Business ${i}`,
    description: `specialty${i}`,
    aiToolNames: Array.from({ length: i === 0 ? 90 : 4 }, (_, j) => `specialty${i}_operation_${j}`),
  }));
  const tools = simulated.flatMap((moduleDef) => moduleDef.aiToolNames.map((name) => ({ name })));
  const bundles = buildToolBundles(simulated, tools);
  assert.equal(new Set(bundles.flatMap((b) => b.toolNames)).size, tools.length);
  assert.ok(bundles.every((b) => b.toolNames.length + ALWAYS_LOADED_AI_TOOLS.length <= 40));
  // Deterministic exact-domain benchmark, not a claim about LLM intent accuracy.
  for (const moduleDef of simulated) {
    const baseline = rankToolBundles(
      buildToolBundles(
        [moduleDef],
        moduleDef.aiToolNames.map((name) => ({ name })),
      ),
      moduleDef.id,
    )[0]!;
    const multi = rankToolBundles(bundles, moduleDef.id)[0]!;
    assert.equal(multi.moduleId, baseline.moduleId);
  }
  const f = createAdminConfigurationFixture();
  try {
    const context = { supabase: f.db, actorEmail: f.email };
    const { output } = await executeRegisteredRevenueTool(context, "discover_tool_bundles", {
      query: "branding",
    });
    assert.ok(JSON.stringify(output).includes("core-system:1"));
    assert.equal(f.controls.saves, 0);
    const all = await executeRegisteredRevenueTool(context, "discover_tool_bundles", {});
    assert.ok((all.output as { bundles: unknown[] }).bundles.length <= 8);
    for (const args of [
      { bundleId: "unknown:1" },
      { bundleId: "receivables-collections:1" },
      { bundleId: "core-system:1", approve: true },
    ]) {
      await assert.rejects(executeRegisteredRevenueTool(context, "activate_tool_bundle", args));
    }
    // Explicit legacy pack restrictions remain authoritative, including MCP.
    const restricted = { ...context, toolPack: "pipeline" as const };
    assert.ok(
      availableRevenueToolBundles(restricted).every(
        (b) => !b.toolNames.includes("propose_founder_note"),
      ),
    );
    const mcp = await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "activate_tool_bundle", arguments: { bundleId: "core-command:1" } },
      },
      restricted,
    );
    const result = mcp!.result as { isError: boolean; content: { text: string }[] };
    assert.equal(result.isError, false);
    const activated = JSON.parse(result.content[0]!.text);
    assert.equal(activated.activeBundleId, "core-command:1");
    assert.ok(activated.toolNames.includes("propose_task"));
    assert.ok(!activated.toolNames.includes("propose_founder_note"));
    await assert.rejects(
      executeRegisteredRevenueTool(restricted, "propose_founder_note", {
        body: "Cannot bypass pack",
      }),
      /unavailable/,
    );
    const disabled = { tenantConfig: { modules: { "receivables-collections": false } } };
    assert.ok(
      !toActivatedOpenRouterTools("receivables-collections:1", disabled).some((t) =>
        t.function.name.includes("collection"),
      ),
    );
    assert.equal(f.controls.saves, 0);
  } finally {
    f.restore();
  }
  console.log(
    JSON.stringify({
      result: "passed",
      registeredTools: reached.size,
      simulatedPlugins: 50,
      exactDomainSelection: "50/50 versus 1/1 per baseline",
      maxTools: 40,
    }),
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
