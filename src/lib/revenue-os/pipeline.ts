import "server-only";
import { systemSourceForDatabase } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit } from "./audit";
import { resolveOrCreateIdentity } from "./identity";
import { normalizeEmail } from "./db";
import { recordActivity } from "./activities";
import { createDetectOverduePaymentsWork } from "./finance-coworker";
import { createRevenueStageAuditWork } from "./finance-coworker";
import { createDetectStaleDealsWork } from "./business-pulse-coworker";
import { createDataQualityScanWork } from "./operations-coworker";

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
  const { data, error } = await supabase
    .from("opportunities")
    .insert({
      name: input.opportunityName?.trim() || identity.company.name,
      contact_id: identity.contact.id,
      company_id: identity.company.id,
      email,
      stage: "new",
      source,
      estimated_value: Math.max(0, Number(input.estimatedValue) || 0),
      next_action: input.nextAction?.trim() || null,
      // An empty string (the common case: the create form's date field left
      // blank) is not a valid timestamp — Postgres rejects it outright,
      // unlike a genuinely absent field. Only a non-empty value is passed
      // through.
      next_action_at: input.nextActionAt?.trim() ? input.nextActionAt : null,
      owner_email: input.actorEmail,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await Promise.all([
    recordAudit(supabase, {
      actorEmail: input.actorEmail,
      action: "opportunity.created",
      entityType: "opportunity",
      entityId: data.id,
      after: data,
    }),
    supabase.from("stage_events").insert({
      opportunity_id: data.id,
      from_stage: null,
      to_stage: "new",
      source,
      actor_email: input.actorEmail,
      reason: "Opportunity created",
    }),
    recordActivity(supabase, {
      activityType: "opportunity_created",
      title: `Opportunity created: ${data.name || identity.company.name}`,
      opportunityId: data.id,
      contactId: identity.contact.id,
      companyId: identity.company.id,
      source,
      actorEmail: input.actorEmail,
      externalId: `opportunity:${data.id}:created`,
      metadata: { stage: "new", estimated_value: data.estimated_value },
    }),
  ]);
  return data;
}

export interface OpportunityDetailsInput {
  id: string;
  actorEmail: string;
  nextAction?: string | null;
  nextActionAt?: string | null;
  estimatedValue?: number | null;
  expectedUpdatedAt?: string;
  effectKey?: string;
}
export interface OpportunityTransitionInput {
  id: string;
  to: string;
  actorEmail: string;
  source?: string;
  reason?: string;
  lossReason?: string;
  allowTerminalReopen?: boolean;
  sortOrder?: number;
  effectKey?: string;
}
export function opportunityDetailsPatch(input: Omit<OpportunityDetailsInput, "id" | "actorEmail">) {
  const allowed: Record<string, unknown> = {};
  if (input.nextAction !== undefined) {
    const value = input.nextAction?.trim() || null;
    if (value && value.length > 500) throw new Error("Next action is limited to 500 characters");
    allowed.next_action = value;
  }
  if (input.nextActionAt !== undefined) {
    if (input.nextActionAt && Number.isNaN(Date.parse(input.nextActionAt)))
      throw new Error("Next action time is invalid");
    allowed.next_action_at = input.nextActionAt ? new Date(input.nextActionAt).toISOString() : null;
  }
  if (input.estimatedValue !== undefined) {
    const value = input.estimatedValue ?? 0;
    if (!Number.isFinite(value) || value < 0 || value > 1_000_000_000)
      throw new Error("Estimated value must be between 0 and 1,000,000,000");
    allowed.estimated_value = value;
  }
  if (!Object.keys(allowed).length) throw new Error("No valid updates supplied");

  return allowed;
}

export async function updateOpportunityDetails(
  supabase: SupabaseClient,
  input: OpportunityDetailsInput,
) {
  const patch = opportunityDetailsPatch(input);
  const { executePipelineChange } = await import("./action-executor");
  return executePipelineChange(supabase, "update_opportunity_details", input.actorEmail, {
    opportunityId: input.id,
    patch,
    expectedUpdatedAt: input.expectedUpdatedAt,
    effectKey: input.effectKey,
  });
}
export async function transitionOpportunity(
  supabase: SupabaseClient,
  input: OpportunityTransitionInput,
) {
  const { executePipelineChange } = await import("./action-executor");
  const { id, to, actorEmail, ...details } = input;
  return executePipelineChange(supabase, "transition_opportunity", actorEmail, {
    opportunityId: id,
    stage: to,
    ...details,
  });
}

/** The queue and bound system adapters share this atomic domain effect. */
export async function applyPipelineEffect(
  supabase: SupabaseClient,
  actionType: string,
  payload: Record<string, unknown>,
  actorEmail: string,
  actionId: string | null,
) {
  const systemSource = actionId === null ? systemSourceForDatabase(supabase) : null;
  if (actionId === null && !systemSource) throw new Error("Bound tenant system context required");
  const { data, error } = await supabase.rpc("apply_pipeline_action", {
    p_action_id: actionId,
    p_operation: actionType,
    p_payload: payload,
    p_actor: actorEmail,
    p_system_source: systemSource,
  });
  if (error) throw new Error(error.message);
  if (!data?.opportunity) throw new Error("Pipeline effect returned no opportunity receipt");
  if (data.changed && actionType === "transition_opportunity") {
    if (data.toRole === "won") {
      createDetectOverduePaymentsWork(supabase).catch(() => {});
      createDataQualityScanWork(supabase).catch(() => {});
    } else if (data.toRole === "lost") {
      createDetectStaleDealsWork(supabase).catch(() => {});
      createRevenueStageAuditWork(supabase).catch(() => {});
      createDataQualityScanWork(supabase).catch(() => {});
    } else if (["proposal", "negotiation"].includes(data.opportunity.stage)) {
      createDetectStaleDealsWork(supabase).catch(() => {});
      createRevenueStageAuditWork(supabase).catch(() => {});
    }
  }
  return data.opportunity;
}

export function transitionStatusFromError(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /changed while you were editing/i.test(message) ? 409 : 400;
}
