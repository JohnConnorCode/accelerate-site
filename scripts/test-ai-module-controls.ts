import assert from "node:assert/strict";
import { createAdminConfigurationFixture } from "./lib/admin-configuration-fixture";
import { runWithTenantRequestContext } from "../src/lib/tenancy/context";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import {
  configurationDigest,
  readModuleConfiguration,
} from "../src/lib/revenue-os/module-configuration-read";
import {
  previewModuleConfiguration,
  proposeModuleConfiguration,
} from "../src/lib/revenue-os/module-actions";
import { updateModuleConfigurationAsAdmin } from "../src/lib/revenue-os/module-configuration";
import { approveAndExecuteAction } from "../src/lib/revenue-os/action-executor";
import { executeRegisteredRevenueTool, toOpenRouterTools } from "../src/lib/revenue-os/ai-tools";
import { MODULE_CONTROL_TOOL_NAMES } from "../src/lib/revenue-os/module-actions-contract";
import { handleMcpRequest } from "../src/lib/revenue-os/mcp-server";

async function main() {
  const f = createAdminConfigurationFixture();
  const moduleId = "receivables-collections";
  const context = { supabase: f.db, actorEmail: f.email, toolPack: "pipeline" as const };
  const current = async () => (await readModuleConfiguration(f.db, { moduleId })).modules[0]!;
  const propose = async (change: Record<string, unknown>) => {
    const preview = await previewModuleConfiguration(f.db, { change });
    const action = await proposeModuleConfiguration(
      f.db,
      { change, digest: preview.digest },
      f.email,
    );
    return { preview, action };
  };
  try {
    assert.equal(
      configurationDigest({ a: 1, b: { c: 2, d: 3 } }),
      configurationDigest({ b: { d: 3, c: 2 }, a: 1 }),
    );
    for (const pack of ["core", "pipeline", "outreach"] as const)
      for (const name of MODULE_CONTROL_TOOL_NAMES)
        assert.ok(toOpenRouterTools(pack).some((t) => t.function.name === name));
    assert.equal((await current()).enabled, false);
    assert.ok((await readModuleConfiguration(f.db, {})).modules.length >= 30);
    for (const change of [
      { moduleId: "unknown", enabled: true },
      { moduleId: "core-system", enabled: false },
      { moduleId, settings: { api_key: "bad" } },
      { moduleId, settings: { cooldownHours: 721 } },
      { moduleId, settings: {} },
      { moduleId, settings: { cooldownHours: 72 } },
      { moduleId, enabled: true, settings: {} },
      { moduleId, enabled: false },
      { moduleId, tenantId: f.other, enabled: true },
    ])
      await assert.rejects(() => previewModuleConfiguration(f.db, { change }));
    const enabled = await propose({ moduleId, enabled: true });
    const mcp = await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "propose_module_configuration",
          arguments: { change: { moduleId, enabled: true }, digest: enabled.preview.digest },
        },
      },
      context,
    );
    const result = mcp!.result as { isError: boolean; content: { text: string }[] };
    assert.equal(result.isError, false);
    assert.equal(JSON.parse(result.content[0]!.text).id, enabled.action.id);
    assert.equal(f.controls.saves, 0);
    assert.equal((await current()).enabled, false);
    await runWithTenantRequestContext(f.actor, async () => {
      await approveAndExecuteAction(f.db, enabled.action.id, f.email);
      assert.equal((await current()).enabled, true);
      assert.equal(f.controls.saves, 1);
      await assert.rejects(
        () => approveAndExecuteAction(f.db, enabled.action.id, f.email),
        /already handled/,
      );
      const settings = await propose({ moduleId, settings: { cooldownHours: 24 } });
      await approveAndExecuteAction(f.db, settings.action.id, f.email);
      assert.equal((await current()).settings.cooldownHours, 24);
      assert.equal(
        (f.mem.rows("tenants")[0]!.config as Record<string, unknown>).unrelated,
        "retain",
      );
      assert.equal(
        (
          await readModuleConfiguration(bindTenantDatabase(f.mem.client, f.other, true), {
            moduleId,
          })
        ).modules[0]!.enabled,
        false,
      );
      const stale = await propose({ moduleId, settings: { cooldownHours: 36 } });
      await updateModuleConfigurationAsAdmin(
        f.db,
        { moduleId, settings: { cooldownHours: 48 } },
        f.email,
      );
      const count = f.controls.saves;
      await assert.rejects(
        () => approveAndExecuteAction(f.db, stale.action.id, f.email),
        /changed/,
      );
      assert.equal(f.controls.saves, count);
      await assert.rejects(
        () =>
          proposeModuleConfiguration(
            f.db,
            { change: { moduleId, settings: { cooldownHours: 36 } }, digest: stale.preview.digest },
            f.email,
          ),
        /changed/,
      );
      const disabled = await propose({ moduleId, enabled: false });
      await approveAndExecuteAction(f.db, disabled.action.id, f.email);
      assert.equal((await current()).enabled, false);
      await assert.rejects(
        () =>
          executeRegisteredRevenueTool(
            {
              supabase: f.db,
              actorEmail: f.email,
              tenantConfig: { modules: { [moduleId]: true } },
            },
            "get_collection_cases",
            {},
          ),
        /unavailable/,
      );
      // Core configuration tools remain usable to re-enable a disabled module.
      const read = await executeRegisteredRevenueTool(context, "get_module_configuration", {
        moduleId,
      });
      assert.ok(read.output);
      // A stale enable must not install even a read-policy row before refusing.
      const bundledId = "business-pulse";
      await updateModuleConfigurationAsAdmin(
        f.db,
        { moduleId: bundledId, enabled: false },
        f.email,
      );
      const bundle = await propose({ moduleId: bundledId, enabled: true });
      const config = f.mem.rows("tenants")[0]!.config as { modules: Record<string, boolean> };
      config.modules[bundledId] = true;
      await assert.rejects(
        () =>
          updateModuleConfigurationAsAdmin(
            f.db,
            { moduleId: bundledId, enabled: true },
            f.email,
            bundle.preview.revision,
          ),
        /changed/,
      );
      assert.equal(f.mem.rows("entity_types").length, 0);
      await assert.rejects(() => approveAndExecuteAction(f.db, bundle.action.id, f.email));
      assert.equal(f.mem.rows("entity_types").length, 0);
      config.modules[bundledId] = false;
      const freshBundle = await propose({ moduleId: bundledId, enabled: true });
      await approveAndExecuteAction(f.db, freshBundle.action.id, f.email);
      const policies = f.mem.rows("entity_types").length;
      assert.ok(policies > 0);
      await updateModuleConfigurationAsAdmin(
        f.db,
        { moduleId: bundledId, enabled: false },
        f.email,
      );
      await updateModuleConfigurationAsAdmin(f.db, { moduleId: bundledId, enabled: true }, f.email);
      assert.equal(f.mem.rows("entity_types").length, policies);
      for (const scenario of [
        "revoked",
        "suspended",
        "foreign",
        "tampered",
        "host",
        "autonomous",
      ] as const) {
        const pending = await propose({ moduleId, enabled: true });
        const count = f.controls.saves;
        if (scenario === "revoked") f.mem.rows("tenant_memberships")[0]!.status = "revoked";
        if (scenario === "suspended") f.mem.rows("tenants")[0]!.status = "suspended";
        if (scenario === "foreign")
          (
            f.mem.rows("action_queue").find((a) => a.id === pending.action.id)!.payload as Record<
              string,
              unknown
            >
          ).tenantId = f.other;
        if (scenario === "tampered")
          (
            (
              f.mem.rows("action_queue").find((a) => a.id === pending.action.id)!.payload as Record<
                string,
                unknown
              >
            ).after as Record<string, unknown>
          ).enabled = false;
        if (scenario === "host") f.controls.hostFailure = true;
        await assert.rejects(() =>
          approveAndExecuteAction(
            f.db,
            pending.action.id,
            f.email,
            scenario === "autonomous" ? { mode: "autonomous" } : undefined,
          ),
        );
        assert.equal(f.controls.saves, count);
        assert.equal(
          f.mem.rows("action_queue").find((a) => a.id === pending.action.id)?.status,
          "failed",
        );
        f.mem.rows("tenant_memberships")[0]!.status = "active";
        f.mem.rows("tenants")[0]!.status = "active";
        f.controls.hostFailure = false;
      }
    });
    console.log(
      "PASS: approved module enable/disable/settings, shared direct save, exact preview/revision, registry/MCP replay, stale/invalid/core/foreign/revoked/suspended/autonomous/host refusals and disabled business tool gate.",
    );
  } finally {
    f.restore();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
