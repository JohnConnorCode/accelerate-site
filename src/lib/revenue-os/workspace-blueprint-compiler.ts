import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { proposeAction } from "./actions";
import { recordAudit } from "./audit";
import { updateModuleConfiguration } from "./module-configuration";
import { REVENUE_OS_MODULES } from "./modules";
import {
  collectBlueprintLiveContext,
  parseBlueprint,
  validateAgainstCapabilities,
  type BlueprintLiveContext,
  type WorkspaceBlueprint,
} from "./workspace-blueprint";

export interface CompilerItem {
  ref: string;
  key: string;
  reason: string;
}

export interface CustomAppBrief {
  id: string;
  title: string;
  missingKey: string;
  why: string;
  boundary: string;
}

export interface BlueprintCompilePlan {
  canApply: boolean;
  ready: CompilerItem[];
  approvals: CompilerItem[];
  blocked: CompilerItem[];
  customAppBriefs: CustomAppBrief[];
  moduleTargets: string[];
}

function resolveModuleId(targetKey: string): string | null {
  const key = targetKey.trim().toLowerCase();
  for (const moduleDef of REVENUE_OS_MODULES) {
    if (moduleDef.id === key) return moduleDef.id;
    if (moduleDef.navLinkIds.includes(key)) return moduleDef.id;
    if (moduleDef.routes?.some((route) => route === `/admin/${key}` || route.endsWith(`/${key}`)))
      return moduleDef.id;
  }
  return null;
}

export function compileBlueprintPlan(
  blueprint: WorkspaceBlueprint,
  context: BlueprintLiveContext,
): BlueprintCompilePlan {
  const validation = validateAgainstCapabilities(blueprint, context);
  const blocked: CompilerItem[] = validation.blocked
    .filter((item) => {
      if (item.kind === "unknown_capability" || item.kind === "unknown_integration") return false;
      if (item.kind === "unknown_navigation_target" && resolveModuleId(item.key)) return false;
      return true;
    })
    .map((item) => ({ ref: item.ref, key: item.key, reason: item.reason }));
  const unknown = validation.blocked.filter(
    (item) => item.kind === "unknown_capability" || item.kind === "unknown_integration",
  );
  const customAppBriefs: CustomAppBrief[] = unknown.map((item) => ({
    id: `brief:${item.ref}:${item.key}`,
    title: `Custom App Brief for ${item.key}`,
    missingKey: item.key,
    why: item.reason,
    boundary:
      "Keep using existing primitives. Do not generate SQL, migrations or a second runtime. A bounded Custom App can be designed later if this requirement stays unsupported.",
  }));
  const moduleTargets = [
    ...new Set(
      blueprint.navigation.flatMap((item) => {
        if (item.targetType !== "module") return [];
        const resolved = resolveModuleId(item.targetKey);
        return resolved ? [resolved] : [];
      }),
    ),
  ].sort();
  const ready: CompilerItem[] = validation.ready.map((ref) => {
    const key = ref.split(":").pop() ?? ref;
    return { ref, key, reason: "Registered and available" };
  });
  return {
    canApply: blocked.length === 0,
    ready,
    approvals: validation.approvals.map((item) => ({
      ref: item.ref,
      key: item.key,
      reason: item.reason,
    })),
    blocked,
    customAppBriefs,
    moduleTargets,
  };
}

function requireUuid(value: string, field: string): string {
  const trimmed = value.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    throw new Error(`${field} must be a UUID`);
  }
  return trimmed;
}

export async function approveBlueprint(
  supabase: SupabaseClient,
  input: { tenantId: string; blueprintId: string; version: number; actorEmail?: string | null },
): Promise<{ status: string }> {
  const tenantId = requireUuid(input.tenantId, "tenantId");
  const blueprintId = requireUuid(input.blueprintId, "blueprintId");
  if (!Number.isInteger(input.version) || input.version < 1) throw new Error("version is required");
  const { data, error } = await supabase
    .from("workspace_blueprints")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", blueprintId)
    .eq("latest_version", input.version)
    .select("status")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Blueprint version was not found for approval");
  await recordAudit(supabase, {
    actorEmail: input.actorEmail ?? null,
    action: "blueprint.approved",
    entityType: "workspace_blueprint",
    entityId: blueprintId,
    source: "admin",
    after: { version: input.version },
  });
  return { status: String((data as { status: string }).status) };
}

export interface ApplyAdapters {
  collectContext?: (supabase: SupabaseClient, tenantId: string) => Promise<BlueprintLiveContext>;
  proposeAction?: typeof proposeAction;
  enableModule?: (supabase: SupabaseClient, moduleId: string, actorEmail: string) => Promise<void>;
}

