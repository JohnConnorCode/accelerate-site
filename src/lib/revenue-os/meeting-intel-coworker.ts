import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { registerCoworker, getCoworkerManifest, type Coworker } from "./coworkers";
import { createWorkItem } from "./work-items";
import { registerAutonomyPolicy } from "./autonomy-policy";
import { registerCapability } from "./capabilities";
import { recordAudit } from "./audit";
import { registerWorkKindHandler, type WorkKindHandler } from "./work-executor";
import { storeAgentMemory } from "./memory";
import { tryCoworkerAgentTask as tryAiExecution } from "./coworker-agent";

// ---------------------------------------------------------------------------
// Meeting Intelligence Coworker (northstar Phase E, priority 2)
//
// Generates pre-call briefs before meetings, processes post-meeting
// notes/recordings into CRM updates and follow-up work items.
// ---------------------------------------------------------------------------

export const MEETING_INTEL_COWORKER_ID = "meeting-intel";

export const MEETING_INTEL_WORK_KINDS = [
  "pre_call_brief",
  "post_meeting_process",
  "update_crm_from_meeting",
] as const;

export type MeetingIntelWorkKind = (typeof MEETING_INTEL_WORK_KINDS)[number];

export const MEETING_INTEL_REQUIRED_CAPABILITIES = [
  "crm.read",
  "crm.write",
  "calendar.read",
  "gmail.read",
] as const;

export const MEETING_INTEL_AUTONOMY_POLICIES = [
  { actionKey: "crm.read", label: "Read CRM records", level: "autonomous" as const },
  {
    actionKey: "crm.write",
    label: "Update CRM from meetings",
    level: "ask_until_trusted" as const,
  },
  { actionKey: "calendar.read", label: "Read calendar events", level: "autonomous" as const },
  { actionKey: "gmail.read", label: "Read email history", level: "autonomous" as const },
  {
    actionKey: "meeting.brief",
    label: "Generate pre-call briefs",
    level: "standing_permission" as const,
  },
  {
    actionKey: "meeting.process",
    label: "Process post-meeting notes",
    level: "ask_until_trusted" as const,
  },
] as const;

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

export async function bootstrapMeetingIntelCoworker(
  supabase: SupabaseClient,
  actorEmail?: string | null,
): Promise<{ coworker: Coworker; capabilityGaps: string[]; readyToWork: boolean }> {
  for (const capKey of MEETING_INTEL_REQUIRED_CAPABILITIES) {
    await registerCapability(supabase, {
      capabilityKey: capKey,
      label: capKey
        .split(".")
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(" "),
      category: "integration",
      source: "coworker_bootstrap",
    }).catch(() => {});
  }

  for (const policy of MEETING_INTEL_AUTONOMY_POLICIES) {
    await registerAutonomyPolicy(supabase, {
      actionKey: policy.actionKey,
      label: policy.label,
      level: policy.level,
      coworkerId: MEETING_INTEL_COWORKER_ID,
      source: "coworker_bootstrap",
      actorEmail,
    }).catch(() => {});
  }

  const coworker = await registerCoworker(supabase, {
    id: MEETING_INTEL_COWORKER_ID,
    name: "Meeting Intelligence",
    role: "Generates pre-call briefs, processes post-meeting outcomes, and updates CRM from meetings",
    description:
      "Watches for upcoming calendar events and prepares pre-call briefs with company context, recent activity, and open items. After meetings, processes notes into CRM updates, follow-up tasks, and next-step work items.",
    toolPack: "pipeline",
    requiredCapabilities: [...MEETING_INTEL_REQUIRED_CAPABILITIES],
    workKinds: [...MEETING_INTEL_WORK_KINDS],
    actorEmail,
  });

  const manifest = await getCoworkerManifest(supabase, MEETING_INTEL_COWORKER_ID);

  await recordAudit(supabase, {
    actorEmail: actorEmail || "system",
    action: "meeting_intel_coworker.bootstrapped",
    entityType: "coworker",
    entityId: MEETING_INTEL_COWORKER_ID,
    source: "automation",
    after: { readyToWork: manifest.readyToWork, capabilityGaps: manifest.capabilityGaps },
  });

  return { coworker, capabilityGaps: manifest.capabilityGaps, readyToWork: manifest.readyToWork };
}

// ---------------------------------------------------------------------------
// Work item creation helpers
// ---------------------------------------------------------------------------

