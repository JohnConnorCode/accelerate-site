import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import { getTenantRequestContext } from "@/lib/tenancy/context";
import { defaultTodayViews, todayDocumentSchema, todaySaveSchema, type TodaySavedState } from "@/lib/admin/today-workspace";
import { getCurrentLayout } from "./admin-layout";
import { proposeAction } from "./actions";
import { z } from "zod";

function actor(db: SupabaseClient) {
  const context = getTenantRequestContext();
  if (context?.kind !== "actor" || context.tenant.id !== tenantIdForDatabase(db) || context.database !== db)
    throw new Error("An authenticated workspace member is required.");
  return context;
}
export async function readTodayViews(db: SupabaseClient) {
  const context = actor(db);
  const { data, error } = await db.from("today_workspace_views").select("owner_key,revision,document")
    .eq("tenant_id", context.tenant.id).in("owner_key", ["workspace", context.user.id]);
  if (error) throw new Error("Saved views are unavailable. Your layout has not been changed.");
  const result = defaultTodayViews(await getCurrentLayout(db, "page.today", context.tenant.id));
  result.tenantId = context.tenant.id; result.userId = context.user.id;
  result.canManageWorkspace = context.role === "admin";
  for (const row of data ?? []) {
    const parsed = todayDocumentSchema.safeParse(row.document);
    if (!parsed.success) throw new Error("A saved view needs recovery. Your stored preferences are preserved.");
    result[row.owner_key === "workspace" ? "workspace" : "personal"] = { revision: Number(row.revision), document: parsed.data };
  }
  return result;
}
export async function saveTodayViews(db: SupabaseClient, raw: unknown) {
  const context = actor(db);
  const input = todaySaveSchema.parse(raw);
  if (input.scope === "workspace" && context.role !== "admin") throw new Error("Workspace administrator access required.");
  const { data, error } = await db.rpc("save_today_views", {
    p_owner_key: input.scope === "workspace" ? "workspace" : context.user.id,
    p_revision: input.revision, p_document: input.document, p_request_id: input.requestId,
  });
  if (error) throw new Error(error.code === "40001" ? "Today views changed in another session. Reload before saving." : "Your view could not be saved. Retry with the same changes.");
  return data as TodaySavedState;
}
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export async function previewTodayViewChange(db: SupabaseClient, raw: unknown) {
  const input = todaySaveSchema.parse(raw);
  const current = await readTodayViews(db);
  if (current[input.scope].revision !== input.revision) throw new Error("Today views changed. Read and preview again.");
  if (input.scope === "workspace" && !current.canManageWorkspace) throw new Error("Workspace administrator access required.");
  const facts = { tenantId: current.tenantId, userId: current.userId, change: input };
  return { ...facts, before: current[input.scope].document, after: input.document, digest: hash(facts), requiresHumanApproval: true };
}
export async function proposeTodayViewChange(db: SupabaseClient, raw: unknown, actorEmail: string) {
  const input = z.object({ change: todaySaveSchema, digest: z.string().length(64) }).strict().parse(raw);
  const preview = await previewTodayViewChange(db, input.change);
  if (input.digest !== preview.digest) throw new Error("Today preview changed. Preview again.");
  // Keep personal layouts out of the workspace-wide action queue.
  const stored = await db.from("today_view_proposals").insert({
    tenant_id: preview.tenantId, actor_id: preview.userId, digest: preview.digest, preview,
  });
  if (stored.error && stored.error.code !== "23505") throw new Error("Could not retain the exact Today preview.");
  return proposeAction(db, {
    actionType: "today_view_change", title: "Update Today workspace",
    description: `Save ${input.change.document.views.length} ${input.change.scope} views and their preferences.`,
    payload: { tenantId: preview.tenantId, userId: preview.userId, digest: preview.digest },
    dedupeKey: "today-view:" + preview.digest, proposedBy: actorEmail, sourceContext: "admin_ai",
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  });
}
export async function readTodayViewProposal(db: SupabaseClient, digest: string) {
  z.string().regex(/^[a-f0-9]{64}$/).parse(digest);
  const context = actor(db);
  const { data, error } = await db.from("today_view_proposals").select("preview")
    .eq("tenant_id", context.tenant.id).eq("actor_id", context.user.id).eq("digest", digest).single();
  if (error || !data) throw new Error("Only the proposing member can review this Today change.");
  const preview = z.object({ tenantId: z.uuid(), userId: z.uuid(), change: todaySaveSchema, before: todayDocumentSchema, after: todayDocumentSchema, digest: z.string().length(64), requiresHumanApproval: z.literal(true) }).strict().parse(data.preview);
  if (context.tenant.id !== preview.tenantId || context.user.id !== preview.userId || digest !== hash({ tenantId: preview.tenantId, userId: preview.userId, change: preview.change }))
    throw new Error("Today approval does not match this member, workspace or exact change.");
  return preview;
}
export async function executeTodayViewChange(db: SupabaseClient, raw: unknown) {
  const input = z.object({ tenantId: z.uuid(), userId: z.uuid(), digest: z.string().length(64) }).strict().parse(raw);
  const context = actor(db);
  if (context.tenant.id !== input.tenantId || context.user.id !== input.userId)
    throw new Error("Only the proposing member can approve this Today change.");
  const preview = await readTodayViewProposal(db, input.digest);
  return saveTodayViews(db, preview.change);
}
