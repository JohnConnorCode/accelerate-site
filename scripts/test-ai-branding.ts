import { themeFromPreset } from "../src/lib/admin/theme-definition";
import { createAdminConfigurationFixture } from "./lib/admin-configuration-fixture";
import { handleMcpRequest } from "../src/lib/revenue-os/mcp-server";
import assert from "node:assert/strict";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import { runWithTenantRequestContext } from "../src/lib/tenancy/context";
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
  const { other, email, mem, db, actor, controls, restore } = createAdminConfigurationFixture();
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
      adminTheme: themeFromPreset("signal"),
      accentColor: "#234567",
      name: "Updated Studio",
      logoUrl: "https://assets.example.test/logo.svg",
    };
    const preview = await previewWorkspaceBrandUpdate(db, { changes });
    assert.equal(preview.changes.length, 4);
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
    assert.equal(controls.saves, 0);
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
      assert.deepEqual((await readWorkspaceBrand(db)).brand.adminTheme, changes.adminTheme);
      assert.equal(controls.saves, 1);
      assert.equal(mem.rows("action_queue").find((a) => a.id === action.id)?.status, "executed");
      await assert.rejects(() => approveAndExecuteAction(db, action.id, email), /already handled/);
      assert.equal(controls.saves, 1);
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
        const count: number = controls.saves;
        if (scenario === "revoked") mem.rows("tenant_memberships")[0]!.status = "revoked";
        if (scenario === "suspended") mem.rows("tenants")[0]!.status = "suspended";
        if (scenario === "tampered")
          (
            mem.rows("action_queue").find((a) => a.id === pending.id)!.payload as Record<
              string,
              unknown
            >
          ).tenantId = other;
        if (scenario === "provider") controls.hostFailure = true;
        await assert.rejects(() => approveAndExecuteAction(db, pending.id, email));
        assert.equal(controls.saves, count);
        assert.equal(mem.rows("action_queue").find((a) => a.id === pending.id)?.status, "failed");
        mem.rows("tenant_memberships")[0]!.status = "active";
        mem.rows("tenants")[0]!.status = "active";
        controls.hostFailure = false;
      }
      const p2 = await previewWorkspaceBrandUpdate(db, { changes: next });
      const autonomous = await proposeWorkspaceBrandUpdate(
        db,
        { changes: next, digest: p2.digest },
        email,
      );
      const count: number = controls.saves;
      await assert.rejects(() =>
        approveAndExecuteAction(db, autonomous.id, email, { mode: "autonomous" }),
      );
      assert.equal(controls.saves, count);
    });
    console.log(
      "PASS: branding registry preview/proposal, exact human-approved state change, shared direct save, CAS stale refusal, dedupe/replay, permissions/tenant denial, host failure, and no autonomous write.",
    );
  } finally {
    restore();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
