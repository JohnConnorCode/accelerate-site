import { z } from "zod";
import { normalizeDriveFolderIds } from "./drive-sync-plan";

export const WORKSPACE_PROVIDERS = [
  "resend",
  "google",
  "calendly",
  "openrouter",
  "mcp",
  "whatsapp",
  "hubspot",
  "stripe",
  "postiz",
] as const;
export const WORKSPACE_SETTING_KEYS = [
  "RESEND_FROM_EMAIL",
  "NEXT_PUBLIC_PLAUSIBLE_DOMAIN",
  "SITE_URL",
  "BUSINESS_NAME",
  "NOTIFY_NEW_LEADS",
  "NOTIFY_NEW_CONTACTS",
  "NOTIFY_HOT_LEADS",
  "NOTIFY_PROPOSAL_VIEWED",
  "NOTIFY_TASK_OVERDUE",
  "NOTIFY_CONTRACT_EXPIRING",
] as const;
export const workspaceSettingSchema = z
  .object({
    operation: z.literal("set_workspace_setting"),
    key: z.enum(WORKSPACE_SETTING_KEYS),
    value: z.string().trim().max(500),
  })
  .strict()
  .superRefine(({ key, value }, ctx) => {
    let valid = !/[\x00-\x1f\x7f]/.test(value);
    if (key.startsWith("NOTIFY_")) valid &&= ["true", "false"].includes(value);
    else if (key === "RESEND_FROM_EMAIL") valid &&= z.email().safeParse(value).success;
    else if (key === "SITE_URL") {
      if (z.url().safeParse(value).success) {
        const url = new URL(value);
        valid &&=
          url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash;
      } else valid = false;
    } else if (key === "NEXT_PUBLIC_PLAUSIBLE_DOMAIN")
      valid &&= /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value);
    else valid &&= value.length > 0;
    if (!valid) ctx.addIssue({ code: "custom", message: "Invalid workspace setting value" });
  });
export const workspaceChangeSchema = z.union([
  z
    .object({ operation: z.literal("disconnect_provider"), provider: z.enum(WORKSPACE_PROVIDERS) })
    .strict(),
  z
    .object({
      operation: z.literal("set_drive_folders"),
      folderIds: z.array(z.string().trim().max(256)).max(10),
    })
    .strict()
    .superRefine(({ folderIds }, ctx) => {
      if (normalizeDriveFolderIds(folderIds).rejected.length)
        ctx.addIssue({ code: "custom", message: "Supply up to 10 unique valid Drive folder IDs" });
    }),
  workspaceSettingSchema,
  z
    .object({
      operation: z.literal("sync_google"),
      source: z.enum(["all", "gmail", "calendar", "drive"]),
    })
    .strict(),
  z.object({ operation: z.literal("test_google_connection") }).strict(),
]);
export type WorkspaceConfigurationChange = z.infer<typeof workspaceChangeSchema>;
export const workspaceConfigurationReadSchema = z
  .object({
    provider: z.enum(WORKSPACE_PROVIDERS).optional(),
    settingKey: z.enum(WORKSPACE_SETTING_KEYS).optional(),
  })
  .strict();
export const workspaceConfigurationPreviewSchema = z
  .object({ change: workspaceChangeSchema })
  .strict();
export const workspaceConfigurationProposalSchema = z
  .object({ change: workspaceChangeSchema, digest: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
export const WORKSPACE_CONFIGURATION_TOOLS = [
  {
    name: "get_workspace_configuration",
    description:
      "Read redacted provider status, selected Drive folders and named public workspace preferences. Returns secure setup links for credentials and OAuth. Never returns keys, tokens, arbitrary settings or platform authority.",
    impact: "read",
    confirmationRequired: false,
    connectionRequirement: "none",
    serviceTarget: "revenue-os.workspace-configuration",
  },
  {
    name: "preview_workspace_configuration",
    description:
      "Preview a provider disconnect, Drive folder selection, named public preference, bounded Google sync or Google connection check. Returns exact before/after values, consequences and digest. No configuration or provider effect occurs.",
    impact: "read",
    confirmationRequired: false,
    connectionRequirement: "none",
    serviceTarget: "revenue-os.workspace-configuration",
  },
  {
    name: "propose_workspace_configuration",
    description:
      "Stage the unchanged workspace configuration preview and digest for human approval. Does not apply the change, sync, connect, generate credentials or approve itself. Secret entry and OAuth must use the secure setup link.",
    impact: "internal_write",
    confirmationRequired: true,
    connectionRequirement: "none",
    serviceTarget: "revenue-os.workspace-configuration",
  },
] as const;
export const WORKSPACE_CONFIGURATION_TOOL_NAMES = WORKSPACE_CONFIGURATION_TOOLS.map((t) => t.name);

/** Shared semantic preview for the admin service and fictional transport. */
export function workspaceConfigurationOutcome(
  change: WorkspaceConfigurationChange,
  before: Record<string, unknown>,
) {
  if (
    change.operation !== "set_workspace_setting" &&
    (change.operation === "disconnect_provider"
      ? !["connected", "degraded"].includes(String(before.status))
      : before.status !== "connected")
  )
    throw new Error("Provider is not connected. Refresh Integrations first.");
  let after: Record<string, unknown>, consequences: string;
  switch (change.operation) {
    case "disconnect_provider":
      after = {
        provider: change.provider,
        status: "revoked",
        credentialVersion: Number((before as Record<string, unknown>).credentialVersion) + 1,
      };
      consequences =
        "Remove this workspace's stored credentials and disable its environment fallback. Future provider work refuses. Existing business records and receipts remain. In-flight upstream requests cannot be recalled; reconnect requires secure setup.";
      break;
    case "set_drive_folders":
      after = { folderIds: change.folderIds };
      if (JSON.stringify(before.folderIds) === JSON.stringify(change.folderIds))
        throw new Error("No Drive folders would change");
      consequences =
        "Only these folders are eligible for future Drive sync. Previously stored documents and provenance remain. This does not start a sync or grant Google permissions.";
      break;
    case "set_workspace_setting":
      after = { key: change.key, value: change.value };
      if (before.value === change.value) throw new Error("No preference value would change");
      consequences =
        "Save this named workspace preference. Legacy site/email preferences do not replace workspace Branding, provider credentials or server environment. Notification preference is stored; this does not send a notification.";
      break;
    case "sync_google":
      if (change.source === "drive" && !(before as { folderIds?: string[] }).folderIds?.length)
        throw new Error("Select Drive folders before syncing Drive");
      after = {
        source: change.source,
        maxGmailThreads: 75,
        folderIds: (before as { folderIds?: string[] }).folderIds ?? [],
      };
      consequences =
        "Read the selected connected Google sources through existing bounded sync services and record source/job receipts. Sync all includes Gmail and Calendar; Drive is recorded as not configured when no folders are selected. No email or calendar invitation is sent. Sources run in order; completed source work remains if a later source fails.";
      break;
    case "test_google_connection":
      after = { operation: "Verify Google access" };
      consequences =
        "Verify the current Google token, refreshing it if needed. Returns only account and granted scopes; no messages send and no credentials are returned.";
  }
  return { after, consequences };
}
