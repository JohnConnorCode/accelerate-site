import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit } from "./audit";
import { LEGACY_STAGE_MAP, REVENUE_STAGE_META, REVENUE_STAGES, type RevenueStage } from "./types";

const TRANSITIONS: Record<RevenueStage, readonly RevenueStage[]> = {
  new: ["contacted", "qualified", "nurture", "lost"],
  contacted: ["qualified", "meeting", "nurture", "lost"],
  qualified: ["meeting", "proposal", "nurture", "lost"],
  meeting: ["proposal", "qualified", "nurture", "lost"],
  proposal: ["negotiation", "won", "lost", "nurture"],
  negotiation: ["proposal", "won", "lost"],
  won: [],
  lost: ["nurture", "contacted"],
  nurture: ["contacted", "qualified", "lost"],
};

export function canonicalStage(stage: string): RevenueStage | null {
  if (REVENUE_STAGES.includes(stage as RevenueStage)) return stage as RevenueStage;
  return LEGACY_STAGE_MAP[stage] ?? null;
}

export function canTransition(from: string, to: RevenueStage): boolean {
  const canonicalFrom = canonicalStage(from);
  return canonicalFrom ? canonicalFrom === to || TRANSITIONS[canonicalFrom].includes(to) : false;
}

export async function transitionOpportunity(
  supabase: SupabaseClient,
  input: { id: string; to: RevenueStage; actorEmail: string; source?: string; reason?: string; lossReason?: string },
) {
  const { data: current, error: readError } = await supabase
    .from("opportunities")
    .select("id, stage, probability, won_value, estimated_value, loss_reason")
    .eq("id", input.id)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!current) throw new Error("Opportunity not found");
  if (!canTransition(current.stage, input.to)) {
    throw new Error(`Cannot move an opportunity from ${current.stage} to ${input.to}`);
  }
  if (input.to === "lost" && !input.lossReason?.trim()) {
    throw new Error("A loss reason is required when closing an opportunity as lost");
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    stage: input.to,
    probability: REVENUE_STAGE_META[input.to].probability,
    last_activity_at: now,
    closed_at: ["won", "lost"].includes(input.to) ? now : null,
  };
  if (input.to === "lost") patch.loss_reason = input.lossReason!.trim();
  if (input.to !== "lost") patch.loss_reason = null;
  if (input.to === "won" && Number(current.won_value || 0) === 0) patch.won_value = Number(current.estimated_value || 0);

  const { data: updated, error: updateError } = await supabase
    .from("opportunities")
    .update(patch)
    .eq("id", input.id)
    .eq("stage", current.stage)
    .select("*")
    .maybeSingle();
  if (updateError) throw new Error(updateError.message);
  if (!updated) throw new Error("The opportunity changed while you were editing it. Refresh and try again.");

  await Promise.all([
    supabase.from("stage_events").insert({
      opportunity_id: input.id,
      from_stage: current.stage,
      to_stage: input.to,
      source: input.source ?? "admin",
      actor_email: input.actorEmail,
      reason: input.reason ?? null,
      metadata: input.lossReason ? { loss_reason: input.lossReason } : {},
    }),
    recordAudit(supabase, {
      actorEmail: input.actorEmail,
      action: "opportunity.stage_changed",
      entityType: "opportunity",
      entityId: input.id,
      before: current,
      after: updated,
      metadata: { reason: input.reason ?? null },
    }),
  ]);

  return updated;
}
