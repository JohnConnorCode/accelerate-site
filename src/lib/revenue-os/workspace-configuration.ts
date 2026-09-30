import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { tenantIdForDatabase, tenantScopeForDatabase } from "@/lib/supabase/server";
import { assertCurrentTenantAdmin } from "./tenant-admin-authority";
import { configurationDigest } from "./module-configuration-read";
import { proposeAction, checkpointActionResult } from "./actions";
import { withJobRun } from "./runs";
import { verifyGoogleConnection, syncGmail, syncCalendar, syncDrive } from "./google";
import { googleOperatorError } from "./google-oauth";
import { normalizeDriveFolderIds } from "./drive-sync-plan";
import {
  workspaceConfigurationOutcome,
  WORKSPACE_PROVIDERS,
  WORKSPACE_SETTING_KEYS,
  workspaceChangeSchema,
  workspaceConfigurationReadSchema,
  workspaceConfigurationPreviewSchema,
  workspaceConfigurationProposalSchema,
  type WorkspaceConfigurationChange,
} from "./workspace-configuration-contract";

const providerColumns =
  "id,provider,status,account_email,scopes,credential_version,updated_at,settings";
const settingColumns = "key,value,is_secret,updated_at";
function workspace(db: SupabaseClient) {
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("Tenant-bound workspace configuration required");
  return tenantId;
}
function providerSnapshot(row: Record<string, unknown>) {
  return {
    id: row.id,
    status: row.status,
    accountEmail: row.account_email ?? null,
    scopes: row.scopes ?? [],
    credentialVersion: Number(row.credential_version ?? 1),
    updatedAt: row.updated_at ?? null,
    settings: row.settings ?? {},
  };
}
function publicProvider(row: Record<string, unknown>) {
  const snapshot = providerSnapshot(row);
  if (
    Buffer.byteLength(JSON.stringify(snapshot)) > 65_536 ||
    !Array.isArray(snapshot.scopes) ||
    snapshot.scopes.length > 32 ||
    snapshot.scopes.some((scope) => typeof scope !== "string" || scope.length > 500) ||
    (snapshot.accountEmail !== null &&
      (typeof snapshot.accountEmail !== "string" || snapshot.accountEmail.length > 254))
  )
    throw new Error(
      "Provider configuration exceeds safe review bounds. Ask the installation owner to repair it.",
    );
  return {
    provider: row.provider,
    status: snapshot.status,
    accountEmail: snapshot.accountEmail,
    scopes: snapshot.scopes,
    credentialVersion: snapshot.credentialVersion,
    revision: configurationDigest(snapshot),
    ...(row.provider === "google"
      ? {
          folderIds: normalizeDriveFolderIds(
            (snapshot.settings as Record<string, unknown>).drive_folder_ids,
          ).ids,
        }
      : {}),
  };
}
function publicSetting(row: Record<string, unknown> | null, key: string) {
  if (row && (typeof row.value !== "string" || row.value.length > 500))
    throw new Error("Preference exceeds safe review bounds");
  if (row?.is_secret) throw new Error("This preference requires secure administrator setup");
  return {
    key,
    value: row?.value ?? null,
    environmentOverride: Boolean(process.env[key]),
    revision: configurationDigest(row),
  };
}
export async function readWorkspaceConfiguration(db: SupabaseClient, raw: unknown) {
  const input = workspaceConfigurationReadSchema.parse(raw);
  const tenantId = workspace(db);
  const [providers, settings] = await Promise.all([
    db
      .from("integration_connections")
      .select(providerColumns)
      .eq("tenant_id", tenantId)
      .in("provider", input.provider ? [input.provider] : [...WORKSPACE_PROVIDERS])
      .limit(9),
    db
      .from("admin_settings")
      .select(settingColumns)
      .eq("tenant_id", tenantId)
      .in("key", input.settingKey ? [input.settingKey] : [...WORKSPACE_SETTING_KEYS])
      .limit(10),
  ]);
  if (providers.error || settings.error)
    throw new Error("Workspace configuration could not be read");
  const slug = tenantScopeForDatabase(db)?.slug;
  const setupPath = slug
    ? `/t/${encodeURIComponent(slug)}/admin/integrations`
    : "/admin/integrations";
  return {
    providers: (providers.data ?? []).map(publicProvider),
    preferences: (settings.data ?? [])
      .filter((r) => !r.is_secret)
      .map((r) => publicSetting(r, r.key)),
    secureHandoffs: {
      providerSetup: setupPath,
      secretEntryAndRotation:
        "Enter credentials only in Integrations. Values and one-time keys never enter AI proposals.",
      googleConsent:
        "Open the Google connection control in Integrations to grant or renew OAuth permissions.",
      platformConfiguration:
        "Installation owner manages server environment, ADMIN_EMAIL, encryption keys and hosting outside workspace tools.",
    },
  };
}
async function target(
  db: SupabaseClient,
  change: WorkspaceConfigurationChange,
): Promise<{
  expected: Record<string, unknown> | null;
  before: Record<string, unknown>;
  revision: string;
}> {
  const tenantId = workspace(db);
  if (change.operation === "set_workspace_setting") {
    const result = await db
      .from("admin_settings")
      .select(settingColumns)
      .eq("tenant_id", tenantId)
      .eq("key", change.key)
      .maybeSingle();
    if (result.error) throw new Error("Workspace preference could not be read");
    const before = publicSetting(result.data, change.key);
    if (before.environmentOverride)
      throw new Error(
        "The server environment overrides this setting. The installation owner must update it securely.",
      );
    const expected = result.data
      ? {
          key: result.data.key,
          value: result.data.value,
          is_secret: result.data.is_secret,
          updated_at: result.data.updated_at,
        }
      : null;
    return {
      expected,
      before: { key: change.key, value: before.value },
      revision: configurationDigest(expected),
    };
  }
  const provider = change.operation === "disconnect_provider" ? change.provider : "google";
  const result = await db
    .from("integration_connections")
    .select(providerColumns)
    .eq("tenant_id", tenantId)
    .eq("provider", provider)
    .maybeSingle();
  if (result.error || !result.data)
    throw new Error("Provider connection could not be read. Use Integrations to connect it first.");
  const before = publicProvider(result.data);
  if (
    change.operation === "disconnect_provider"
      ? !["connected", "degraded"].includes(String(before.status))
      : before.status !== "connected"
  )
    throw new Error(
      "Provider is not connected. Refresh Integrations before preparing this change.",
    );
  return { expected: providerSnapshot(result.data), before, revision: before.revision };
}
export async function previewWorkspaceConfiguration(db: SupabaseClient, raw: unknown) {
  const { change } = workspaceConfigurationPreviewSchema.parse(raw);
  const current = await target(db, change);
  const { after, consequences } = workspaceConfigurationOutcome(change, current.before);
  const facts = {
    version: 1 as const,
    tenantId: workspace(db),
    change,
    revision: current.revision,
    before: current.before,
    after,
    consequences,
  };
  return { ...facts, digest: configurationDigest(facts), requiresHumanApproval: true };
}
export async function proposeWorkspaceConfiguration(
  db: SupabaseClient,
  raw: unknown,
  actorEmail: string,
) {
  const input = workspaceConfigurationProposalSchema.parse(raw);
  const preview = await previewWorkspaceConfiguration(db, { change: input.change });
  if (preview.digest !== input.digest)
    throw new Error("Workspace preview changed. Preview again before proposing.");
  const { requiresHumanApproval: _approval, ...payload } = preview;
  void _approval;
  return proposeAction(db, {
    actionType: "workspace_configuration_change",
    title: preview.change.operation.replaceAll("_", " "),
    description: preview.consequences,
    payload,
    sourceContext: "admin_ai",
    entityType: "tenant",
    entityId: preview.tenantId,
    dedupeKey: `workspace-config:${preview.tenantId}:${preview.digest}`,
    proposedBy: actorEmail,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  });
}
/** Admin adapters and approved AI execution share the same validation, CAS and transaction. */
export async function applyWorkspaceConfigurationAsAdmin(
  db: SupabaseClient,
  raw: unknown,
  actorEmail: string,
  expectedDigest?: string,
  requestKey?: string,
) {
  const change = workspaceChangeSchema.parse(raw);
  await assertCurrentTenantAdmin(db, actorEmail);
  const preview = await previewWorkspaceConfiguration(db, { change });
  if (expectedDigest && preview.digest !== expectedDigest)
    throw new Error("Workspace configuration changed. Preview and approve again.");
  if (change.operation === "sync_google" || change.operation === "test_google_connection") {
    try {
      const job = await withJobRun(
        db,
        change.operation === "sync_google"
          ? `google-${change.source}-sync`
          : "google-connection-test",
        async () => {
          const summary: Record<string, unknown> = {};
          let status: "success" | "partial" | "failed" = "success";
          if (change.operation === "test_google_connection") {
            Object.assign(summary, await verifyGoogleConnection(db));
          } else {
            const sources =
              change.source === "all" ? ["gmail", "calendar", "drive"] : [change.source];
            for (const source of sources) {
              try {
                // Sync receipts may advance cursors/timestamps, but a later source
                // must retain the reviewed account, permissions and folder set.
                await assertCurrentTenantAdmin(db, actorEmail);
                const fresh = await target(db, change);
                for (const field of [
                  "provider",
                  "status",
                  "accountEmail",
                  "scopes",
                  "credentialVersion",
                  "folderIds",
                ]) {
                  if (JSON.stringify(fresh.before[field]) !== JSON.stringify(preview.before[field]))
                    throw new Error(
                      "Provider configuration changed during sync. Preview and approve again.",
                    );
                }
                const result =
                  source === "gmail"
                    ? await syncGmail(db)
                    : source === "calendar"
                      ? await syncCalendar(db)
                      : await syncDrive(db, preview.before.folderIds as string[]);
                const row = result as Record<string, unknown>;
                const indexing = row.indexing as Record<string, unknown> | undefined;
                const incomplete = Boolean(
                  row.failed ||
                  row.deferred ||
                  row.notConfigured ||
                  indexing?.failed ||
                  indexing?.inaccessible ||
                  (indexing?.errors as unknown[] | undefined)?.length,
                );
                summary[source] = {
                  stored: Number(row.stored ?? 0),
                  failed: Number(row.failed ?? indexing?.failed ?? 0),
                  status: incomplete ? "partial" : "success",
                };
                if (incomplete) {
                  status = "partial";
                  break;
                }
              } catch (error) {
                summary[source] = {
                  status: "failed",
                  error: googleOperatorError(error, "sync").message,
                };
                status = Object.keys(summary).length > 1 ? "partial" : "failed";
                break;
              }
            }
          }
          return {
            value: { status, sources: summary },
            summary: { status, sources: summary },
            status,
          };
        },
        requestKey,
      );
      return {
        success: job.claimed && job.value?.status === "success",
        skipped: !job.claimed,
        runId: job.runId,
        existingStatus: job.existingStatus ?? null,
        result: job.value,
      };
    } catch (error) {
      throw new Error(
        googleOperatorError(error, change.operation === "sync_google" ? "sync" : "connection-test")
          .message,
      );
    }
  }
  const current = await target(db, change);
  if (current.revision !== preview.revision)
    throw new Error("Workspace configuration changed while saving. Refresh and review again.");
  const result = await db.rpc("save_workspace_configuration", {
    p_change: change,
    p_expected: current.expected,
    p_actor_email: actorEmail,
  });
  if (result.error)
    throw new Error("Workspace configuration could not be saved. Refresh and review again.");
  return result.data;
}
export async function executeWorkspaceConfiguration(
  db: SupabaseClient,
  raw: unknown,
  actorEmail: string,
  actionId: string,
) {
  const payload = z
    .object({
      version: z.literal(1),
      tenantId: z.uuid(),
      change: workspaceChangeSchema,
      revision: z.string().length(64),
      before: z.record(z.string(), z.unknown()),
      after: z.record(z.string(), z.unknown()),
      consequences: z.string(),
      digest: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict()
    .parse(raw);
  const { digest, ...facts } = payload;
  if (payload.tenantId !== workspace(db) || configurationDigest(facts) !== digest)
    throw new Error("Approval does not match its workspace or exact preview");
  const receipt = await applyWorkspaceConfigurationAsAdmin(
    db,
    payload.change,
    actorEmail,
    digest,
    `workspace-config:${actionId}`,
  );
  if (receipt && "success" in receipt && receipt.success === false) {
    await checkpointActionResult(db, actionId, receipt);
    throw new Error(
      "Google work did not complete. Inspect this action's job/source receipts before preparing a new bounded retry; completed source work remains.",
    );
  }
  return receipt;
}
