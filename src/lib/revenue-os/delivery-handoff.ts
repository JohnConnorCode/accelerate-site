import "server-only";
import { tenantIdForDatabase, callDeliveryTemplateRpc } from "@/lib/supabase/server";
import { SEED_DEFAULT_MILESTONES, onboardingMilestonesSchema } from "./delivery-handoff-contract";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit } from "./audit";
import { recordActivity } from "./activities";
import { loadPipelineStages } from "./pipeline-stage-resolver";
import { createRevenueTask } from "./tasks";

/**
 * Won-to-delivery handoff: one canonically won opportunity becomes one
 * inspectable client engagement. No second identity (the canonical contact
 * and company are linked, never re-created), no second pipeline (delivery
 * state lives on the client row and its checklist, never in sales stages),
 * and no automatic client contact (creation is operator-confirmed; nothing
 * here sends anything).
 */

export interface OnboardingMilestone {
  key: string;
  title: string;
  description?: string | null;
  owner?: string | null;
  owner_user_id?: string | null;
  due_offset_days?: number | null;
}

export interface OnboardingTemplate {
  key: string;
  version: number;
  milestones: OnboardingMilestone[];
}

export interface HandoffMilestoneState {
  key: string;
  title: string;
  status: "complete" | "in_progress" | "created" | "pending";
  task_id: string | null;
}

export interface HandoffReceipt {
  engagement_id: string;
  opportunity_id: string;
  template_key: string;
  template_version: number;
  replayed: boolean;
  created_milestones: string[];
  remainder: string[];
  /** Originating proposal linked at handoff, when one is confirmed. */
  proposal_id?: string | null;
}

const DEFAULT_TEMPLATE_KEY = "default";

export { SEED_DEFAULT_MILESTONES } from "./delivery-handoff-contract";

type Row = Record<string, unknown>;

function requireTenant(tenantId: string): string {
  const id = tenantId?.trim();
  if (!id) throw new Error("A tenant id is required for delivery handoff");
  return id;
}

function dueDate(offsetDays: number | null | undefined, startedAt?: string): string {
  const days = Number.isFinite(Number(offsetDays)) ? Number(offsetDays) : 7;
  const start =
    startedAt && Number.isFinite(Date.parse(startedAt)) ? Date.parse(startedAt) : Date.now();
  return new Date(start + Math.max(0, days) * 86_400_000).toISOString().split("T")[0]!;
}

/**
 * Resolve the active onboarding template, seeding the default playbook on
 * first use. Seeding is deterministic and tenant-scoped; custom templates
 * are created explicitly, never inferred.
 */
export async function getActiveTemplate(
  supabase: SupabaseClient,
  tenantId: string,
  templateKey: string = DEFAULT_TEMPLATE_KEY,
): Promise<OnboardingTemplate> {
  const tenant = requireTenant(tenantId);
  const key = templateKey.trim() || DEFAULT_TEMPLATE_KEY;
  const { data, error } = await supabase
    .from("onboarding_templates")
    .select("template_key,version,milestones")
    .eq("tenant_id", tenant)
    .eq("template_key", key)
    .eq("active", true)
    .maybeSingle();
  if (error) throw new Error(`Could not load onboarding template: ${error.message}`);
  if (data) {
    return {
      key: String((data as Row).template_key),
      version: Number((data as Row).version),
      milestones: ((data as Row).milestones ?? []) as OnboardingMilestone[],
    };
  }
  if (key !== DEFAULT_TEMPLATE_KEY)
    throw new Error(`No active onboarding template ${JSON.stringify(key)}`);
  const { error: seedError } = await supabase.from("onboarding_templates").insert({
    tenant_id: tenant,
    template_key: DEFAULT_TEMPLATE_KEY,
    version: 1,
    active: true,
    milestones: SEED_DEFAULT_MILESTONES,
  });
  if (seedError?.code === "23505") {
    const concurrent = await supabase
      .from("onboarding_templates")
      .select("template_key,version,milestones")
      .eq("tenant_id", tenant)
      .eq("template_key", key)
      .eq("active", true)
      .maybeSingle();
    if (concurrent.error || !concurrent.data)
      throw new Error("Default playbook changed; retry template resolution");
    return {
      key: concurrent.data.template_key,
      version: concurrent.data.version,
      milestones: concurrent.data.milestones,
    };
  }
  if (seedError) throw new Error(`Could not seed the default playbook: ${seedError.message}`);
  return { key: DEFAULT_TEMPLATE_KEY, version: 1, milestones: SEED_DEFAULT_MILESTONES };
}

