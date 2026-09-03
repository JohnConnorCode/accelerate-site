import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { registerCoworker, getCoworkerManifest, type Coworker } from "./coworkers";
import { createWorkItem } from "./work-items";
import { registerAutonomyPolicy } from "./autonomy-policy";
import { registerCapability } from "./capabilities";
import { recordAudit } from "./audit";
import { registerWorkKindHandler, type WorkKindHandler } from "./work-executor";
import { storeAgentMemory } from "./memory";
import { runCoworkerAgentTask } from "./coworker-agent";

// When an AI model is configured, AI-requiring handlers attempt AI execution
// first and fall back to deterministic logic if the model is unavailable or
// fails. This keeps the system operational even during model outages.
const aiModelConfigured = !!process.env.OPENROUTER_AGENT_MODEL;

async function tryAiExecution(
  supabase: SupabaseClient,
  wi: WorkItem,
): Promise<{ outcome: string } | null> {
  if (!aiModelConfigured) return null;
  try {
    const result = await runCoworkerAgentTask(supabase, wi);
    if (result.outcome && !result.outcome.startsWith("AI execution failed")) {
      return { outcome: result.outcome };
    }
  } catch {
    // Fall through to deterministic logic.
  }
  return null;
}

import type { WorkItem } from "./work-items";

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

// ---------------------------------------------------------------------------
// Work kind handlers: register execution logic for each Sales Coworker kind.
//
// These are the actual "workers" that execute when the work engine claims an
// item. Each handler receives the work item and returns an outcome string.
//
// For the reference implementation, these handlers perform structured
// operations (reads, checks, audit) and create follow-up work items or
// action proposals as needed. The full agent-loop integration (where a
// handler invokes the AI agent with the right tool pack) will land when
// the coworker execution loop is connected to ai-agent.ts.
// ---------------------------------------------------------------------------

const qualifyLeadHandler: WorkKindHandler = async (supabase, wi) => {
  // AI-first: let the model synthesize context and produce a qualification judgment.
  const aiResult = await tryAiExecution(supabase, wi);
  if (aiResult) {
    await storeAgentMemory(supabase, {
      coworkerId: SALES_COWORKER_ID,
      category: "prior_work",
      subject: `qualify_lead: AI judgment`,
      body: aiResult.outcome,
      entityType: wi.entity_type ?? undefined,
      entityId: wi.entity_id ?? undefined,
      relevanceHorizon: "weekly",
    }).catch(() => {});
    return aiResult;
  }

  // Deterministic fallback when AI is unavailable.
  // Read the contact and opportunity to gather context.
  const { data: contact } = await supabase
    .from("contacts")
    .select("id, email, first_name, last_name, company_id")
    .eq("id", wi.entity_id)
    .maybeSingle();

  if (!contact) {
    return { outcome: `Contact ${wi.entity_id} not found — skipping qualification` };
  }

  // Check if there's an open opportunity for this contact.
  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("id, stage, company_name")
    .eq("contact_id", contact.id)
    .not("stage", "in", '("won","lost")')
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const companyName = opportunity?.company_name ?? "Unknown";
  const stage = opportunity?.stage ?? "none";

  await recordAudit(supabase, {
    actorEmail: "system",
    action: "sales_coworker.qualified_lead",
    entityType: "contact",
    entityId: contact.id,
    source: "automation",
    after: { company: companyName, opportunity_stage: stage, work_item: wi.id },
  });

  // Create a draft_followup work item if the opportunity is at an early stage.
  if (opportunity && ["new", "contacted"].includes(opportunity.stage)) {
    await createDraftFollowupWork(supabase, {
      opportunityId: opportunity.id,
      reason: `Lead qualification completed for ${companyName} (stage: ${stage})`,
      source: "sales_coworker",
      actorEmail: "system",
    }).catch(() => {});
  }

  const outcome = `Qualified: ${contact.first_name ?? ""} ${contact.last_name ?? ""} at ${companyName} (stage: ${stage})`;
  await storeAgentMemory(supabase, {
    coworkerId: SALES_COWORKER_ID,
    category: "prior_work",
    subject: `qualify_lead: ${companyName}`,
    body: outcome,
    entityType: "contact",
    entityId: contact.id,
    relevanceHorizon: "weekly",
  }).catch(() => {});

  return { outcome };
};

