import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { registerCoworker, getCoworkerManifest, type Coworker } from "./coworkers";
import { createWorkItem } from "./work-items";
import { registerAutonomyPolicy } from "./autonomy-policy";
import { registerCapability } from "./capabilities";
import { recordAudit } from "./audit";

// ---------------------------------------------------------------------------
// Sales Coworker: the reference coworker that proves Phase B primitives.
//
// Northstar §33 success demo:
//   Lead arrives → identity resolved → business context gathered →
//   lead qualified → reply drafted → human approves → email sent →
//   meeting booked → CRM updated → follow-up sent → future work scheduled
// ---------------------------------------------------------------------------

export const SALES_COWORKER_ID = "sales";

export const SALES_COWORKER_WORK_KINDS = [
  "qualify_lead",
  "draft_followup",
  "review_stale_proposal",
  "schedule_followup_check",
  "gather_lead_context",
] as const;

export type SalesWorkKind = (typeof SALES_COWORKER_WORK_KINDS)[number];

export const SALES_COWORKER_REQUIRED_CAPABILITIES = [
  "crm.read",
  "crm.write",
  "gmail.read",
  "gmail.send",
  "calendar.read",
] as const;

export const SALES_COWORKER_AUTONOMY_POLICIES = [
  { actionKey: "crm.read", label: "Read CRM records", level: "autonomous" as const },
  { actionKey: "crm.write", label: "Update CRM records", level: "ask_until_trusted" as const },
  { actionKey: "gmail.read", label: "Read Gmail threads", level: "autonomous" as const },
  { actionKey: "gmail.send", label: "Send follow-up emails", level: "ask_until_trusted" as const },
  { actionKey: "calendar.read", label: "Read calendar availability", level: "autonomous" as const },
  { actionKey: "pipeline.stage_change", label: "Move pipeline stages", level: "always_ask" as const },
  { actionKey: "lead.qualify", label: "Qualify inbound leads", level: "standing_permission" as const },
] as const;

// ---------------------------------------------------------------------------
// Bootstrap: register the Sales Coworker and its dependencies
// ---------------------------------------------------------------------------

export async function bootstrapSalesCoworker(
  supabase: SupabaseClient,
  actorEmail?: string | null,
): Promise<{ coworker: Coworker; capabilityGaps: string[]; readyToWork: boolean }> {
  // Register required capabilities
  for (const capKey of SALES_COWORKER_REQUIRED_CAPABILITIES) {
    await registerCapability(supabase, {
      capabilityKey: capKey,
      label: capKey.split(".").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" "),
      category: "integration",
      source: "coworker_bootstrap",
    }).catch(() => {
      // Capability may already exist — that's fine.
    });
  }

  // Register autonomy policies
  for (const policy of SALES_COWORKER_AUTONOMY_POLICIES) {
    await registerAutonomyPolicy(supabase, {
      actionKey: policy.actionKey,
      label: policy.label,
      level: policy.level,
      coworkerId: SALES_COWORKER_ID,
      source: "coworker_bootstrap",
      actorEmail,
    }).catch(() => {
      // Policy may already exist — that's fine.
    });
  }

  // Register the coworker
  const coworker = await registerCoworker(supabase, {
    id: SALES_COWORKER_ID,
    name: "Sales Coworker",
    role: "Qualifies inbound leads, drafts follow-ups, monitors stale proposals, and keeps the pipeline moving",
    description: "The reference coworker that proves the Phase B primitives. Handles the full lead-to-close loop: lead arrives → identity resolved → context gathered → qualified → reply drafted → human approves → email sent → follow-up scheduled.",
    toolPack: "pipeline",
    requiredCapabilities: [...SALES_COWORKER_REQUIRED_CAPABILITIES],
    workKinds: [...SALES_COWORKER_WORK_KINDS],
    actorEmail,
  });

  // Check readiness
  const manifest = await getCoworkerManifest(supabase, SALES_COWORKER_ID);

  await recordAudit(supabase, {
    actorEmail: actorEmail || "system",
    action: "sales_coworker.bootstrapped",
    entityType: "coworker",
    entityId: SALES_COWORKER_ID,
    source: "automation",
    after: {
      readyToWork: manifest.readyToWork,
      capabilityGaps: manifest.capabilityGaps,
    },
  });

  return { coworker, capabilityGaps: manifest.capabilityGaps, readyToWork: manifest.readyToWork };
}

