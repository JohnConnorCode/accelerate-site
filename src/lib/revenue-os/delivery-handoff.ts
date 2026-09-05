import "server-only";
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
}

const DEFAULT_TEMPLATE_KEY = "default";

export const SEED_DEFAULT_MILESTONES: OnboardingMilestone[] = [
  {
    key: "kickoff",
    title: "Kickoff call",
    description: "Align on goals, success criteria, and cadence.",
    owner: "founder",
    due_offset_days: 3,
  },
  {
    key: "access",
    title: "Access and assets",
    description: "Collect logins, brand assets, and data sources.",
    owner: "founder",
    due_offset_days: 7,
  },
  {
    key: "first-win",
    title: "First win",
    description: "Deliver the first visible outcome from the proposal scope.",
    owner: "founder",
    due_offset_days: 14,
  },
];

type Row = Record<string, unknown>;

function requireTenant(tenantId: string): string {
  const id = tenantId?.trim();
  if (!id) throw new Error("A tenant id is required for delivery handoff");
  return id;
}

function dueDate(offsetDays: number | null | undefined): string {
  const days = Number.isFinite(Number(offsetDays)) ? Number(offsetDays) : 7;
  return new Date(Date.now() + Math.max(0, days) * 86_400_000).toISOString().split("T")[0]!;
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
  if (seedError) throw new Error(`Could not seed the default playbook: ${seedError.message}`);
  return { key: DEFAULT_TEMPLATE_KEY, version: 1, milestones: SEED_DEFAULT_MILESTONES };
}

export async function createOnboardingTemplateVersion(
  supabase: SupabaseClient,
  input: { tenantId: string; templateKey?: string; milestones: OnboardingMilestone[]; actorEmail: string },
): Promise<OnboardingTemplate> {
  const tenant = requireTenant(input.tenantId);
  const key = (input.templateKey ?? DEFAULT_TEMPLATE_KEY).trim() || DEFAULT_TEMPLATE_KEY;
  if (!Array.isArray(input.milestones) || !input.milestones.length)
    throw new Error("A template version needs at least one milestone");
  for (const milestone of input.milestones) {
    if (!milestone.key?.trim() || !milestone.title?.trim())
      throw new Error("Every milestone needs a key and a title");
  }
  const { data: existing } = await supabase
    .from("onboarding_templates")
    .select("version")
    .eq("tenant_id", tenant)
    .eq("template_key", key)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = Number((existing as Row | null)?.version ?? 0) + 1;
  // Supersede, never mutate: prior versions stay readable for in-flight handoffs.
  await supabase
    .from("onboarding_templates")
    .update({ active: false })
    .eq("tenant_id", tenant)
    .eq("template_key", key)
    .eq("active", true);
  const { error } = await supabase.from("onboarding_templates").insert({
    tenant_id: tenant,
    template_key: key,
    version,
    active: true,
    milestones: input.milestones,
  });
  if (error) throw new Error(`Could not publish template version: ${error.message}`);
  await recordAudit(supabase, {
    actorEmail: input.actorEmail,
    action: "onboarding_template.published",
    entityType: "onboarding_template",
    entityId: `${key}:v${version}`,
    metadata: { template_key: key, version },
  });
  return { key, version, milestones: input.milestones };
}

export interface HandoffInput {
  tenantId: string;
  opportunityId: string;
  actorEmail: string;
  templateKey?: string;
  /** Subset of milestone keys to hand off; omitted means the whole template. */
  milestoneKeys?: string[];
  proposalId?: string | null;
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
  const opportunityId = input.opportunityId?.trim();
  if (!opportunityId) throw new Error("An opportunity id is required");
  if (!input.actorEmail?.trim()) throw new Error("An actor email is required");

  const { data: opportunity, error: oppError } = await supabase
    .from("opportunities")
    .select("id,stage,name,estimated_value,contact_id,company_id,email")
    .eq("tenant_id", tenantId)
    .eq("id", opportunityId)
    .maybeSingle();
  if (oppError) throw new Error(`Could not load opportunity: ${oppError.message}`);
  if (!opportunity) throw new Error("Opportunity not found");
  const stages = await loadPipelineStages(supabase, tenantId);
  const role = stages.role(stages.canonicalStage(String(opportunity.stage)) ?? "");
  if (role !== "won") throw new Error(`Handoff requires a won opportunity (current stage is ${opportunity.stage})`);