const draftFollowupHandler: WorkKindHandler = async (supabase, wi) => {
  // AI-first: let the model draft a contextual follow-up.
  const aiResult = await tryAiExecution(supabase, wi);
  if (aiResult) {
    await storeAgentMemory(supabase, {
      coworkerId: SALES_COWORKER_ID,
      category: "prior_work",
      subject: `draft_followup: AI judgment`,
      body: aiResult.outcome,
      entityType: wi.entity_type ?? undefined,
      entityId: wi.entity_id ?? undefined,
      relevanceHorizon: "daily",
    }).catch(() => {});
    return aiResult;
  }

  // Deterministic fallback.
  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("id, stage, company_name, next_action")
    .eq("id", wi.entity_id)
    .maybeSingle();

  if (!opportunity) {
    return { outcome: `Opportunity ${wi.entity_id} not found — skipping follow-up draft` };
  }

  await recordAudit(supabase, {
    actorEmail: "system",
    action: "sales_coworker.followup_draft_reviewed",
    entityType: "opportunity",
    entityId: opportunity.id,
    source: "automation",
    after: { stage: opportunity.stage, next_action: opportunity.next_action, work_item: wi.id },
  });

  // Schedule a follow-up check in 3 business days if not yet terminal.
  if (!["won", "lost"].includes(opportunity.stage)) {
    const checkAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    await scheduleFollowupCheckWork(supabase, {
      opportunityId: opportunity.id,
      checkAt,
      reason: `Follow-up check after draft for ${opportunity.company_name}`,
      actorEmail: "system",
    }).catch(() => {});
  }

  const outcome = `Follow-up draft reviewed for ${opportunity.company_name} (stage: ${opportunity.stage})`;
  await storeAgentMemory(supabase, {
    coworkerId: SALES_COWORKER_ID,
    category: "prior_work",
    subject: `draft_followup: ${opportunity.company_name}`,
    body: outcome,
    entityType: "opportunity",
    entityId: opportunity.id,
    relevanceHorizon: "daily",
  }).catch(() => {});

  return { outcome };
};

const reviewStaleProposalHandler: WorkKindHandler = async (supabase, wi) => {
  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("id, stage, company_name, updated_at")
    .eq("id", wi.entity_id)
    .maybeSingle();

  if (!opportunity) {
    return { outcome: `Opportunity ${wi.entity_id} not found` };
  }

  if (opportunity.stage !== "proposal") {
    return { outcome: `Opportunity ${opportunity.company_name} no longer in proposal stage (now: ${opportunity.stage})` };
  }

  await recordAudit(supabase, {
    actorEmail: "system",
    action: "sales_coworker.stale_proposal_reviewed",
    entityType: "opportunity",
    entityId: opportunity.id,
    source: "automation",
    after: { stage: opportunity.stage, updated_at: opportunity.updated_at, work_item: wi.id },
  });

  // Create a draft_followup work item to re-engage.
  await createDraftFollowupWork(supabase, {
    opportunityId: opportunity.id,
    reason: `Stale proposal detected for ${opportunity.company_name}`,
    source: "stale_proposal_detector",
    priority: "high",
    actorEmail: "system",
  }).catch(() => {});

  const outcome = `Stale proposal reviewed for ${opportunity.company_name} — follow-up queued`;
  await storeAgentMemory(supabase, {
    coworkerId: SALES_COWORKER_ID,
    category: "prior_work",
    subject: `review_stale_proposal: ${opportunity.company_name}`,
    body: outcome,
    entityType: "opportunity",
    entityId: opportunity.id,
    relevanceHorizon: "weekly",
  }).catch(() => {});

  return { outcome };
};