// ---------------------------------------------------------------------------
// Create work items for the Sales Coworker's core loops
// ---------------------------------------------------------------------------

export async function createQualifyLeadWork(
  supabase: SupabaseClient,
  input: {
    contactId: string;
    source: string;
    reason: string;
    priority?: "urgent" | "high" | "medium" | "low";
    actorEmail?: string | null;
  },
) {
  return createWorkItem(supabase, {
    kind: "qualify_lead",
    objective: `Qualify lead: ${input.contactId}`,
    reason: input.reason,
    source: input.source,
    priority: input.priority ?? "high",
    coworkerId: SALES_COWORKER_ID,
    entityType: "contact",
    entityId: input.contactId,
    dedupeKey: `sales:qualify:${input.contactId}`,
    maxAttempts: 3,
    actorEmail: input.actorEmail,
    surfaceInInbox: true,
  });
}

export async function createDraftFollowupWork(
  supabase: SupabaseClient,
  input: {
    opportunityId: string;
    reason: string;
    source: string;
    priority?: "urgent" | "high" | "medium" | "low";
    dueAt?: string | null;
    actorEmail?: string | null;
  },
) {
  return createWorkItem(supabase, {
    kind: "draft_followup",
    objective: `Draft follow-up for opportunity: ${input.opportunityId}`,
    reason: input.reason,
    source: input.source,
    priority: input.priority ?? "medium",
    coworkerId: SALES_COWORKER_ID,
    entityType: "opportunity",
    entityId: input.opportunityId,
    dedupeKey: `sales:followup:${input.opportunityId}`,
    dueAt: input.dueAt,
    maxAttempts: 3,
    actorEmail: input.actorEmail,
    surfaceInInbox: true,
  });
}

export async function createReviewStaleProposalWork(
  supabase: SupabaseClient,
  input: {
    opportunityId: string;
    reason: string;
    actorEmail?: string | null;
  },
) {
  return createWorkItem(supabase, {
    kind: "review_stale_proposal",
    objective: `Review stale proposal for opportunity: ${input.opportunityId}`,
    reason: input.reason,
    source: "stale_proposal_detector",
    priority: "high",
    coworkerId: SALES_COWORKER_ID,
    entityType: "opportunity",
    entityId: input.opportunityId,
    dedupeKey: `sales:stale-proposal:${input.opportunityId}`,
    maxAttempts: 2,
    actorEmail: input.actorEmail,
    surfaceInInbox: true,
  });
}

export async function createGatherLeadContextWork(
  supabase: SupabaseClient,
  input: {
    contactId: string;
    reason: string;
    source: string;
    actorEmail?: string | null;
  },
) {
  return createWorkItem(supabase, {
    kind: "gather_lead_context",
    objective: `Gather business context for lead: ${input.contactId}`,
    reason: input.reason,
    source: input.source,
    priority: "high",
    coworkerId: SALES_COWORKER_ID,
    entityType: "contact",
    entityId: input.contactId,
    dedupeKey: `sales:context:${input.contactId}`,
    maxAttempts: 2,
    actorEmail: input.actorEmail,
  });
}

// ---------------------------------------------------------------------------
// Schedule a follow-up check (self-scheduling pattern from work-items.ts)
// ---------------------------------------------------------------------------

export async function scheduleFollowupCheckWork(
  supabase: SupabaseClient,
  input: {
    opportunityId: string;
    checkAt: string;
    reason: string;
    actorEmail?: string | null;
  },
) {
  return createWorkItem(supabase, {
    kind: "schedule_followup_check",
    objective: `Follow-up check for opportunity: ${input.opportunityId}`,
    reason: input.reason,
    source: "sales_coworker",
    priority: "medium",
    coworkerId: SALES_COWORKER_ID,
    entityType: "opportunity",
    entityId: input.opportunityId,
    dedupeKey: `sales:check:${input.opportunityId}:${input.checkAt}`,
    dueAt: input.checkAt,
    maxAttempts: 2,
    actorEmail: input.actorEmail,
  });
}
