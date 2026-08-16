import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit } from "./audit";

export const ACTION_URGENCY_ORDER = ["critical", "high", "normal", "low"] as const;
export type ActionUrgency = (typeof ACTION_URGENCY_ORDER)[number];

export async function proposeAction(supabase: SupabaseClient, input: {
  actionType: string;
  title: string;
  description?: string;
  urgency?: ActionUrgency;
  payload: Record<string, unknown>;
  reasoning?: string;
  sourceContext: string;
  entityType?: string;
  entityId?: string;
  dedupeKey?: string;
  proposedBy?: string;
  expiresAt?: string;
}) {
  const { data, error } = await supabase.from("action_queue").insert({
    action_type: input.actionType,
    title: input.title,
    description: input.description ?? null,
    urgency: input.urgency ?? "normal",
    payload: input.payload,
    reasoning: input.reasoning ?? null,
    source_context: input.sourceContext,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    dedupe_key: input.dedupeKey ?? null,
    proposed_by: input.proposedBy ?? null,
    expires_at: input.expiresAt ?? null,
  }).select("*").single();
  if (error) {
    if (error.code === "23505" && input.dedupeKey) {
      const { data: existing } = await supabase.from("action_queue").select("*").eq("dedupe_key", input.dedupeKey).eq("status", "pending").maybeSingle();
      if (existing) return existing;
    }
    throw new Error(error.message);
  }
  return data;
}

export async function claimApprovedAction(supabase: SupabaseClient, id: string, actorEmail: string) {
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("action_queue").update({
    status: "executing",
    approved_by: actorEmail,
    approved_at: now,
  }).eq("id", id).eq("status", "pending").or(`expires_at.is.null,expires_at.gt.${now}`).select("*").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("This action was already handled or has expired");
  await recordAudit(supabase, {
    actorEmail,
    action: "action.approved",
    entityType: "action_queue",
    entityId: id,
    after: { action_type: data.action_type, status: "executing" },
  });
  return data;
}

export async function finishAction(supabase: SupabaseClient, id: string, result: unknown) {
  const { error } = await supabase.from("action_queue").update({
    status: "executed",
    executed_at: new Date().toISOString(),
    result,
    error: null,
  }).eq("id", id).eq("status", "executing");
  if (error) throw new Error(error.message);
}

export async function failAction(supabase: SupabaseClient, id: string, errorMessage: string) {
  await supabase.from("action_queue").update({ status: "failed", error: errorMessage }).eq("id", id).eq("status", "executing");
}

export async function rejectAction(supabase: SupabaseClient, id: string, actorEmail: string, reason?: string) {
  const { data, error } = await supabase.from("action_queue").update({
    status: "rejected",
    approved_by: actorEmail,
    approved_at: new Date().toISOString(),
    result: reason ? { reason } : {},
  }).eq("id", id).eq("status", "pending").select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("This action was already handled");
  await recordAudit(supabase, { actorEmail, action: "action.rejected", entityType: "action_queue", entityId: id, metadata: { reason } });
}
