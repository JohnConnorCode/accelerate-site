import assert from "node:assert/strict";
import { handleMcpRequest } from "../../src/lib/revenue-os/mcp-server";
import { toActivatedOpenRouterTools } from "../../src/lib/revenue-os/ai-tools";
import { bindTenantDatabaseForTest } from "../../src/lib/supabase/server";
import { tenant } from "../../src/config/tenant";
import { MemorySupabase } from "./memory-supabase";

type Definition = { name: string; description: string; inputSchema: object };
type Profile = "full" | "core" | "ops";

/** Deterministic task fixtures, not model selection, quality, latency or token benchmarks. */
export async function proveToolProfileTasks() {
  const previousFetch = globalThis.fetch;
  let networkRequests = 0;
  globalThis.fetch = async () => {
    networkRequests++;
    throw new Error("Profile proof must not access a provider or network");
  };
  const results = [];
  try {
    for (const profile of ["full", "core", "ops"] as const) {
      const mem = new MemorySupabase({
        tenants: [{ id: "profile-tenant", status: "active", config: {} }],
        tasks: [{ id: "profile-task", title: "Review fixture deliverable", status: "open" }],
        plugins: [
          {
            plugin_key: "fixture-plugin",
            name: "Fixture reporting",
            status: "enabled",
            version: "1.0.0",
          },
        ],
        action_queue: [],
      });
      const context = {
        supabase: bindTenantDatabaseForTest(mem.client, "profile-tenant"),
        actorEmail: "profile-review@example.test",
        tenantSlug: "accelerate",
        tenantConfig: tenant,
        toolProfile: profile as Profile,
      };
      const rpc = async (method: string, params?: Record<string, unknown>) => {
        const response = await handleMcpRequest({ jsonrpc: "2.0", id: 1, method, params }, context);
        assert.ok(response && !response.error, JSON.stringify(response?.error));
        return response.result;
      };
      const initial = (await rpc("tools/list")) as { tools: Definition[] };
      assert.ok(initial.tools.every((tool) => tool.description && tool.inputSchema));
      const initialDefinitionBytes = Buffer.byteLength(JSON.stringify(initial.tools), "utf8");
      const call = async (name: string, args: Record<string, unknown>) => {
        const result = (await rpc("tools/call", { name, arguments: args })) as {
          isError: boolean;
          content: { text: string }[];
        };
        assert.equal(result.isError, false, result.content[0]?.text);
        return JSON.parse(result.content[0]!.text);
      };
      const tasks = [];
      for (const task of [
        {
          name: "prepare-task-completion",
          tool: "propose_task_update",
          query: "task",
          args: { taskId: "profile-task", changeType: "complete" },
        },
        {
          name: "inspect-enabled-plugins",
          tool: "get_plugins",
          query: "plugin",
          args: { status: "enabled" },
        },
      ]) {
        let discoveryCalls = 0;
        let activatedDefinitionBytes = 0;
        if (!initial.tools.some((tool) => tool.name === task.tool)) {
          assert.ok(initial.tools.some((tool) => tool.name === "discover_tool_bundles"));
          assert.ok(initial.tools.some((tool) => tool.name === "activate_tool_bundle"));
          let offset: number | null = 0;
          let selected: { bundleId: string; toolNames: string[] } | undefined;
          do {
            const page = await call("discover_tool_bundles", { query: task.query, offset });
            discoveryCalls++;
            selected = page.bundles.find((bundle: { toolNames: string[] }) =>
              bundle.toolNames.includes(task.tool),
            );
            offset = page.nextOffset;
          } while (!selected && offset !== null);
          assert.ok(selected, `${task.tool} must remain discoverable from ${profile}`);
          const activated = await call("activate_tool_bundle", { bundleId: selected.bundleId });
          discoveryCalls++;
          assert.equal(activated.grantsApproval, false);
          assert.ok(activated.toolNames.includes(task.tool));
          // The owning command host resolves activated schemas from the same registry.
          // MCP activation itself returns names; this is not a claim that tools/list changes.
          const definitions = toActivatedOpenRouterTools(activated.activeBundleId, context);
          assert.ok(definitions.some((tool) => tool.function.name === task.tool));
          activatedDefinitionBytes = Buffer.byteLength(JSON.stringify(definitions), "utf8");
        }
        const output = await call(task.tool, task.args);
        if (task.tool === "propose_task_update") {
          assert.equal(output.action_type, "update_task");
          assert.equal(mem.rows("action_queue").length, 1);
          assert.equal(mem.rows("action_queue")[0]!.status, "pending");
          const proposed = mem.rows("action_queue")[0]!;
          assert.equal(proposed.entity_id, "profile-task");
          assert.equal((proposed.payload as Record<string, unknown>).taskId, "profile-task");
          assert.equal((proposed.payload as Record<string, unknown>).changeType, "complete");
          assert.equal(
            mem.rows("tasks")[0]!.status,
            "open",
            "Proposal must not complete the task before approval",
          );
        } else {
          assert.equal(output.length, 1);
          assert.equal(output[0].plugin_key, "fixture-plugin");
          assert.equal(output[0].status, "enabled");
        }
        tasks.push({
          task: task.name,
          completed: true,
          discoveryCalls,
          executionCalls: 1,
          activatedDefinitionBytes,
        });
      }
      results.push({ profile, toolCount: initial.tools.length, initialDefinitionBytes, tasks });
    }
    const full = results[0]!;
    for (const profile of results.slice(1)) {
      assert.ok(profile.initialDefinitionBytes < full.initialDefinitionBytes);
      assert.deepEqual(
        profile.tasks.map((task) => [task.task, task.completed]),
        full.tasks.map((task) => [task.task, task.completed]),
      );
      assert.ok(
        profile.tasks.some((task) => task.discoveryCalls > 0),
        "Each bounded profile must exercise discovery",
      );
    }
    assert.equal(networkRequests, 0);
    return {
      result: "passed",
      measurement:
        "UTF-8 JSON bytes of actual MCP tools/list definitions; activated host schemas reported separately",
      interpretation:
        "Two scripted fixture tasks per profile; proposal creation is the completed task, not approval or business execution. No model-quality, token, latency or provider-cost claim.",
      networkRequests,
      profiles: results,
    };
  } finally {
    globalThis.fetch = previousFetch;
  }
}
