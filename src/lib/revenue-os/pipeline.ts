import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit } from "./audit";
import { resolveOrCreateIdentity } from "./identity";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { opportunityCreateSchema } from "./opportunity-create-contract";
import { callOpportunityCreateHostRpc, tenantIdForDatabase } from "@/lib/supabase/server";
import type { TenantActorContext } from "@/lib/tenancy/context";
import { recordActivity } from "./activities";
import { loadPipelineStages } from "./pipeline-stage-resolver";
import { createDetectOverduePaymentsWork } from "./finance-coworker";
import { createRevenueStageAuditWork } from "./finance-coworker";
import { createDetectStaleDealsWork } from "./business-pulse-coworker";
import { createDataQualityScanWork } from "./operations-coworker";

import { requireReopenEligibility } from "./pipeline-transition-policy";

export async function createOpportunity(
  supabase: SupabaseClient,
  input: {
    actorEmail: string;
    requestId?: string;
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
  actor?: TenantActorContext,
) {
  const tenantId = tenantIdForDatabase(supabase);
  if (!tenantId) throw new Error("Opportunity creation requires a tenant-bound workspace");
  // Compatibility callers without a key deliberately start a new intent. HTTP
  // adapters must retain and supply the key across uncertain saves.
  const { actorEmail, requestId = randomUUID(), ...raw } = input;
  z.string().trim().min(1).max(200).parse(requestId);
  const intent = opportunityCreateSchema.parse(raw);
  const execute = (contactId: string | null, companyId: string | null) =>
    callOpportunityCreateHostRpc(
      supabase,
      {
        p_tenant: tenantId,
        p_actor_email: actorEmail,
        p_request_id: requestId,
        p_input: intent,
        p_contact: contactId,
        p_company: companyId,
      },
      actor,
    );
  // The private receipt is host-owned. Client-appended audit rows cannot forge
  // a replay result, and a completed retry does not resolve new identities.
  let { data, error } = await execute(null, null);
  if (!error && !data) {
    const identity = await resolveOrCreateIdentity(supabase, { ...intent });
    ({ data, error } = await execute(identity.contact.id, identity.company.id));
  }
  if (error) {
    const message =
      error.code === "40001"
        ? "This save request already belongs to different opportunity details. Start a new opportunity."
        : error.code === "42501"
          ? "Workspace administrator access is unavailable."
          : "The save could not be confirmed. Retry the same request to recover it.";
    throw Object.assign(new Error(message), { code: error.code });
  }
  if (!data?.id)
    throw new Error("The save returned no opportunity receipt. Retry the same request.");
  return data;
}

export async function updateOpportunityDetails(
  supabase: SupabaseClient,
  input: {
    id: string;
    actorEmail: string;
    nextAction?: string | null;
    nextActionAt?: string | null;
    estimatedValue?: number | null;
    expectedUpdatedAt?: string;
  },
) {
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

  const { data: before, error: beforeError } = await supabase
    .from("opportunities")
    .select("*")
    .eq("id", input.id)
    .maybeSingle();
  if (beforeError) throw new Error(beforeError.message);
  if (!before) throw new Error("Opportunity not found");
  let update = supabase.from("opportunities").update(allowed).eq("id", input.id);
  if (input.expectedUpdatedAt) update = update.eq("updated_at", input.expectedUpdatedAt);
  const { data, error } = await update.select("*").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data)
    throw new Error("The opportunity changed while you were editing it. Refresh and try again.");
  await recordAudit(supabase, {
    actorEmail: input.actorEmail,
    action: "opportunity.updated",
    entityType: "opportunity",
    entityId: input.id,
    before,
    after: data,
  });
  return data;
}

export async function transitionOpportunity(
  supabase: SupabaseClient,
  input: {
    id: string;
    to: string;
    actorEmail: string;
    source?: string;
    reason?: string;
    lossReason?: string;
    allowTerminalReopen?: boolean;
    /** Position within the target column (drag-and-drop); omitted keeps the
     * existing sort_order untouched, e.g. for non-drag stage changes. */
    sortOrder?: number;
  },
) {
  const { data: current, error: readError } = await supabase
    .from("opportunities")
    .select("id, tenant_id, stage, probability, won_value, estimated_value, loss_reason")
    .eq("id", input.id)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!current) throw new Error("Opportunity not found");

  const stages = await loadPipelineStages(supabase, current.tenant_id);
  const canonicalFrom = stages.canonicalStage(current.stage);
  if (!canonicalFrom) throw new Error(`Invalid pipeline stage: ${current.stage}`);
  const canonicalTo = stages.canonicalStage(input.to);
  if (!canonicalTo) throw new Error(`Cannot move an opportunity to unknown stage ${input.to}`);

  const fromMeta = stages.getMeta(canonicalFrom)!;
  const toMeta = stages.getMeta(canonicalTo)!;

  requireReopenEligibility(
    fromMeta.role,
    toMeta.role,
    canonicalFrom,
    canonicalTo,
    input.reason,
    Boolean(input.allowTerminalReopen),
  );
  if (toMeta.role === "lost" && !input.lossReason?.trim()) {
    throw new Error("A loss reason is required when closing an opportunity as lost");
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    stage: canonicalTo,
    probability: toMeta.probability,
    last_activity_at: now,
    closed_at: toMeta.role !== "open" ? now : null,
  };
  if (toMeta.role === "lost") patch.loss_reason = input.lossReason!.trim();
  else patch.loss_reason = null;
  if (toMeta.role === "won" && Number(current.won_value || 0) === 0)
    patch.won_value = Number(current.estimated_value || 0);
  if (Number.isFinite(input.sortOrder)) patch.sort_order = input.sortOrder;

  const { data: updated, error: updateError } = await supabase
    .from("opportunities")
    .update(patch)
    .eq("id", input.id)
    .eq("stage", current.stage)
    .select("*")
    .maybeSingle();
  if (updateError) throw new Error(updateError.message);
  if (!updated)
    throw new Error("The opportunity changed while you were editing it. Refresh and try again.");

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
    recordActivity(supabase, {
      activityType: "opportunity_stage_changed",
      title: `Opportunity moved to ${toMeta.label}`,
      summary: input.reason?.trim() || null,
      opportunityId: input.id,
      source: input.source ?? "admin",
      actorEmail: input.actorEmail,
      externalId: `opportunity:${input.id}:stage:${canonicalFrom}:${canonicalTo}:${now}`,
      metadata: {
        from_stage: canonicalFrom,
        to_stage: canonicalTo,
        loss_reason: input.lossReason?.trim() || null,
      },
      occurredAt: now,
    }),
  ]);

  // Trigger relevant coworker work based on the transition role.
  // These are fire-and-forget — the transition must succeed regardless.
  if (toMeta.role === "won") {
    createDetectOverduePaymentsWork(supabase).catch(() => {});
    createDataQualityScanWork(supabase).catch(() => {});
  } else if (toMeta.role === "lost") {
    createDetectStaleDealsWork(supabase).catch(() => {});
    createRevenueStageAuditWork(supabase).catch(() => {});
    createDataQualityScanWork(supabase).catch(() => {});
  } else if (canonicalTo === "proposal" || canonicalTo === "negotiation") {
    // High-value stage entry — pulse should re-evaluate pipeline health.
    createDetectStaleDealsWork(supabase).catch(() => {});
    createRevenueStageAuditWork(supabase).catch(() => {});
  }

  return updated;
}

export function transitionStatusFromError(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /changed while you were editing/i.test(message) ? 409 : 400;
}