export async function createOnboardingTemplateVersion(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    templateKey?: string;
    milestones: OnboardingMilestone[];
    actorEmail: string;
  },
): Promise<OnboardingTemplate> {
  const tenant = requireTenant(input.tenantId);
  const key = (input.templateKey ?? DEFAULT_TEMPLATE_KEY).trim() || DEFAULT_TEMPLATE_KEY;
  if (tenantIdForDatabase(supabase) !== tenant)
    throw new Error("Template publication requires the matching tenant-bound database");
  const milestones = onboardingMilestonesSchema.parse(input.milestones);
  const { data, error } = await callDeliveryTemplateRpc(supabase, {
    p_key: key,
    p_milestones: milestones,
    p_actor: input.actorEmail,
  });
  if (error || !data)
    throw new Error(`Could not publish template version: ${error?.message ?? "no receipt"}`);
  return data as unknown as OnboardingTemplate;
}

export interface HandoffInput {
  tenantId: string;
  opportunityId: string;
  actorEmail: string;
  templateKey?: string;
  /** Subset of milestone keys to hand off; omitted means the whole template. */
  milestoneKeys?: string[];
  proposalId?: string | null;
  expectedProposalVersion?: number;
  expectedUpdatedAt?: string;
  expectedTemplateVersion?: number;
}

export interface HandoffResult {
  client: Row;
  created: boolean;
  milestones: HandoffMilestoneState[];
  /** Template keys neither completed nor created this run: bounded remainder. */
  remainder: string[];
  replayed: boolean;
  receipt: HandoffReceipt;
}

/**
 * Hand a won opportunity to delivery. Idempotent per opportunity: a second
 * call returns the same engagement, completes only what is still open, and
 * reports replayed instead of duplicating commitments.
 */
