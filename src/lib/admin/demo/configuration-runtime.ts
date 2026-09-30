import {
  workspaceChangeSchema,
  workspaceConfigurationPreviewSchema,
  workspaceConfigurationProposalSchema,
  workspaceConfigurationReadSchema,
  workspaceConfigurationOutcome,
  WORKSPACE_PROVIDERS,
  WORKSPACE_SETTING_KEYS,
} from "@/lib/revenue-os/workspace-configuration-contract";
import type { DemoBusinessState } from "./business-runtime";
import type { DemoScenarioPack } from "./scenarios";
type Provider = {
  provider: string;
  status: string;
  accountEmail: string;
  scopes: string[];
  credentialVersion: number;
  folderIds: string[];
};
export type DemoConfigurationState = {
  revision: number;
  providers: Provider[];
  preferences: Record<string, string>;
};
async function digest(value: unknown) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value))),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export async function handleDemoConfiguration(
  pack: DemoScenarioPack,
  business: DemoBusinessState,
  url: URL,
  method: string,
  body: Record<string, unknown>,
  save: () => void,
) {
  const path = url.pathname;
  const action =
    path === "/api/admin/revenue-os/actions" && method === "PATCH"
      ? business.actions.find(
          (a) => a.id === body.id && a.action_type === "workspace_configuration_change",
        )
      : null;
  if (
    !action &&
    ![
      "/api/admin/revenue-os/workspace-configuration",
      "/api/admin/tenant/providers",
      "/api/admin/google/status",
      "/api/admin/google/sync",
      "/api/admin/settings",
    ].includes(path)
  )
    return null;
  if (path === "/api/admin/settings" && method === "GET") return null;
  const state = (business.configuration ??= {
    revision: 1,
    providers: WORKSPACE_PROVIDERS.map((provider) => ({
      provider,
      status: ["google", "resend", "openrouter", "stripe", "postiz"].includes(provider)
        ? "connected"
        : "disconnected",
      accountEmail: pack.tenant.founder.email,
      scopes:
        provider === "google"
          ? [
              "openid",
              "email",
              "https://www.googleapis.com/auth/gmail.readonly",
              "https://www.googleapis.com/auth/gmail.send",
              "https://www.googleapis.com/auth/calendar.events",
              "https://www.googleapis.com/auth/drive.readonly",
            ]
          : [],
      credentialVersion: 1,
      folderIds: provider === "google" ? ["fictional_selected_folder"] : [],
    })),
    preferences: Object.fromEntries(
      WORKSPACE_SETTING_KEYS.map((key) => [
        key,
        key.startsWith("NOTIFY_")
          ? "true"
          : key === "BUSINESS_NAME"
            ? pack.name
            : key === "SITE_URL"
              ? `https://${pack.tenant.brand.domain}`
              : key === "NEXT_PUBLIC_PLAUSIBLE_DOMAIN"
                ? pack.tenant.brand.domain
                : pack.tenant.founder.email,
      ]),
    ),
  });
  const json = (data: unknown, status = 200) => Response.json(data, { status });
  const record = (operation: string, id?: string) => {
    business.receipts.unshift({
      id: crypto.randomUUID(),
      operation,
      at: new Date().toISOString(),
      simulated: true,
      sourceType: "configuration",
      sourceId: id,
    });
    save();
  };
  const preview = async (raw: unknown) => {
    const { change } = workspaceConfigurationPreviewSchema.parse(raw);
    const before =
      change.operation === "set_workspace_setting"
        ? { key: change.key, value: state.preferences[change.key] ?? null }
        : structuredClone(
            state.providers.find(
              (p) =>
                p.provider ===
                (change.operation === "disconnect_provider" ? change.provider : "google"),
            )!,
          );
    const { after, consequences } = workspaceConfigurationOutcome(change, before);
    const facts = {
      version: 1,
      tenantId: `demo:${pack.id}`,
      change,
      revision: state.revision.toString(16).padStart(64, "0"),
      before,
      after,
      consequences,
    };
    return { ...facts, digest: await digest(facts), requiresHumanApproval: true };
  };
  const apply = (raw: unknown) => {
    const change = workspaceChangeSchema.parse(raw);
    if (change.operation === "set_workspace_setting") state.preferences[change.key] = change.value;
    else {
      const provider = state.providers.find(
        (p) =>
          p.provider === (change.operation === "disconnect_provider" ? change.provider : "google"),
      )!;
      if (change.operation === "disconnect_provider") {
        provider.status = "revoked";
        provider.scopes = [];
        provider.credentialVersion++;
      }
      if (change.operation === "set_drive_folders") provider.folderIds = change.folderIds;
    }
    state.revision++;
    return { status: "success", operation: change.operation, simulated: true };
  };
  try {
    if (action) {
      if (action.status !== "pending") throw new Error("Action already handled");
      if (!["approve", "reject"].includes(String(body.decision)))
        throw new Error("Invalid decision");
      if (body.decision === "reject") {
        action.status = "rejected";
        record("Rejected " + action.title, action.id);
        return json({ simulated: true });
      }
      const current = await preview({ change: action.payload.change });
      if (
        action.status !== "pending" ||
        current.digest !== action.payload.digest ||
        current.revision !== state.revision.toString(16).padStart(64, "0")
      )
        throw new Error("Configuration changed. Preview and approve again.");
      if (action.expires_at && Date.parse(action.expires_at) <= Date.now())
        throw new Error("Approval expired");
      action.result = apply(action.payload.change);
      action.status = "executed";
      record("Approved " + action.title, action.id);
      return json({ result: action.result, simulated: true });
    }
    if (path === "/api/admin/revenue-os/workspace-configuration") {
      if (method === "GET") {
        workspaceConfigurationReadSchema.parse({});
        return json({
          providers: state.providers,
          preferences: Object.entries(state.preferences).map(([key, value]) => ({ key, value })),
          secureHandoffs: {
            providerSetup: "/admin/integrations",
            secretEntryAndRotation: "Secure setup is simulated; no credential is retained.",
          },
          simulated: true,
        });
      }
      if (body.action === "preview")
        return json({ ...(await preview({ change: body.change })), simulated: true });
      if (body.action === "propose") {
        const input = workspaceConfigurationProposalSchema.parse({
          change: body.change,
          digest: body.digest,
        });
        const p = await preview({ change: input.change });
        if (p.digest !== input.digest) throw new Error("Preview changed; preview again");
        const prior = business.actions.find(
          (a) =>
            a.status === "pending" &&
            a.action_type === "workspace_configuration_change" &&
            a.payload.digest === p.digest,
        );
        if (prior) return json(prior);
        const { requiresHumanApproval: _approval, ...payload } = p;
        void _approval;
        const created = {
          id: crypto.randomUUID(),
          action_type: "workspace_configuration_change",
          title: "Review workspace configuration",
          description: p.consequences,
          status: "pending",
          error: null,
          payload,
          result: null,
          pluginId: "core-system",
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        };
        business.actions.unshift(created);
        record("Prepared workspace configuration", created.id);
        return json(created);
      }
    }
    if (path === "/api/admin/tenant/providers") {
      if (method === "GET")
        return json({
          providers: state.providers.map((p) => ({
            id: `demo-${p.provider}-${pack.id}`,
            provider: p.provider,
            status: p.status,
            account_email: p.accountEmail,
            scopes: p.scopes,
            credential_version: p.credentialVersion,
            credential_source: "simulated",
            key_metadata: null,
            reply_to_email: p.accountEmail,
            last_error: null,
          })),
          simulated: true,
        });
      if (body.action === "disconnect") {
        const change = { operation: "disconnect_provider", provider: body.provider };
        await preview({ change });
        const result = apply(change);
        record("Disconnected fictional provider");
        return json({ success: true, result, simulated: true });
      }
      if (String(body.action).startsWith("configure_")) {
        const provider = state.providers.find((p) => p.provider === String(body.action).slice(10));
        if (!provider) throw new Error("Unknown provider");
        provider.status = "connected";
        provider.credentialVersion++;
        state.revision++;
        record("Simulated secure provider setup");
        return json({ success: true, simulated: true });
      }
    }
    if (path === "/api/admin/google/status") {
      const p = state.providers.find((p) => p.provider === "google")!;
      if (method === "GET")
        return json({
          schemaReady: true,
          configured: true,
          connected: p.status === "connected",
          connection: {
            provider: "google",
            status: p.status,
            account_email: p.accountEmail,
            scopes: p.scopes,
            settings: { drive_folder_ids: p.folderIds },
            requiredScopesGranted: true,
          },
          simulated: true,
        });
      const change =
        method === "DELETE"
          ? { operation: "disconnect_provider", provider: "google" }
          : { operation: "test_google_connection" };
      await preview({ change });
      const result = apply(change);
      record("Simulated Google connection operation");
      return json({ success: true, result, simulated: true });
    }
    if (path === "/api/admin/google/sync") {
      const change =
        method === "PATCH"
          ? { operation: "set_drive_folders", folderIds: body.driveFolderIds }
          : { operation: "sync_google", source: body.source ?? "all" };
      await preview({ change });
      const result = apply(change);
      record("Simulated Google sync configuration");
      return json({
        success: true,
        result,
        folders: state.providers.find((p) => p.provider === "google")!.folderIds.length,
        simulated: true,
      });
    }
    if (path === "/api/admin/settings" && method === "PUT") {
      const change = { operation: "set_workspace_setting", key: body.key, value: body.value };
      await preview({ change });
      const result = apply(change);
      record("Saved fictional workspace preference");
      return json({ success: true, result, simulated: true });
    }
    throw new Error("Unsupported configuration operation");
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Configuration refused", simulated: true },
      409,
    );
  }
}