export interface BlueprintApplyReceipt {
  blueprintId: string;
  version: number;
  approvals: CompilerItem[];
  customAppBriefs: CustomAppBrief[];
  moduleTargets: string[];
}

export async function applyApprovedBlueprint(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    blueprintId: string;
    version: number;
    requestKey: string;
    actorEmail: string;
  },
  adapters: ApplyAdapters = {},
): Promise<{ replayed: boolean; receipt: BlueprintApplyReceipt }> {
  const tenantId = requireUuid(input.tenantId, "tenantId");
  const blueprintId = requireUuid(input.blueprintId, "blueprintId");
  const requestKey = input.requestKey.trim();
  if (!requestKey) throw new Error("requestKey is required");
  if (!Number.isInteger(input.version) || input.version < 1) throw new Error("version is required");

  const { data: existing } = await supabase
    .from("workspace_blueprint_applies")
    .select("receipt")
    .eq("tenant_id", tenantId)
    .eq("request_key", requestKey)
    .maybeSingle();
  if (existing?.receipt) {
    return { replayed: true, receipt: existing.receipt as BlueprintApplyReceipt };
  }

  const { data: blueprint, error: blueprintError } = await supabase
    .from("workspace_blueprints")
    .select("id,status,latest_version")
    .eq("tenant_id", tenantId)
    .eq("id", blueprintId)
    .maybeSingle();
  if (blueprintError || !blueprint) throw new Error("Blueprint not found in this workspace");
  if ((blueprint as { status: string }).status !== "approved") {
    throw new Error("Only an approved Blueprint can be applied");
  }

  const { data: version, error: versionError } = await supabase
    .from("workspace_blueprint_versions")
    .select("document,version")
    .eq("tenant_id", tenantId)
    .eq("blueprint_id", blueprintId)
    .eq("version", input.version)
    .maybeSingle();
  if (versionError || !version) throw new Error("Blueprint version was not found");
  const document = parseBlueprint((version as { document: unknown }).document);
  const context = await (adapters.collectContext ?? collectBlueprintLiveContext)(
    supabase,
    tenantId,
  );
  const plan = compileBlueprintPlan(document, context);
  if (!plan.canApply) {
    throw new Error(
      `Blueprint apply is blocked: ${plan.blocked.map((item) => item.key).join(", ")}`,
    );
  }

  const receipt: BlueprintApplyReceipt = {
    blueprintId,
    version: input.version,
    approvals: plan.approvals,
    customAppBriefs: plan.customAppBriefs,
    moduleTargets: plan.moduleTargets,
  };

  const { error: insertError } = await supabase.from("workspace_blueprint_applies").insert({
    tenant_id: tenantId,
    blueprint_id: blueprintId,
    version: input.version,
    request_key: requestKey,
    receipt,
  });
  if (insertError) {
    if ((insertError as { code?: string }).code === "23505") {
      const { data: replayed } = await supabase
        .from("workspace_blueprint_applies")
        .select("receipt")
        .eq("tenant_id", tenantId)
        .eq("request_key", requestKey)
        .maybeSingle();
      if (replayed?.receipt)
        return { replayed: true, receipt: replayed.receipt as BlueprintApplyReceipt };
    }
    throw new Error(insertError.message);
  }

  const propose = adapters.proposeAction ?? proposeAction;
  for (const item of plan.approvals) {
    await propose(supabase, {
      actionType: "apply_blueprint_step",
      title: `Apply Blueprint step ${item.key}`,
      payload: { blueprintId, version: input.version, ref: item.ref, capabilityKey: item.key },
      sourceContext: "workspace-blueprint-compiler",
      entityType: "workspace_blueprint",
      entityId: blueprintId,
      dedupeKey: `blueprint:${blueprintId}:v${input.version}:${item.ref}`,
      proposedBy: input.actorEmail,
    });
  }

  const enable =
    adapters.enableModule ??
    (async (db: SupabaseClient, moduleId: string, actorEmail: string) => {
      await updateModuleConfiguration(db, { moduleId, enabled: true }, actorEmail);
    });
  for (const moduleId of plan.moduleTargets) {
    const moduleDef = REVENUE_OS_MODULES.find((entry) => entry.id === moduleId);
    if (!moduleDef || moduleDef.isCore) continue;
    await enable(supabase, moduleId, input.actorEmail);
  }

  await supabase
    .from("workspace_blueprints")
    .update({ status: "applied", updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", blueprintId);

  await recordAudit(supabase, {
    actorEmail: input.actorEmail,
    action: "blueprint.applied",
    entityType: "workspace_blueprint",
    entityId: blueprintId,
    source: "admin",
    after: receipt,
  });

  return { replayed: false, receipt };
}