export async function createHandoffFromOpportunity(
  supabase: SupabaseClient,
  input: HandoffInput,
): Promise<HandoffResult> {
  const tenantId = requireTenant(input.tenantId);
  if (tenantIdForDatabase(supabase) !== tenantId)
    throw new Error("Delivery handoff requires the matching tenant-bound database");
  const workspace = await supabase
    .from("tenants")
    .select("status,config")
    .eq("id", tenantId)
    .maybeSingle();
  if (
    workspace.error ||
    workspace.data?.status !== "active" ||
    workspace.data.config?.modules?.clients === false
  )
    throw new Error("Client delivery is unavailable in this workspace");
  const opportunityId = input.opportunityId?.trim();
  if (!opportunityId) throw new Error("An opportunity id is required");
  if (!input.actorEmail?.trim()) throw new Error("An actor email is required");

  const { data: opportunity, error: oppError } = await supabase
    .from("opportunities")
    .select("id,stage,name,estimated_value,contact_id,company_id,email,updated_at")
    .eq("tenant_id", tenantId)
    .eq("id", opportunityId)
    .maybeSingle();
  if (oppError) throw new Error(`Could not load opportunity: ${oppError.message}`);
  if (!opportunity) throw new Error("Opportunity not found");
  if (input.expectedUpdatedAt && opportunity.updated_at !== input.expectedUpdatedAt)
    throw new Error("Opportunity changed; reload and review the current record");
  const stages = await loadPipelineStages(supabase, tenantId);
  const role = stages.role(stages.canonicalStage(String(opportunity.stage)) ?? "");
  if (role !== "won")
    throw new Error(`Handoff requires a won opportunity (current stage is ${opportunity.stage})`);

  // An originating proposal, when confirmed, is validated against the same
  // tenant/opportunity and carried on the handoff receipt so delivery is
  // traceable back to the sold scope. Never guess a proposal id.
  let proposal: Row | null = null;
  const proposalId = input.proposalId?.trim() || null;
  if (proposalId) {
    const { data: proposalRow, error: proposalError } = await supabase
      .from("proposals")
      .select("id,opportunity_id,version")
      .eq("tenant_id", tenantId)
      .eq("id", proposalId)
      .maybeSingle();
    if (proposalError)
      throw new Error(`Could not load the originating proposal: ${proposalError.message}`);
    if (!proposalRow)
      throw new Error(`Originating proposal ${JSON.stringify(proposalId)} was not found`);
    if (String((proposalRow as Row).opportunity_id ?? "") !== opportunityId)
      throw new Error("Originating proposal does not belong to this opportunity");
    if (
      input.expectedProposalVersion &&
      Number(proposalRow.version) !== input.expectedProposalVersion
    )
      throw new Error("Proposal version changed; review the current proposal");
    proposal = proposalRow as Row;
  }

  const [contactRead, companyRead] = await Promise.all([
    opportunity.contact_id
      ? supabase
          .from("contacts")
          .select("id,full_name,primary_email")
          .eq("id", opportunity.contact_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    opportunity.company_id
      ? supabase.from("companies").select("id,name").eq("id", opportunity.company_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (contactRead.error || companyRead.error)
    throw new Error("Could not read canonical handoff identities");
  const contact = contactRead.data,
    company = companyRead.data;
  if (!contact || (opportunity.company_id && !company))
    throw new Error("Canonical handoff identity unavailable");
  const contactEmail = (contact?.primary_email as string) || (opportunity.email as string) || null;
  if (!contactEmail) throw new Error("Handoff needs a contact email; nothing to hand off to");

  // One engagement per opportunity: return the existing row on replay.
  const { data: existingClient, error: existingError } = await supabase
    .from("clients")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("opportunity_id", opportunityId)
    .maybeSingle();
  if (existingError) throw new Error(`Could not read engagement: ${existingError.message}`);
  let client = (existingClient ?? null) as Row | null;
  let stored = (client?.handoff_receipt ?? {}) as Row;
  let template = stored.template_snapshot as OnboardingTemplate | undefined;
  if (!template) template = await getActiveTemplate(supabase, tenantId, input.templateKey);
  if (input.expectedTemplateVersion && template.version !== input.expectedTemplateVersion)
    throw new Error("Template version changed; review the current onboarding plan");
  if (input.templateKey && template.key !== input.templateKey)
    throw new Error("Engagement already uses a different onboarding template");
  if (client && proposalId && stored.proposal_id !== proposalId)
    throw new Error("Engagement already has a different proposal binding");
  const unknownRequested = (input.milestoneKeys ?? []).filter(
    (key) => !template!.milestones.some((m) => m.key === key),
  );
  if (unknownRequested.length)
    throw new Error(`Unknown milestone keys: ${unknownRequested.join(", ")}`);
  onboardingMilestonesSchema.parse(template.milestones);
  const binding = {
    opportunity_updated_at: opportunity.updated_at,
    canonical_stage: stages.canonicalStage(String(opportunity.stage)),
    template_snapshot: template,
    proposal_id: proposal?.id ?? null,
    proposal_version: proposal?.version ?? null,
    contact_id: contact.id,
    company_id: company?.id ?? null,
  };
  let created = false;
  if (!client) {
    const businessName =
      (company?.name as string) || (opportunity.name as string) || "Untitled engagement";
    const { data: createdClient, error: createError } = await supabase
      .from("clients")
      .insert({
        tenant_id: tenantId,
        business_name: businessName,
        contact_name: (contact?.full_name as string) || contactEmail,
        contact_email: contactEmail,
        opportunity_id: opportunityId,
        status: "onboarding",
        monthly_value: 0,
        one_time_value: Number(opportunity.estimated_value) || 0,
        onboarding_checklist: [],
        handoff_receipt: binding,
        handoff_revision: 0,
      })
      .select("*")
      .single();
    if (createError?.code === "23505") {
      const raced = await supabase
        .from("clients")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("opportunity_id", opportunityId)
        .maybeSingle();
      if (raced.error || !raced.data)
        throw new Error("Concurrent engagement could not be reconciled; retry the handoff");
      client = raced.data as Row;
    } else {
      if (createError || !createdClient)
        throw new Error(`Could not create engagement: ${createError?.message || "no row"}`);
      client = createdClient as Row;
      created = true;
    }
  }

  stored = (client.handoff_receipt ?? {}) as Row;
  template = (stored.template_snapshot as OnboardingTemplate | undefined) ?? template;
  if (
    (input.templateKey && template.key !== input.templateKey) ||
    (proposalId && stored.proposal_id !== proposalId)
  )
    throw new Error("Concurrent handoff bound different source context; review the engagement");
  if (stored.contact_id && stored.contact_id !== contact.id)
    throw new Error("Canonical contact changed after the handoff; review the engagement");
  if (stored.company_id && stored.company_id !== company?.id)
    throw new Error("Canonical company changed after the handoff; review the engagement");
  if (input.expectedTemplateVersion && template.version !== input.expectedTemplateVersion)
    throw new Error("Concurrent handoff bound a different template version; review the engagement");
  const requested = input.milestoneKeys?.length
    ? template.milestones.filter((m) => input.milestoneKeys!.includes(m.key))
    : template.milestones;

  const checklist = Array.isArray(client.onboarding_checklist)
    ? (client.onboarding_checklist as Array<{ key: string; status: string }>)
    : [];
  const completedKeys = new Set(
    checklist.filter((entry) => entry.status === "complete").map((entry) => entry.key),
  );
  const milestones: HandoffMilestoneState[] = [];
  const createdKeys: string[] = [];
  for (const milestone of requested) {
    if (completedKeys.has(milestone.key)) {
      const existingTask = await findMilestoneTask(supabase, String(client.id), milestone.key);
      milestones.push({
        key: milestone.key,
        title: milestone.title,
        status: "complete",
        task_id: existingTask,
      });
      continue;
    }
    const dedupeKey = `handoff:${client.id}:${milestone.key}`;
    const { task, deduplicated } = await createRevenueTask(supabase, {
      title: milestone.title,
      description:
        `${milestone.owner ? `Owner: ${milestone.owner}. ` : ""}${milestone.description || ""}`.trim() ||
        null,
      dueDate: dueDate(
        milestone.due_offset_days,
        typeof client.created_at === "string" ? client.created_at : undefined,
      ),
      assigneeUserId: milestone.owner_user_id ?? null,
      priority: "medium",
      relatedType: "client",
      relatedId: String(client.id),
      relatedName: String(client.business_name ?? "Engagement"),
      opportunityId,
      source: "delivery_handoff",
      dedupeKey,
      actorEmail: input.actorEmail,
    });
    // A deduplicated task means a previous run already committed this
    // milestone: reuse it without counting new work, so replay converges.
    if (!deduplicated) createdKeys.push(milestone.key);
    const taskStatus = (task as Row).status;
    milestones.push({
      key: milestone.key,
      title: milestone.title,
      status:
        taskStatus === "completed"
          ? "complete"
          : taskStatus === "pending" || taskStatus === "snoozed"
            ? "in_progress"
            : "created",
      task_id: String((task as Row).id),
    });
  }

  let receipt!: HandoffReceipt;
  let remainder: string[] = [];
  let persisted = false;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const fresh = await supabase
      .from("clients")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", client.id)
      .maybeSingle();
    if (fresh.error || !fresh.data)
      throw new Error(
        "Could not refresh engagement; partial handoff may exist. Retry to reconcile.",
      );
    const current = fresh.data as Row;
    const priorChecklist = (
      Array.isArray(current.onboarding_checklist) ? current.onboarding_checklist : []
    ) as Array<{ key: string; status: string; task_id?: string | null }>;
    const nextChecklist = template.milestones.map((m) => {
      const prior = priorChecklist.find((p) => p.key === m.key);
      if (prior?.status === "complete") return { ...prior, title: m.title };
      const state = milestones.find((x) => x.key === m.key);
      return {
        key: m.key,
        title: m.title,
        status: state?.status === "complete" ? "complete" : (prior?.status ?? "open"),
        task_id: state?.task_id ?? prior?.task_id ?? null,
      };
    });
    remainder = nextChecklist
      .filter((m) => m.status !== "complete" && !m.task_id)
      .map((m) => m.key);
    receipt = {
      ...stored,
      engagement_id: String(client.id),
      opportunity_id: opportunityId,
      template_key: template.key,
      template_version: template.version,
      replayed: !created && createdKeys.length === 0,
      created_milestones: createdKeys,
      remainder,
      proposal_id: (stored.proposal_id as string | null) ?? null,
    };
    const update = await supabase
      .from("clients")
      .update({
        onboarding_checklist: nextChecklist,
        handoff_receipt: receipt,
        handoff_revision: Number(current.handoff_revision ?? 0) + 1,
      })
      .eq("tenant_id", tenantId)
      .eq("id", client.id)
      .eq("handoff_revision", current.handoff_revision ?? 0)
      .select("*")
      .maybeSingle();
    if (update.error)
      throw new Error(
        `Could not record handoff state; partial handoff may exist. Retry to reconcile: ${update.error.message}`,
      );
    if (update.data) {
      client = update.data as Row;
      persisted = true;
      break;
    }
  }
  if (!persisted)
    throw new Error(
      "Engagement changed repeatedly; partial handoff may exist. Retry to reconcile.",
    );

  await recordAudit(supabase, {
    actorEmail: input.actorEmail,
    action: "engagement.handed_off",
    entityType: "client",
    entityId: String(client.id),
    source: "admin",
    before: null,
    after: {
      opportunity_id: opportunityId,
      template: `${template.key}:v${template.version}`,
      ...(proposal ? { proposal_id: String(proposal.id) } : {}),
    },
    metadata: { receipt },
  });
  await recordActivity(supabase, {
    activityType: "engagement_handoff",
    title: `Delivery handoff: ${client.business_name}`,
    summary: createdKeys.length
      ? `Created ${createdKeys.length} onboarding commitment(s); ${remainder.length} remaining.`
      : "Replayed handoff changed nothing; all commitments already exist.",
    contactId: (contact?.id as string) ?? null,
    companyId: (company?.id as string) ?? null,
    opportunityId,
    source: "delivery_handoff",
    actorEmail: input.actorEmail,
    externalId: `handoff:${client.id}:${template.key}:v${template.version}:${createdKeys.length}`,
    occurredAt: new Date().toISOString(),
  });
  const { data: refreshed, error: refreshError } = await supabase
    .from("clients")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", client.id)
    .maybeSingle();
  if (refreshError || !refreshed)
    throw new Error("Handoff saved but refresh failed; reload the engagement");
  return {
    client: refreshed as Row,
    created,
    milestones,
    remainder,
    receipt,
    replayed: receipt.replayed,
  };
}

async function findMilestoneTask(
  supabase: SupabaseClient,
  clientId: string,
  milestoneKey: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("tasks")
    .select("id")
    .eq("dedupe_key", `handoff:${clientId}:${milestoneKey}`)
    .limit(1)
    .maybeSingle();
  return (data as { id?: unknown } | null)?.id != null
    ? String((data as { id: unknown }).id)
    : null;
}
