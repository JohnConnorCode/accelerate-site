import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit } from "./audit";
import { resolveOrCreateIdentity } from "./identity";
import { LEGACY_STAGE_MAP, REVENUE_STAGE_META, REVENUE_STAGES, type RevenueStage } from "./types";
import { normalizeEmail } from "./db";

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

export function canTransition(from: string, to: string): boolean {
  const canonicalFrom = canonicalStage(from);
  const canonicalTo = canonicalStage(to);
  return canonicalFrom && canonicalTo ? canonicalFrom === canonicalTo || TRANSITIONS[canonicalFrom].includes(canonicalTo) : false;
}

const TERMINAL_REOPEN_POLICY: Record<"won" | "lost", readonly RevenueStage[]> = {
  won: [],
  lost: ["contacted", "nurture"],
};

function isTerminalStage(stage: RevenueStage) {
  return stage === "won" || stage === "lost";
}

function requireReopenEligibility(from: RevenueStage, to: RevenueStage, reason: string | undefined, allowReopen: boolean) {
  if (!isTerminalStage(from) || from === to) return;
  if (!allowReopen) throw new Error(`Reopen policy for terminal-stage opportunities is disabled for ${from}->${to}.`);
  if (!reason?.trim()) throw new Error(`A reason is required to reopen ${from} opportunities.`);
  if (!TERMINAL_REOPEN_POLICY[from].includes(to)) {
    throw new Error(`Reopening ${from} opportunities to ${to} is not allowed by policy.`);
  }
}

export async function createOpportunity(
  supabase: SupabaseClient,
  input: {
    actorEmail: string;
    name: string;
    email: string;
    phone?: string | null;
    companyName?: string | null;
    website?: string | null;
    industry?: string | null;
    opportunityName?: string | null;
    estimatedValue?: number | null;
    nextAction?: string | null;
    nextActionAt?: string | null;
    source?: string;
  },
) {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  if (!name || !email) throw new Error("Name and email are required");
  const source = input.source ?? "manual";
  const identity = await resolveOrCreateIdentity(supabase, {
    name,
    email,
    phone: input.phone ?? null,
    companyName: input.companyName ?? null,
    website: input.website ?? null,
    industry: input.industry ?? null,
    source,
  });
  const { data, error } = await supabase.from("opportunities").insert({
    name: input.opportunityName?.trim() || identity.company.name,
    contact_id: identity.contact.id,
    company_id: identity.company.id,
    email,
    stage: "new",
    source,
    estimated_value: Math.max(0, Number(input.estimatedValue) || 0),
    next_action: input.nextAction ?? null,
    next_action_at: input.nextActionAt ?? null,
    owner_email: input.actorEmail,
  }).select("*").single();
  if (error) throw new Error(error.message);

  await Promise.all([
    recordAudit(supabase, { actorEmail: input.actorEmail, action: "opportunity.created", entityType: "opportunity", entityId: data.id, after: data }),
    supabase.from("stage_events").insert({ opportunity_id: data.id, from_stage: null, to_stage: "new", source, actor_email: input.actorEmail, reason: "Opportunity created" }),
    supabase.from("activities").insert({ activity_type: "opportunity_created", title: `Opportunity created: ${data.name || identity.company.name}`, opportunity_id: data.id, contact_id: identity.contact.id, company_id: identity.company.id, source, actor_email: input.actorEmail, external_id: `opportunity:${data.id}:created`, metadata: { stage: "new", estimated_value: data.estimated_value } }),
  ]);
  return data;
}

export async function updateOpportunityDetails(
  supabase: SupabaseClient,
  input: { id: string; actorEmail: string; nextAction?: string | null; nextActionAt?: string | null; estimatedValue?: number | null },
) {
  const allowed: Record<string, unknown> = {};
  if (input.nextAction !== undefined) allowed.next_action = input.nextAction;
  if (input.nextActionAt !== undefined) allowed.next_action_at = input.nextActionAt;
  if (input.estimatedValue !== undefined) allowed.estimated_value = Math.max(0, input.estimatedValue || 0);
  if (!Object.keys(allowed).length) throw new Error("No valid updates supplied");

  const { data: before, error: beforeError } = await supabase.from("opportunities").select("*").eq("id", input.id).maybeSingle();
  if (beforeError) throw new Error(beforeError.message);
  if (!before) throw new Error("Opportunity not found");
  const { data, error } = await supabase.from("opportunities").update(allowed).eq("id", input.id).select("*").single();
  if (error) throw new Error(error.message);
  await recordAudit(supabase, { actorEmail: input.actorEmail, action: "opportunity.updated", entityType: "opportunity", entityId: input.id, before, after: data });
  return data;
}

export async function transitionOpportunity(
  supabase: SupabaseClient,
  input: { id: string; to: string; actorEmail: string; source?: string; reason?: string; lossReason?: string; allowTerminalReopen?: boolean },
) {
  const { data: current, error: readError } = await supabase
    .from("opportunities")
    .select("id, stage, probability, won_value, estimated_value, loss_reason")
    .eq("id", input.id)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!current) throw new Error("Opportunity not found");
  const canonicalFrom = canonicalStage(current.stage);
  if (!canonicalFrom) throw new Error(`Current stage ${current.stage} is not recognized`);
  const canonicalTo = canonicalStage(input.to);
  if (!canonicalTo) throw new Error(`Cannot move an opportunity to unknown stage ${input.to}`);
  if (!canTransition(current.stage, canonicalTo)) {
    throw new Error(`Cannot move an opportunity from ${current.stage} to ${input.to}`);
  }
  requireReopenEligibility(canonicalFrom, canonicalTo, input.reason, Boolean(input.allowTerminalReopen));
  if (canonicalTo === "lost" && !input.lossReason?.trim()) {
    throw new Error("A loss reason is required when closing an opportunity as lost");
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    stage: canonicalTo,
    probability: REVENUE_STAGE_META[canonicalTo].probability,
    last_activity_at: now,
    closed_at: ["won", "lost"].includes(canonicalTo) ? now : null,
  };
  if (canonicalTo === "lost") patch.loss_reason = input.lossReason!.trim();
  if (canonicalTo !== "lost") patch.loss_reason = null;
  if (canonicalTo === "won" && Number(current.won_value || 0) === 0) patch.won_value = Number(current.estimated_value || 0);

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
      to_stage: canonicalTo,
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

export function transitionStatusFromError(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /changed while you were editing/i.test(message) ? 409 : 400;
}
