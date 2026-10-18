import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import { assertCurrentTenantAdmin } from "./tenant-admin-authority";
import { configurationDigest } from "./module-configuration-read";
import { proposeAction } from "./actions";
import {
  blueprintReadSchema,
  blueprintPatchSchema,
  blueprintProposalSchema,
  blueprintSimulationSchema,
  type BlueprintPatchPreview,
} from "./architect-review-contract";
import {
  applyConversationalPatch,
  proposalToTypedPatch,
  simulateBlueprint,
} from "./architect-review-simulation";
import {
  collectBlueprintLiveContext,
  getLatestBlueprintVersion,
  listBlueprints,
  parseBlueprint,
  saveBlueprintVersion,
} from "./workspace-blueprint";

function tenant(db: SupabaseClient) {
  const id = tenantIdForDatabase(db);
  if (!id) throw new Error("A tenant-bound Blueprint workspace is required");
  return id;
}

export async function readArchitectBlueprint(db: SupabaseClient, raw: unknown) {
  const input = blueprintReadSchema.parse(raw);
  const tenantId = tenant(db);
  if (!input.blueprintId) return { blueprints: await listBlueprints(db, tenantId) };
  const current = await getLatestBlueprintVersion(db, { tenantId, blueprintId: input.blueprintId });
  return {
    blueprintId: input.blueprintId,
    version: current.version,
    document: parseBlueprint(current.document),
  };
}

export async function previewArchitectPatch(
  db: SupabaseClient,
  raw: unknown,
): Promise<BlueprintPatchPreview> {
  const command = blueprintPatchSchema.parse(raw);
  const current = await getLatestBlueprintVersion(db, {
    tenantId: tenant(db),
    blueprintId: command.blueprintId,
  });
  if (current.version !== command.expectedVersion)
    throw new Error("Blueprint version conflict. Reload the current draft before reviewing again.");
  const before = parseBlueprint(current.document);
  const { next, diff } = applyConversationalPatch(before, proposalToTypedPatch(command.proposal));
  const review: Record<string, string> = {
    Operation: "Save a new Blueprint draft version",
    "Current version": String(current.version),
    "Change summary": command.changeSummary,
    Consequence:
      "Saves a draft version and resets its approval. It does not apply the workspace, enable modules or send messages.",
  };
  for (const key of [...diff.added, ...diff.changed, ...diff.removed]) {
    const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
    const prior = before[key as keyof typeof before];
    const proposed = next[key as keyof typeof next];
    const text = (value: unknown) =>
      typeof value === "string" ? value : JSON.stringify(value ?? null);
    review[`Current ${label.toLowerCase()}`] = text(prior);
    review[`Proposed ${label.toLowerCase()}`] = text(proposed);
  }
  return {
    command,
    before,
    next,
    diff,
    review,
    digest: configurationDigest({ tenantId: tenant(db), command, before, next, review }),
  };
}

export async function proposeArchitectPatch(db: SupabaseClient, raw: unknown, actorEmail: string) {
  await assertCurrentTenantAdmin(db, actorEmail);
  const { digest, ...command } = blueprintProposalSchema.parse(raw);
  const { data: prior, error } = await db
    .from("action_queue")
    .select("*")
    .eq("dedupe_key", `blueprint:${command.requestId}`)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error)
    throw new Error("The original Blueprint request could not be checked. Retry the same request.");
  if (prior) {
    if (
      prior.action_type !== "blueprint_draft_change" ||
      prior.payload?.digest !== digest ||
      configurationDigest(prior.payload?.command) !== configurationDigest(command)
    )
      throw new Error("This request ID belongs to a different Blueprint change");
    return prior;
  }
  const preview = await previewArchitectPatch(db, command);
  if (preview.digest !== digest)
    throw new Error("Blueprint details changed. Prepare a fresh review.");
  const action = await proposeAction(db, {
    actionType: "blueprint_draft_change",
    title: preview.review.Operation!,
    description: preview.review.Consequence,
    payload: { ...preview },
    proposedBy: actorEmail,
    explicit: true,
    sourceContext: "Administrator requested a versioned Blueprint draft change.",
    dedupeKey: `blueprint:${command.requestId}`,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  });
  if (!action || action.payload?.digest !== digest)
    throw new Error("This request ID belongs to a different Blueprint change");
  return action;
}

export async function executeArchitectPatch(
  db: SupabaseClient,
  actionId: string,
  actorEmail: string,
) {
  const tenantId = await assertCurrentTenantAdmin(db, actorEmail);
  const { data: action, error } = await db
    .from("action_queue")
    .select("*")
    .eq("id", actionId)
    .eq("status", "executing")
    .maybeSingle();
  if (
    error ||
    action?.action_type !== "blueprint_draft_change" ||
    action.approved_by !== actorEmail ||
    !action.expires_at ||
    Date.parse(action.expires_at) <= Date.now()
  )
    throw new Error("A current human-approved Blueprint change is required");
  const command = blueprintPatchSchema.parse(action.payload?.command);
  const { before, next, review } = action.payload as BlueprintPatchPreview;
  if (configurationDigest({ tenantId, command, before, next, review }) !== action.payload.digest)
    throw new Error("The reviewed Blueprint change was modified");
  const saved = await saveBlueprintVersion(db, {
    tenantId,
    blueprintId: command.blueprintId,
    document: next,
    changeSummary: command.changeSummary,
    actorEmail,
    createdBy: actorEmail,
    expectedVersion: command.expectedVersion,
    requestKey: command.requestId,
  });
  return {
    blueprintId: saved.blueprintId,
    version: saved.version.version,
    applied: false,
    message: `Blueprint draft version ${saved.version.version} saved. Workspace application requires its separate approval.`,
  };
}

export async function simulateArchitectBlueprint(db: SupabaseClient, raw: unknown) {
  const input = blueprintSimulationSchema.parse(raw);
  const tenantId = tenant(db);
  const [current, context] = await Promise.all([
    getLatestBlueprintVersion(db, { tenantId, blueprintId: input.blueprintId }),
    collectBlueprintLiveContext(db, tenantId),
  ]);
  return simulateBlueprint(parseBlueprint(current.document), context, { event: input.event });
}
