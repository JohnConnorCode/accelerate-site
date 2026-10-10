import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createAdminConfigurationFixture } from "./lib/admin-configuration-fixture";
import { runWithTenantRequestContext } from "../src/lib/tenancy/context";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import { approveAndExecuteAction } from "../src/lib/revenue-os/action-executor";
import { rejectAction } from "../src/lib/revenue-os/actions";
import { configurationDigest } from "../src/lib/revenue-os/module-configuration-read";
import { handleMcpRequest } from "../src/lib/revenue-os/mcp-server";
import { executeRegisteredRevenueTool, toOpenRouterTools } from "../src/lib/revenue-os/ai-tools";
import {
  readWorkspaceConfiguration,
  previewWorkspaceConfiguration,
  proposeWorkspaceConfiguration,
  applyWorkspaceConfigurationAsAdmin,
} from "../src/lib/revenue-os/workspace-configuration";
import { WORKSPACE_CONFIGURATION_TOOL_NAMES } from "../src/lib/revenue-os/workspace-configuration-contract";
import { encryptSecret } from "../src/lib/revenue-os/encryption";

async function main() {
  const f = createAdminConfigurationFixture();
  const previousEncryption = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "11".repeat(32);
  const rows = ["google", "resend"].map((provider) => ({
    id: randomUUID(),
    tenant_id: f.tenantId,
    provider,
    status: "connected",
    account_email: f.email,
    scopes: ["openid", "email"],
    credential_version: 1,
    updated_at: "2026-09-29T00:00:00+00:00",
    settings: { drive_folder_ids: ["original_folder"], retained: "private-setting-do-not-return" },
    encrypted_credentials: { api_key: "private-key-do-not-return" },
    encrypted_access_token: encryptSecret("fixture-access"),
    encrypted_refresh_token: encryptSecret("fixture-refresh"),
    token_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  }));
  f.mem.tables.integration_connections = rows;
  f.mem.tables.admin_settings = [
    {
      tenant_id: f.tenantId,
      key: "NOTIFY_NEW_LEADS",
      value: "true",
      is_secret: false,
      updated_at: "2026-09-29T00:00:00+00:00",
    },
    {
      tenant_id: f.other,
      key: "NOTIFY_NEW_LEADS",
      value: "true",
      is_secret: false,
      updated_at: "2026-09-29T00:00:00+00:00",
    },
    {
      tenant_id: f.tenantId,
      key: "UNKNOWN_PRIVATE",
      value: "private-secret-do-not-return",
      is_secret: true,
    },
  ];
  let saves = 0,
    failure = false;
  f.mem.rpc("save_workspace_configuration", ({ p_change, p_expected }) => {
    if (failure) throw new Error("controlled database failure");
    const change = p_change as Record<string, unknown>;
    if (change.operation === "set_workspace_setting") {
      const row = f.mem
        .rows("admin_settings")
        .find((r) => r.tenant_id === f.tenantId && r.key === change.key)!;
      const snapshot = {
        key: row.key,
        value: row.value,
        is_secret: row.is_secret,
        updated_at: row.updated_at,
      };
      assert.equal(configurationDigest(snapshot), configurationDigest(p_expected));
      row.value = change.value;
      row.updated_at = new Date().toISOString();
    } else {
      const row = rows.find((r) => r.provider === (change.provider ?? "google"))!;
      if (change.operation === "disconnect_provider") {
        row.status = "revoked";
        row.encrypted_credentials = {} as typeof row.encrypted_credentials;
        row.encrypted_access_token = null as unknown as string;
        row.encrypted_refresh_token = null as unknown as string;
        row.scopes = [];
        row.credential_version++;
      } else row.settings.drive_folder_ids = change.folderIds as string[];
      row.updated_at = new Date().toISOString();
    }
    saves++;
    return { status: "success", operation: change.operation };
  });
  const jobs = new Map<string, string>();
  f.mem.rpc("claim_revenue_job_run", ({ p_claim_key }) => {
    const key = String(p_claim_key ?? randomUUID());
    const prior = jobs.get(key);
    if (prior) return { run_id: prior, claimed: false, existing_status: "success" };
    const id = randomUUID();
    jobs.set(key, id);
    (f.mem.tables.job_runs ??= []).push({ id, tenant_id: f.tenantId, status: "running" });
    return { run_id: id, claimed: true, existing_status: "running" };
  });
  const context = { supabase: f.db, actorEmail: f.email, toolPack: "core" as const };
  const stage = async (change: Record<string, unknown>) => {
    const preview = await previewWorkspaceConfiguration(f.db, { change });
    const action = await proposeWorkspaceConfiguration(
      f.db,
      { change, digest: preview.digest },
      f.email,
    );
    return { preview, action };
  };
  try {
    for (const pack of ["core", "pipeline", "outreach"] as const)
      for (const name of WORKSPACE_CONFIGURATION_TOOL_NAMES)
        assert.ok(toOpenRouterTools(pack).some((t) => t.function.name === name));
    const read = JSON.stringify(await readWorkspaceConfiguration(f.db, {}));
    for (const secret of [
      "private-key-do-not-return",
      "private-setting-do-not-return",
      "private-secret-do-not-return",
      "fixture-access",
      "fixture-refresh",
    ])
      assert.ok(!read.includes(secret));
    for (const change of [
      { operation: "disconnect_provider", provider: "unknown" },
      { operation: "set_workspace_setting", key: "ADMIN_EMAIL", value: "bad@example.test" },
      { operation: "set_workspace_setting", key: "OPENROUTER_API_KEY", value: "private-secret" },
      { operation: "set_workspace_setting", key: "NOTIFY_NEW_LEADS", value: "yes" },
      { operation: "set_drive_folders", folderIds: ["duplicate_folder", "duplicate_folder"] },
      { operation: "set_drive_folders", folderIds: ["bad' OR true"] },
      { operation: "set_drive_folders", folderIds: ["original_folder"], tenantId: f.other },
    ])
      await assert.rejects(() => previewWorkspaceConfiguration(f.db, { change }));
    await assert.rejects(
      () =>
        applyWorkspaceConfigurationAsAdmin(
          f.db,
          { operation: "set_drive_folders", folderIds: [] },
          f.email,
        ),
      /authenticated/,
    );
    const change = { operation: "set_drive_folders", folderIds: ["reviewed_folder"] };
    const staged = await stage(change);
    const mcp = await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "propose_workspace_configuration",
          arguments: { change, digest: staged.preview.digest },
        },
      },
      context,
    );
    const output = mcp!.result as { isError: boolean; content: { text: string }[] };
    assert.equal(output.isError, false);
    assert.equal(JSON.parse(output.content[0]!.text).id, staged.action.id);
    assert.equal(saves, 0);
    await runWithTenantRequestContext(f.actor, async () => {
      await approveAndExecuteAction(f.db, staged.action.id, f.email);
      assert.equal(saves, 1);
      assert.deepEqual(rows[0]!.settings.drive_folder_ids, ["reviewed_folder"]);
      assert.equal(rows[0]!.settings.retained, "private-setting-do-not-return");
      await assert.rejects(
        () => approveAndExecuteAction(f.db, staged.action.id, f.email),
        /already handled/,
      );
      assert.equal(saves, 1);
      const pref = await stage({
        operation: "set_workspace_setting",
        key: "NOTIFY_NEW_LEADS",
        value: "false",
      });
      await approveAndExecuteAction(f.db, pref.action.id, f.email);
      assert.equal(f.mem.rows("admin_settings")[0]!.value, "false");
      assert.equal(f.mem.rows("admin_settings")[1]!.value, "true");
      const stale = await stage({ operation: "set_drive_folders", folderIds: ["stale_folder"] });
      await applyWorkspaceConfigurationAsAdmin(
        f.db,
        { operation: "set_drive_folders", folderIds: ["human_folder"] },
        f.email,
      );
      await assert.rejects(
        () => approveAndExecuteAction(f.db, stale.action.id, f.email),
        /changed/,
      );
      assert.deepEqual(rows[0]!.settings.drive_folder_ids, ["human_folder"]);
      for (const kind of [
        "revoked",
        "foreign",
        "tampered",
        "failure",
        "denied",
        "expired",
        "autonomous",
      ]) {
        const draft = await stage({ operation: "disconnect_provider", provider: "resend" });
        const count: number = saves;
        if (kind === "revoked") f.mem.rows("tenant_memberships")[0]!.status = "revoked";
        if (kind === "tampered")
          (
            f.mem.rows("action_queue").find((a) => a.id === draft.action.id)!.payload as Record<
              string,
              unknown
            >
          ).after = { status: "connected" };
        if (kind === "failure") failure = true;
        if (kind === "denied") await rejectAction(f.db, draft.action.id, f.email);
        if (kind === "expired")
          f.mem.rows("action_queue").find((a) => a.id === draft.action.id)!.expires_at =
            "2000-01-01T00:00:00Z";
        await assert.rejects(() =>
          kind === "foreign"
            ? approveAndExecuteAction(
                bindTenantDatabase(f.mem.client, f.other, true),
                draft.action.id,
                f.email,
              )
            : approveAndExecuteAction(
                f.db,
                draft.action.id,
                f.email,
                kind === "autonomous" ? { mode: "autonomous" } : undefined,
              ),
        );
        assert.equal(saves, count);
        assert.equal(rows[1]!.status, "connected");
        f.mem.rows("tenant_memberships")[0]!.status = "active";
        failure = false;
      }
      const disconnected = await stage({ operation: "disconnect_provider", provider: "resend" });
      await approveAndExecuteAction(f.db, disconnected.action.id, f.email);
      assert.equal(rows[1]!.status, "revoked");
      assert.equal(rows[1]!.encrypted_refresh_token, null);
      let upstream = 0,
        providerFailure = false;
      globalThis.fetch = async (raw) => {
        const url = new URL(String(raw));
        assert.equal(url.origin, "https://openidconnect.googleapis.com");
        upstream++;
        return Response.json(
          providerFailure
            ? { error: "private-provider-detail" }
            : { email: f.email, email_verified: true },
          { status: providerFailure ? 400 : 200 },
        );
      };
      const test = await stage({ operation: "test_google_connection" });
      assert.equal(upstream, 0);
      await approveAndExecuteAction(f.db, test.action.id, f.email);
      assert.equal(upstream, 1);
      assert.equal(f.mem.rows("job_runs")[0]!.status, "success");
      await assert.rejects(
        () => approveAndExecuteAction(f.db, test.action.id, f.email),
        /already handled/,
      );
      assert.equal(upstream, 1);
      providerFailure = true;
      const failed = await stage({ operation: "test_google_connection" });
      await assert.rejects(() => approveAndExecuteAction(f.db, failed.action.id, f.email));
      assert.equal(f.mem.rows("job_runs").at(-1)!.status, "failed");
      assert.ok(!JSON.stringify(f.mem.rows("action_queue")).includes("private-provider-detail"));
      // The first source succeeds; the next fails. Keep the first receipt and
      // refuse overall completion without attempting Drive.
      let driveRequests = 0;
      globalThis.fetch = async (raw) => {
        const url = new URL(String(raw));
        if (url.hostname === "gmail.googleapis.com")
          return Response.json(
            url.pathname.endsWith("/profile") ? { historyId: "new-history" } : { threads: [] },
          );
        if (url.hostname === "www.googleapis.com" && url.pathname.startsWith("/calendar/"))
          return Response.json({ error: "private-calendar-detail" }, { status: 400 });
        driveRequests++;
        throw new Error("Unexpected provider request");
      };
      const partial = await stage({ operation: "sync_google", source: "all" });
      await assert.rejects(
        () => approveAndExecuteAction(f.db, partial.action.id, f.email),
        /did not complete/,
      );
      const partialAction = f.mem.rows("action_queue").find((row) => row.id === partial.action.id)!;
      assert.equal(partialAction.status, "failed");
      assert.equal(
        (partialAction.result as { result: { status: string } }).result.status,
        "partial",
      );
      assert.equal(f.mem.rows("job_runs").at(-1)!.status, "partial");
      assert.equal(driveRequests, 0);
      assert.ok(!JSON.stringify(partialAction).includes("private-calendar-detail"));

      // Drive is optional. A new connection can sync Gmail and Calendar before
      // selecting folders, while an explicit Drive-only request still refuses.
      rows[0]!.settings.drive_folder_ids = [];
      await assert.rejects(
        () =>
          previewWorkspaceConfiguration(f.db, {
            change: { operation: "sync_google", source: "drive" },
          }),
        /Select Drive folders/,
      );
      let gmailRequests = 0,
        calendarRequests = 0;
      globalThis.fetch = async (raw, init) => {
        assert.equal(init?.method ?? "GET", "GET", "Sync must not send messages or invitations");
        const url = new URL(String(raw));
        if (url.hostname === "gmail.googleapis.com") {
          gmailRequests++;
          return Response.json(
            url.pathname.endsWith("/profile")
              ? { historyId: "new-history" }
              : { threads: [], history: [] },
          );
        }
        if (url.hostname === "www.googleapis.com" && url.pathname.startsWith("/calendar/")) {
          calendarRequests++;
          return Response.json({ items: [] });
        }
        driveRequests++;
        throw new Error("Unconfigured Drive must not issue a provider request");
      };
      const withoutDrive = await stage({ operation: "sync_google", source: "all" });
      await approveAndExecuteAction(f.db, withoutDrive.action.id, f.email);
      const syncedAction = f.mem
        .rows("action_queue")
        .find((row) => row.id === withoutDrive.action.id)!;
      assert.equal(syncedAction.status, "executed");
      assert.equal(f.mem.rows("job_runs").at(-1)!.status, "success");
      assert.ok(gmailRequests > 0);
      assert.ok(calendarRequests > 0);
      assert.equal(driveRequests, 0);
      assert.equal(
        f.mem
          .rows("source_runs")
          .filter((row) => row.source_key === "google_drive")
          .at(-1)!.status,
        "not_configured",
      );
      assert.equal(
        (syncedAction.result as { result: { sources: { drive: { status: string } } } }).result
          .sources.drive.status,
        "not_configured",
      );
      const registry = await executeRegisteredRevenueTool(context, "get_workspace_configuration", {
        provider: "google",
      });
      assert.ok(registry.output);
    });
    console.log(
      "PASS: workspace admin/AI/MCP shared proposals, strict inputs, redaction, exact approval, stale/replay, revocation/tenant/denial/expiry, database failure and real Google probe fixture.",
    );
  } finally {
    f.restore();
    if (previousEncryption === undefined) delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
    else process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = previousEncryption;
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