  const [{ data: contact }, { data: company }] = await Promise.all([
    opportunity.contact_id
      ? supabase.from("contacts").select("id,full_name,primary_email").eq("id", opportunity.contact_id).maybeSingle()
      : Promise.resolve({ data: null }),
    opportunity.company_id
      ? supabase.from("companies").select("id,name").eq("id", opportunity.company_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const contactEmail =
    (contact?.primary_email as string) || (opportunity.email as string) || null;
  if (!contactEmail) throw new Error("Handoff needs a contact email; nothing to hand off to");

  // One engagement per opportunity: return the existing row on replay.
  const { data: existingClient } = await supabase
    .from("clients")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("opportunity_id", opportunityId)
    .maybeSingle();
  let client = (existingClient ?? null) as Row | null;
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
        handoff_receipt: {},
      })
      .select("*")
      .single();
    if (createError || !createdClient) throw new Error(`Could not create engagement: ${createError?.message || "no row"}`);
    client = createdClient as Row;
    created = true;
  }

  const template = await getActiveTemplate(supabase, tenantId, input.templateKey);
  const requested = input.milestoneKeys?.length
    ? template.milestones.filter((m) => input.milestoneKeys!.includes(m.key))
    : template.milestones;
  const unknownRequested = (input.milestoneKeys ?? []).filter(
    (key) => !template.milestones.some((m) => m.key === key),
  );
  if (unknownRequested.length)
    throw new Error(`Unknown milestone keys: ${unknownRequested.join(", ")}`);

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
      milestones.push({ key: milestone.key, title: milestone.title, status: "complete", task_id: existingTask });
      continue;
    }
    const dedupeKey = `handoff:${client.id}:${milestone.key}`;
    const { task, deduplicated } = await createRevenueTask(supabase, {
      title: milestone.title,
      description: `${milestone.owner ? `Owner: ${milestone.owner}. ` : ""}${milestone.description || ""}`.trim() || null,
      dueDate: dueDate(milestone.due_offset_days),
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
      status: taskStatus === "completed" ? "complete" : taskStatus === "pending" || taskStatus === "snoozed" ? "in_progress" : "created",
      task_id: String((task as Row).id),
    });
  }

  // Persist checklist state: completed stays completed, everything touched
  // this run records its outcome. Partial handoffs keep prior progress.
  const nextChecklist = template.milestones.map((milestone) => {
    const prior = checklist.find((entry) => entry.key === milestone.key);
    if (prior?.status === "complete") return { ...prior, title: milestone.title };
    const state = milestones.find((m) => m.key === milestone.key);
    return {
      key: milestone.key,
      title: milestone.title,
      status: state ? (state.status === "complete" ? "complete" : "open") : (prior?.status ?? "open"),
      task_id: state?.task_id ?? (prior as { task_id?: string } | undefined)?.task_id ?? null,
    };
  });
  const coveredKeys = new Set([...completedKeys, ...milestones.map((m) => m.key)]);
  const remainder = template.milestones
    .filter((m) => !coveredKeys.has(m.key))
    .map((m) => m.key);
  const receipt: HandoffReceipt = {
    engagement_id: String(client.id),
    opportunity_id: opportunityId,
    template_key: template.key,
    template_version: template.version,
    replayed: !created && createdKeys.length === 0,
    created_milestones: createdKeys,
    remainder,
  };
  const { error: clientError } = await supabase
    .from("clients")
    .update({ onboarding_checklist: nextChecklist, handoff_receipt: receipt })
    .eq("tenant_id", tenantId)
    .eq("id", client.id);
  if (clientError) throw new Error(`Could not record handoff state: ${clientError.message}`);

  await recordAudit(supabase, {
    actorEmail: input.actorEmail,
    action: "engagement.handed_off",
    entityType: "client",
    entityId: String(client.id),
    source: "admin",
    before: null,
    after: { opportunity_id: opportunityId, template: `${template.key}:v${template.version}` },
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
  const { data: refreshed } = await supabase
    .from("clients")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", client.id)
    .maybeSingle();
  return {
    client: ((refreshed ?? client) as Row),
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
  return (data as { id?: unknown } | null)?.id != null ? String((data as { id: unknown }).id) : null;
}