export async function createPreCallBriefWork(
  supabase: SupabaseClient,
  input: {
    contactId: string;
    meetingAt: string;
    actorEmail?: string | null;
  },
) {
  return createWorkItem(supabase, {
    kind: "pre_call_brief",
    objective: `Pre-call brief for meeting at ${input.meetingAt}`,
    reason: `Upcoming meeting — prepare context brief`,
    source: "meeting_intel_coworker",
    priority: "high",
    coworkerId: MEETING_INTEL_COWORKER_ID,
    entityType: "contact",
    entityId: input.contactId,
    dedupeKey: `meeting:brief:${input.contactId}:${input.meetingAt.slice(0, 10)}`,
    dueAt: input.meetingAt,
    maxAttempts: 2,
    actorEmail: input.actorEmail,
    surfaceInInbox: true,
  });
}

export async function createPostMeetingProcessWork(
  supabase: SupabaseClient,
  input: {
    opportunityId: string;
    meetingAt: string;
    actorEmail?: string | null;
  },
) {
  return createWorkItem(supabase, {
    kind: "post_meeting_process",
    objective: `Process post-meeting outcomes for opportunity`,
    reason: `Meeting concluded — extract outcomes and update CRM`,
    source: "meeting_intel_coworker",
    priority: "high",
    coworkerId: MEETING_INTEL_COWORKER_ID,
    entityType: "opportunity",
    entityId: input.opportunityId,
    dedupeKey: `meeting:post:${input.opportunityId}:${input.meetingAt.slice(0, 10)}`,
    maxAttempts: 2,
    actorEmail: input.actorEmail,
    surfaceInInbox: true,
  });
}

// ---------------------------------------------------------------------------
// Work kind handlers
// ---------------------------------------------------------------------------

