import "server-only";
import { pluginSettingsContract } from "./plugin-settings-contract";
import { MODULE_MAP } from "./modules";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import {
  moduleChangeSchema,
  modulePreviewSchema,
  moduleProposalSchema,
} from "./module-actions-contract";
import { configurationDigest, readModuleConfiguration } from "./module-configuration-read";
import { validateModuleSettingsInput } from "./modules";
import { updateModuleConfigurationAsAdmin } from "./module-configuration";
import { proposeAction } from "./actions";
const payloadSchema = z
  .object({
    version: z.literal(1),
    tenantId: z.uuid(),
    change: moduleChangeSchema,
    revision: z.string().regex(/^[a-f0-9]{64}$/),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
    before: z
      .object({
        enabled: z.boolean(),
        settings: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
      })
      .strict(),
    after: z
      .object({
        enabled: z.boolean(),
        settings: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
      })
      .strict(),
  })
  .strict();
export async function previewModuleConfiguration(db: SupabaseClient, raw: unknown) {
  let { change } = modulePreviewSchema.parse(raw);
  const current = (await readModuleConfiguration(db, { moduleId: change.moduleId })).modules[0]!;
  if ("enabled" in change && current.isCore) throw new Error("Core modules cannot be toggled");
  const definition = MODULE_MAP.get(change.moduleId)!;
  if ("enabled" in change && change.enabled && definition.settingsContract) {
    const readiness = pluginSettingsContract(definition.settingsContract).readiness(
      current.settings,
    );
    if (!readiness.ready)
      throw new Error(
        `Configure required plugin fields before enabling: ${readiness.missing.join(", ")}`,
      );
  }
  const before = { enabled: current.enabled, settings: current.settings };
  let after = before;
  if ("settings" in change) {
    const valid = validateModuleSettingsInput(change.moduleId, change.settings);
    if (!valid.valid) throw new Error(valid.error);
    change = { moduleId: change.moduleId, settings: valid.value };
    after = { ...before, settings: { ...before.settings, ...valid.value } };
  } else after = { ...before, enabled: change.enabled };
  if (configurationDigest(before) === configurationDigest(after))
    throw new Error("No module configuration values would change");
  const facts = {
    version: 1 as const,
    tenantId: tenantIdForDatabase(db)!,
    change,
    revision: current.revision,
    before,
    after,
  };
  return {
    ...facts,
    digest: configurationDigest(facts),
    requiresHumanApproval: true,
    consequences:
      "enabled" in change
        ? change.enabled
          ? "Enable module capabilities and install any missing bundled read policies. This does not send messages or run business workflows."
          : "Disable new module business execution. Existing records and receipts are retained. Already queued effects must recheck module availability."
        : "Update declared public module settings. Existing approved operations still follow their own freshness and policy checks.",
  };
}
export async function proposeModuleConfiguration(
  db: SupabaseClient,
  raw: unknown,
  actorEmail: string,
) {
  const input = moduleProposalSchema.parse(raw);
  const preview = await previewModuleConfiguration(db, { change: input.change });
  if (input.digest !== preview.digest)
    throw new Error("Module preview changed. Preview again before proposing.");
  const { requiresHumanApproval: _approval, consequences, ...payload } = preview;
  void _approval;
  return proposeAction(db, {
    actionType: "update_module_configuration",
    title: `Update ${preview.change.moduleId} configuration`,
    description: `${consequences}\nBefore: ${JSON.stringify(preview.before)}\nAfter: ${JSON.stringify(preview.after)}`,
    payload,
    sourceContext: "admin_ai",
    entityType: "tenant",
    entityId: preview.tenantId,
    dedupeKey: `module-config:${preview.tenantId}:${preview.digest}`,
    proposedBy: actorEmail,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  });
}
export async function executeModuleConfiguration(
  db: SupabaseClient,
  raw: unknown,
  actorEmail: string,
) {
  const parsed = payloadSchema.parse(raw);
  const { digest, ...facts } = parsed;
  if (parsed.tenantId !== tenantIdForDatabase(db) || configurationDigest(facts) !== digest)
    throw new Error("Module approval does not match its workspace or exact preview");
  // Recompute the semantic preview so stored before/after values cannot diverge from the operation.
  const current = await previewModuleConfiguration(db, { change: parsed.change });
  if (current.digest !== digest)
    throw new Error("Module configuration changed. Preview and approve again.");
  return updateModuleConfigurationAsAdmin(db, parsed.change, actorEmail, parsed.revision);
}