const gatherLeadContextHandler: WorkKindHandler = async (supabase, wi) => {
  const { data: contact } = await supabase
    .from("contacts")
    .select("id, email, first_name, last_name, company_id")
    .eq("id", wi.entity_id)
    .maybeSingle();

  if (!contact) {
    return { outcome: `Contact ${wi.entity_id} not found` };
  }

  // Check for recent activity (Gmail sync, conversations).
  const { count: activityCount } = await supabase
    .from("activities")
    .select("*", { count: "exact", head: true })
    .eq("contact_id", contact.id)
    .gte("occurred_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  const contextSummary = activityCount
    ? `${activityCount} activities in the last 30 days`
    : "No recent activity found";

  await recordAudit(supabase, {
    actorEmail: "system",
    action: "sales_coworker.context_gathered",
    entityType: "contact",
    entityId: contact.id,
    source: "automation",
    after: { context_summary: contextSummary, work_item: wi.id },
  });

  // After context is gathered, qualify the lead.
  await createQualifyLeadWork(supabase, {
    contactId: contact.id,
    source: "sales_coworker",
    reason: `Context gathered: ${contextSummary}`,
    actorEmail: "system",
  }).catch(() => {});

  const outcome = `Context gathered for ${contact.first_name ?? ""} ${contact.last_name ?? ""}: ${contextSummary}`;
  await storeAgentMemory(supabase, {
    coworkerId: SALES_COWORKER_ID,
    category: "prior_work",
    subject: `gather_lead_context: ${contact.first_name ?? ""} ${contact.last_name ?? ""}`,
    body: outcome,
    entityType: "contact",
    entityId: contact.id,
    relevanceHorizon: "daily",
  }).catch(() => {});

  return { outcome };
};

const scheduleFollowupCheckHandler: WorkKindHandler = async (supabase, wi) => {
  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("id, stage, company_name")
    .eq("id", wi.entity_id)
    .maybeSingle();

  if (!opportunity) {
    return { outcome: `Opportunity ${wi.entity_id} not found` };
  }

  if (["won", "lost"].includes(opportunity.stage)) {
    return { outcome: `Opportunity ${opportunity.company_name} is ${opportunity.stage} — no follow-up needed` };
  }

  // The check has come due. Create a draft follow-up if the opportunity
  // is still active.
  await createDraftFollowupWork(supabase, {
    opportunityId: opportunity.id,
    reason: `Scheduled follow-up check for ${opportunity.company_name} (stage: ${opportunity.stage})`,
    source: "sales_coworker",
    actorEmail: "system",
  }).catch(() => {});

  const outcome = `Follow-up check executed for ${opportunity.company_name} (stage: ${opportunity.stage}) — draft queued`;
  await storeAgentMemory(supabase, {
    coworkerId: SALES_COWORKER_ID,
    category: "prior_work",
    subject: `schedule_followup_check: ${opportunity.company_name}`,
    body: outcome,
    entityType: "opportunity",
    entityId: opportunity.id,
    relevanceHorizon: "daily",
  }).catch(() => {});

  return { outcome };
};

// ---------------------------------------------------------------------------
// Register all Sales Coworker handlers with the work executor
// ---------------------------------------------------------------------------

export function registerSalesWorkHandlers(): void {
  registerWorkKindHandler("qualify_lead", qualifyLeadHandler);
  registerWorkKindHandler("draft_followup", draftFollowupHandler);
  registerWorkKindHandler("review_stale_proposal", reviewStaleProposalHandler);
  registerWorkKindHandler("gather_lead_context", gatherLeadContextHandler);
  registerWorkKindHandler("schedule_followup_check", scheduleFollowupCheckHandler);
}