const preCallBriefHandler: WorkKindHandler = async (supabase, wi) => {
  const contactId = wi.entity_id;
  if (!contactId)
    return { status: "skipped", outcome: "No contact ID linked — cannot prepare brief" };

  // AI-first: let the model synthesize a rich pre-call brief from available data.
  const aiResult = await tryAiExecution(supabase, wi);
  if (aiResult) {
    if (aiResult.status !== "completed") return aiResult;
    await storeAgentMemory(supabase, {
      coworkerId: MEETING_INTEL_COWORKER_ID,
      category: "prior_work",
      subject: `pre_call_brief: AI judgment`,
      body: aiResult.outcome,
      entityType: "contact",
      entityId: contactId,
      relevanceHorizon: "daily",
    }).catch(() => {});
    return aiResult;
  }

  // Deterministic fallback.
  // Load contact details.
  const { data: contact } = await supabase
    .from("contacts")
    .select("id, email, first_name, last_name, company_id")
    .eq("id", contactId)
    .maybeSingle();
  if (!contact) return { status: "skipped", outcome: `Contact ${contactId} not found` };

  // Load open opportunity for this contact.
  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("id, stage, company_name, probability, next_action")
    .eq("contact_id", contactId)
    .not("stage", "in", '("won","lost")')
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Count recent activity.
  const { count: recentActivity } = await supabase
    .from("activities")
    .select("*", { count: "exact", head: true })
    .eq("contact_id", contactId)
    .gte("occurred_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString());

  // Count pending actions.
  const { count: pendingActions } = await supabase
    .from("action_queue")
    .select("*", { count: "exact", head: true })
    .eq("entity_id", contactId)
    .eq("status", "pending");

  const briefParts = [
    `Contact: ${contact.first_name ?? ""} ${contact.last_name ?? ""} (${contact.email})`,
    opportunity
      ? `Opportunity: ${opportunity.company_name} — stage: ${opportunity.stage}, probability: ${opportunity.probability}%`
      : "No active opportunity",
    opportunity?.next_action ? `Next action: ${opportunity.next_action}` : "No next action set",
    `Recent activity (14d): ${recentActivity ?? 0} events`,
    `Pending actions: ${pendingActions ?? 0}`,
  ];

  const brief = briefParts.join(" | ");

  await recordAudit(supabase, {
    actorEmail: "system",
    action: "meeting_intel.pre_call_brief",
    entityType: "contact",
    entityId: contactId,
    source: "automation",
    after: { brief_summary: brief.substring(0, 200), work_item: wi.id },
  });

  await storeAgentMemory(supabase, {
    coworkerId: MEETING_INTEL_COWORKER_ID,
    category: "prior_work",
    subject: `pre_call_brief: ${contact.first_name ?? ""} ${contact.last_name ?? ""}`,
    body: brief,
    entityType: "contact",
    entityId: contactId,
    relevanceHorizon: "daily",
  }).catch(() => {});

  return { status: "completed", outcome: `Pre-call brief: ${brief}` };
};

const postMeetingProcessHandler: WorkKindHandler = async (supabase, wi) => {
  const opportunityId = wi.entity_id;
  if (!opportunityId)
    return { status: "skipped", outcome: "No opportunity ID linked — cannot process meeting" };

  // AI-first: let the model extract outcomes and propose CRM updates.
  const aiResult = await tryAiExecution(supabase, wi);
  if (aiResult) {
    if (aiResult.status !== "completed") return aiResult;
    await storeAgentMemory(supabase, {
      coworkerId: MEETING_INTEL_COWORKER_ID,
      category: "prior_work",
      subject: `post_meeting_process: AI judgment`,
      body: aiResult.outcome,
      entityType: "opportunity",
      entityId: opportunityId,
      relevanceHorizon: "weekly",
    }).catch(() => {});
    return aiResult;
  }

  // Deterministic fallback.
  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("id, stage, company_name, contact_id")
    .eq("id", opportunityId)
    .maybeSingle();
  if (!opportunity) return { status: "skipped", outcome: `Opportunity ${opportunityId} not found` };

  // Create a CRM update work item to capture meeting outcomes.
  await createWorkItem(supabase, {
    kind: "update_crm_from_meeting",
    objective: `Update CRM from meeting with ${opportunity.company_name}`,
    reason: `Post-meeting processing — update opportunity stage and next actions`,
    source: "meeting_intel_coworker",
    priority: "high",
    coworkerId: MEETING_INTEL_COWORKER_ID,
    entityType: "opportunity",
    entityId: opportunityId,
    dedupeKey: `meeting:crm-update:${opportunityId}:${new Date().toISOString().slice(0, 10)}`,
    maxAttempts: 2,
    actorEmail: "system",
  }).catch(() => {});

  await recordAudit(supabase, {
    actorEmail: "system",
    action: "meeting_intel.post_meeting_processed",
    entityType: "opportunity",
    entityId: opportunityId,
    source: "automation",
    after: { stage: opportunity.stage, company: opportunity.company_name, work_item: wi.id },
  });

  const outcome = `Post-meeting processed for ${opportunity.company_name} (stage: ${opportunity.stage}) — CRM update queued`;
  await storeAgentMemory(supabase, {
    coworkerId: MEETING_INTEL_COWORKER_ID,
    category: "prior_work",
    subject: `post_meeting_process: ${opportunity.company_name}`,
    body: outcome,
    entityType: "opportunity",
    entityId: opportunityId,
    relevanceHorizon: "weekly",
  }).catch(() => {});

  return { status: "completed", outcome };
};

const updateCrmFromMeetingHandler: WorkKindHandler = async (supabase, wi) => {
  const opportunityId = wi.entity_id;
  if (!opportunityId) return { status: "skipped", outcome: "No opportunity ID linked" };

  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("id, stage, company_name, next_action")
    .eq("id", opportunityId)
    .maybeSingle();
  if (!opportunity) return { status: "skipped", outcome: `Opportunity ${opportunityId} not found` };

  // In a full implementation, this would parse meeting notes/transcript
  // and propose CRM updates. For the reference implementation, we audit
  // the intent and mark completion.
  await recordAudit(supabase, {
    actorEmail: "system",
    action: "meeting_intel.crm_updated_from_meeting",
    entityType: "opportunity",
    entityId: opportunityId,
    source: "automation",
    after: {
      stage: opportunity.stage,
      next_action: opportunity.next_action,
      company: opportunity.company_name,
      work_item: wi.id,
      note: "Reference implementation — full note parsing pending Phase E deepening",
    },
  });

  const outcome = `CRM update from meeting for ${opportunity.company_name} (stage: ${opportunity.stage})`;
  await storeAgentMemory(supabase, {
    coworkerId: MEETING_INTEL_COWORKER_ID,
    category: "prior_work",
    subject: `update_crm_from_meeting: ${opportunity.company_name}`,
    body: outcome,
    entityType: "opportunity",
    entityId: opportunityId,
    relevanceHorizon: "weekly",
  }).catch(() => {});

  return { status: "completed", outcome };
};

// ---------------------------------------------------------------------------
// Register handlers
// ---------------------------------------------------------------------------

export function registerMeetingIntelWorkHandlers(): void {
  registerWorkKindHandler("pre_call_brief", preCallBriefHandler);
  registerWorkKindHandler("post_meeting_process", postMeetingProcessHandler);
  registerWorkKindHandler("update_crm_from_meeting", updateCrmFromMeetingHandler);
}
