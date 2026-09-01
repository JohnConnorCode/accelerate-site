import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordActivity } from "./activities";
import { recordAudit } from "./audit";
import { normalizeCampaignPolicy } from "./campaigns";
import { normalizeEmail } from "./db";
import { createRevenueTask } from "./tasks";

export const RECOVERY_MOTIONS = [
  "stale_lead",
  "unsold_estimate",
  "no_show",
  "dormant_customer",
  "lapsed_client",
] as const;
export type RecoveryMotion = (typeof RECOVERY_MOTIONS)[number];

export const RECOVERY_MOTION_LABELS: Record<RecoveryMotion, string> = {
  stale_lead: "Stale leads",
  unsold_estimate: "Unsold estimates",
  no_show: "No-shows",
  dormant_customer: "Dormant customers",
  lapsed_client: "Lapsed clients",
};

export interface RecoveryStep {
  delayDays: number;
  subject: string;
  body: string;
}
export interface CreateRecoveryPlaybookInput {
  name: string;
  sourceBatchId: string;
  motion: RecoveryMotion;
  relationshipBasis: string;
  offerLabel: string;
  bookingUrl: string;
  timezone: string;
  outcomeWindowDays: number;
  steps: readonly RecoveryStep[];
  actorEmail: string;
}

const blockingOpportunityStages = new Set([
  "new",
  "contacted",
  "qualified",
  "meeting",
  "proposal",
  "negotiation",
  "booked",
  "showed",
]);
const RECOVERY_TEMPLATE_VARIABLES = new Set([
  "first_name",
  "full_name",
  "company",
  "offer_label",
  "booking_url",
]);

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function unsupportedRecoveryVariables(template: string) {
  return [...template.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)]
    .map((match) => match[1]!)
    .filter((variable) => !RECOVERY_TEMPLATE_VARIABLES.has(variable));
}

export function validateRecoveryInput(input: CreateRecoveryPlaybookInput) {
  const name = text(input.name, 160);
  const relationshipBasis = text(input.relationshipBasis, 300);
  const offerLabel = text(input.offerLabel, 160);
  const bookingUrl = text(input.bookingUrl, 500);
  if (!name) throw new Error("Name this recovery playbook");
  if (!input.sourceBatchId) throw new Error("Choose a completed contact import");
  if (!RECOVERY_MOTIONS.includes(input.motion))
    throw new Error("Choose a supported recovery motion");
  if (!relationshipBasis)
    throw new Error("Confirm why this audience may receive this recovery email");
  if (!offerLabel) throw new Error("State the founder-approved offer or next step");
  try {
    new URL(bookingUrl);
  } catch {
    throw new Error("Use a valid booking URL");
  }
  const outcomeWindowDays = Math.min(90, Math.max(14, Math.trunc(input.outcomeWindowDays || 60)));
  const steps = input.steps.slice(0, 3).map((step, index) => ({
    delayDays: Math.min(30, Math.max(0, Math.trunc(step.delayDays || (index === 0 ? 0 : 3)))),
    subject: text(step.subject, 250),
    body: text(step.body, 10_000),
  }));
  if (!steps.length || steps.some((step) => !step.subject || !step.body))
    throw new Error("Every recovery email needs a subject and body");
  const unsupported = [
    ...new Set(
      steps.flatMap((step) => [
        ...unsupportedRecoveryVariables(step.subject),
        ...unsupportedRecoveryVariables(step.body),
      ]),
    ),
  ];
  if (unsupported.length)
    throw new Error(
      `Recovery copy uses unsupported variable${unsupported.length === 1 ? "" : "s"}: ${unsupported.map((variable) => `{{${variable}}}`).join(", ")}`,
    );
  return {
    name,
    relationshipBasis,
    offerLabel,
    bookingUrl,
    outcomeWindowDays,
    steps,
    timezone: text(input.timezone, 80) || "America/Detroit",
  };
}

export function classifyRecoveryCandidate(input: {
  email: string | null;
  communicationStatus: string | null;
  hasOpenOrAdvancedOpportunity: boolean;
  hasExistingRecovery: boolean;
}) {
  if (!normalizeEmail(input.email))
    return { status: "excluded" as const, reason: "No deliverable email" };
  if (input.communicationStatus && input.communicationStatus !== "active")
    return { status: "excluded" as const, reason: "Contact is suppressed or inactive" };
  if (input.hasOpenOrAdvancedOpportunity)
    return {
      status: "excluded" as const,
      reason: "Contact already has an active or advanced opportunity",
    };
  if (input.hasExistingRecovery)
    return { status: "excluded" as const, reason: "Contact is already in a recovery playbook" };
  return { status: "eligible" as const, reason: null };
}

/** A read-only founder preview. This is intentionally separate from staging:
 * the exact exclusions are inspectable before a campaign draft exists. */
export async function previewRecoveryAudience(supabase: SupabaseClient, sourceBatchId: string) {
  if (!sourceBatchId) throw new Error("Choose a completed contact import");
  const { data: sourceBatch, error: batchError } = await supabase
    .from("contact_import_batches")
    .select("id,status,original_filename,completed_at")
    .eq("id", sourceBatchId)
    .maybeSingle();
  if (batchError) throw new Error(batchError.message);
  if (!sourceBatch || !["completed", "partial"].includes(sourceBatch.status))
    throw new Error("Choose a completed contact import with reviewed records");
  const { data: sourceRows, error: rowError } = await supabase
    .from("contact_import_rows")
    .select("id,imported_contact_id,raw_data")
    .eq("batch_id", sourceBatchId)
    .eq("status", "imported")
    .not("imported_contact_id", "is", null)
    .limit(500);
  if (rowError) throw new Error(rowError.message);
  const contactIds = (sourceRows ?? [])
    .map((row) => row.imported_contact_id)
    .filter((value): value is string => Boolean(value));
  if (!contactIds.length)
    return {
      batch: sourceBatch,
      totals: { candidates: 0, eligible: 0, excluded: 0, estimatedValue: 0 },
      samples: [],
    };
  const [
    { data: contacts, error: contactError },
    { data: opportunities, error: opportunityError },
    { data: previous, error: previousError },
  ] = await Promise.all([
    supabase.from("contacts").select("id,primary_email,communication_status").in("id", contactIds),
    supabase.from("opportunities").select("contact_id,stage").in("contact_id", contactIds),
    supabase
      .from("recovery_candidates")
      .select("contact_id")
      .in("contact_id", contactIds)
      .in("status", ["eligible", "enrolled", "replied", "booked", "reopened", "won"])
      .limit(1000),
  ]);
  if (contactError || opportunityError || previousError)
    throw new Error(
      contactError?.message ||
        opportunityError?.message ||
        previousError?.message ||
        "Could not inspect recovery audience",
    );
  const contactsById = new Map((contacts ?? []).map((row) => [row.id, row]));
  const advanced = new Set(
    (opportunities ?? [])
      .filter((row) => blockingOpportunityStages.has(String(row.stage)))
      .map((row) => row.contact_id),
  );
  const previousContacts = new Set((previous ?? []).map((row) => row.contact_id));
  const samples = (sourceRows ?? []).map((row) => {
    const contact = contactsById.get(row.imported_contact_id!);
    const classification = classifyRecoveryCandidate({
      email: contact?.primary_email ?? null,
      communicationStatus: contact?.communication_status ?? null,
      hasOpenOrAdvancedOpportunity: advanced.has(row.imported_contact_id!),
      hasExistingRecovery: previousContacts.has(row.imported_contact_id!),
    });
    const raw =
      row.raw_data && typeof row.raw_data === "object"
        ? (row.raw_data as Record<string, unknown>)
        : {};
    const estimatedValue = Number(raw.estimated_value || raw.estimate_value || raw.value || 0);
    return {
      email: contact?.primary_email || "No deliverable email",
      status: classification.status,
      reason: classification.reason,
      estimatedValue: Number.isFinite(estimatedValue) && estimatedValue > 0 ? estimatedValue : 0,
    };
  });
  return {
    batch: sourceBatch,
    totals: {
      candidates: samples.length,
      eligible: samples.filter((sample) => sample.status === "eligible").length,
      excluded: samples.filter((sample) => sample.status === "excluded").length,
      estimatedValue: samples.reduce((total, sample) => total + sample.estimatedValue, 0),
    },
    samples: samples.slice(0, 25),
  };
}

/** Creates the whole recovery launch through canonical campaign/contact records.
 * It writes no provider effect; activation remains the existing confirmed action. */
export async function createRecoveryPlaybook(
  supabase: SupabaseClient,
  input: CreateRecoveryPlaybookInput,
) {
  const valid = validateRecoveryInput(input);
  const { data: sourceBatch, error: batchError } = await supabase
    .from("contact_import_batches")
    .select("id,status,original_filename,completed_at")
    .eq("id", input.sourceBatchId)
    .maybeSingle();
  if (batchError) throw new Error(batchError.message);
  if (!sourceBatch || !["completed", "partial"].includes(sourceBatch.status))
    throw new Error("Choose a completed contact import with reviewed records");
  const { data: sourceRows, error: rowError } = await supabase
    .from("contact_import_rows")
    .select("id,imported_contact_id,raw_data,reviewed_data")
    .eq("batch_id", input.sourceBatchId)
    .eq("status", "imported")
    .not("imported_contact_id", "is", null)
    .limit(500);
  if (rowError) throw new Error(rowError.message);
  if (!sourceRows?.length)
    throw new Error("This import has no completed contact records to recover");
  const contactIds = sourceRows
    .map((row) => row.imported_contact_id)
    .filter((value): value is string => Boolean(value));
  const [
    { data: contacts, error: contactError },
    { data: opportunities, error: opportunityError },
    { data: previous, error: previousError },
  ] = await Promise.all([
    supabase.from("contacts").select("id,primary_email,communication_status").in("id", contactIds),
    supabase.from("opportunities").select("contact_id,stage,id").in("contact_id", contactIds),
    supabase
      .from("recovery_candidates")
      .select("contact_id")
      .in("contact_id", contactIds)
      .in("status", ["eligible", "enrolled", "replied", "booked", "reopened", "won"])
      .limit(1000),
  ]);
  if (contactError || opportunityError || previousError)
    throw new Error(
      contactError?.message ||
        opportunityError?.message ||
        previousError?.message ||
        "Could not inspect recovery audience",
    );
  const contactsById = new Map((contacts ?? []).map((row) => [row.id, row]));
  const advanced = new Set(
    (opportunities ?? [])
      .filter((row) => blockingOpportunityStages.has(String(row.stage)))
      .map((row) => row.contact_id),
  );
  const previousContacts = new Set((previous ?? []).map((row) => row.contact_id));
  const { data: existingPlaybook, error: existingPlaybookError } = await supabase
    .from("recovery_playbooks")
    .select("id,campaign_id")
    .eq("source_batch_id", input.sourceBatchId)
    .eq("motion_key", input.motion)
    .maybeSingle();
  if (existingPlaybookError) throw new Error(existingPlaybookError.message);
  if (existingPlaybook)
    throw new Error(
      "This recovery motion is already staged for this import. Open the existing playbook instead of creating a second campaign.",
    );

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .insert({
      name: valid.name,
      status: "draft",
      sender_name: null,
      sender_email: null,
      audience_definition: {
        type: "recovery_import",
        sourceBatchId: input.sourceBatchId,
        motion: input.motion,
      },
      policy: normalizeCampaignPolicy({
        daily_limit: 10,
        stop_on_reply: true,
        stop_on_booking: true,
        stop_on_bounce: true,
        stop_on_unsubscribe: true,
      }),
    })
    .select("id,name,status,version")
    .single();
  if (campaignError || !campaign)
    throw new Error(campaignError?.message || "Could not create recovery campaign");
  const cleanup = async () => {
    await supabase.from("campaigns").delete().eq("id", campaign.id);
  };
  const { data: playbook, error: playbookError } = await supabase
    .from("recovery_playbooks")
    .insert({
      campaign_id: campaign.id,
      source_batch_id: input.sourceBatchId,
      motion_key: input.motion,
      relationship_basis: valid.relationshipBasis,
      offer_label: valid.offerLabel,
      booking_url: valid.bookingUrl,
      timezone: valid.timezone,
      outcome_window_days: valid.outcomeWindowDays,
      created_by: input.actorEmail,
    })
    .select("id")
    .single();
  if (playbookError || !playbook) {
    await cleanup();
    if (playbookError?.code === "23505")
      throw new Error(
        "This recovery motion is already staged for this import. Open the existing playbook instead of creating a second campaign.",
      );
    throw new Error(playbookError?.message || "Could not create recovery playbook");
  }
  const stepRows = valid.steps.map((step, index) => ({
    campaign_id: campaign.id,
    step_order: index + 1,
    delay_days: step.delayDays,
    subject_template: step.subject,
    body_template: step.body,
  }));
  const { error: stepsError } = await supabase.from("campaign_steps").insert(stepRows);
  if (stepsError) {
    await cleanup();
    throw new Error(stepsError.message);
  }

  const end = new Date(Date.now() + valid.outcomeWindowDays * 86_400_000).toISOString();
  const candidates = sourceRows.map((row) => {
    const contact = contactsById.get(row.imported_contact_id!);
    const classification = classifyRecoveryCandidate({
      email: contact?.primary_email ?? null,
      communicationStatus: contact?.communication_status ?? null,
      hasOpenOrAdvancedOpportunity: advanced.has(row.imported_contact_id!),
      hasExistingRecovery: previousContacts.has(row.imported_contact_id!),
    });
    const raw =
      row.raw_data && typeof row.raw_data === "object"
        ? (row.raw_data as Record<string, unknown>)
        : {};
    const value = Number(raw.estimated_value || raw.estimate_value || raw.value || 0);
    return {
      playbook_id: playbook.id,
      campaign_id: campaign.id,
      contact_id: row.imported_contact_id,
      import_row_id: row.id,
      email: contact?.primary_email || "",
      status: classification.status,
      exclusion_reason: classification.reason,
      estimated_value: Number.isFinite(value) && value > 0 ? value : 0,
      eligibility_evidence: {
        sourceBatchId: input.sourceBatchId,
        importRowId: row.id,
        relationshipBasis: valid.relationshipBasis,
      },
      baseline: {
        importedAt: sourceBatch.completed_at,
        opportunityState: advanced.has(row.imported_contact_id!) ? "advanced" : "none",
      },
      outcome_window_ends_at: classification.status === "eligible" ? end : null,
    };
  });
  if (!candidates.some((candidate) => candidate.status === "eligible")) {
    await cleanup();
    throw new Error(
      "No contacts are eligible for this recovery playbook. Review the exclusions before staging a campaign.",
    );
  }
  const { error: candidateError } = await supabase.from("recovery_candidates").insert(candidates);
  if (candidateError) {
    await cleanup();
    throw new Error(candidateError.message);
  }
  const members = candidates
    .filter((candidate) => candidate.status === "eligible")
    .map((candidate) => ({
      campaign_id: campaign.id,
      contact_id: candidate.contact_id,
      email: candidate.email,
      status: "queued",
    }));
  if (members.length) {
    const { error: memberError } = await supabase.from("campaign_members").insert(members);
    if (memberError) {
      await cleanup();
      throw new Error(memberError.message);
    }
    await supabase
      .from("recovery_candidates")
      .update({ status: "enrolled" })
      .eq("campaign_id", campaign.id)
      .eq("status", "eligible");
  }
  const summary = {
    candidates: candidates.length,
    eligible: members.length,
    excluded: candidates.length - members.length,
    motion: input.motion,
    sourceBatchId: input.sourceBatchId,
  };
  await recordActivity(supabase, {
    activityType: "recovery_playbook_created",
    title: `Recovery playbook created: ${valid.name}`,
    summary: `${members.length} eligible contacts staged from a reviewed import. No email has been sent.`,
    campaignId: campaign.id,
    source: "recovery",
    actorEmail: input.actorEmail,
    externalId: `recovery-playbook:${campaign.id}`,
    metadata: summary,
  });
  await recordAudit(supabase, {
    actorEmail: input.actorEmail,
    action: "recovery_playbook.created",
    entityType: "campaign",
    entityId: campaign.id,
    after: summary,
  });
  return { campaign, playbookId: playbook.id, ...summary };
}

export async function loadRecoveryWorkspace(supabase: SupabaseClient) {
  const [playbooks, batches] = await Promise.all([
    supabase
      .from("recovery_playbooks")
      .select(
        "id,campaign_id,motion_key,offer_label,booking_url,timezone,outcome_window_days,created_at,campaigns(id,name,status,version,approved_version,campaign_members(id,status))",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("contact_import_batches")
      .select("id,original_filename,status,completed_at,selected_row_count,created_at")
      .in("status", ["completed", "partial"])
      .order("completed_at", { ascending: false })
      .limit(50),
  ]);
  if (playbooks.error || batches.error)
    throw new Error(
      playbooks.error?.message || batches.error?.message || "Could not load recovery workspace",
    );
  const rows = playbooks.data ?? [];
  const ids = rows.map((row) => row.id);
  const { data: candidates, error: candidateError } = ids.length
    ? await supabase
        .from("recovery_candidates")
        .select("id,playbook_id,status,estimated_value")
        .in("playbook_id", ids)
        .limit(5000)
    : { data: [], error: null };
  if (candidateError) throw new Error(candidateError.message);
  const candidateIds = (candidates ?? []).map((candidate) => candidate.id);
  const { data: outcomes, error: outcomeError } = candidateIds.length
    ? await supabase
        .from("recovery_outcomes")
        .select("candidate_id,amount,outcome_type")
        .in("candidate_id", candidateIds)
        .eq("outcome_type", "won")
        .limit(5000)
    : { data: [], error: null };
  if (outcomeError) throw new Error(outcomeError.message);
  const recoveredByCandidate = new Map(
    (outcomes ?? []).map((outcome) => [outcome.candidate_id, Number(outcome.amount || 0)]),
  );
  const metrics = new Map<
    string,
    {
      eligible: number;
      excluded: number;
      replied: number;
      booked: number;
      won: number;
      estimatedValue: number;
      wonRevenue: number;
    }
  >();
  for (const candidate of candidates ?? []) {
    const value = metrics.get(candidate.playbook_id) || {
      eligible: 0,
      excluded: 0,
      replied: 0,
      booked: 0,
      won: 0,
      estimatedValue: 0,
      wonRevenue: 0,
    };
    if (["enrolled", "eligible"].includes(candidate.status)) value.eligible++;
    if (candidate.status === "excluded") value.excluded++;
    if (candidate.status === "replied") value.replied++;
    if (candidate.status === "booked") value.booked++;
    if (candidate.status === "won") value.won++;
    value.estimatedValue += Number(candidate.estimated_value || 0);
    value.wonRevenue += recoveredByCandidate.get(candidate.id) || 0;
    metrics.set(candidate.playbook_id, value);
  }
  return {
    schemaReady: true,
    batches: batches.data ?? [],
    playbooks: rows.map((row) => ({
      ...row,
      metrics: metrics.get(row.id) || {
        eligible: 0,
        excluded: 0,
        replied: 0,
        booked: 0,
        won: 0,
        estimatedValue: 0,
        wonRevenue: 0,
      },
    })),
  };
}

const outcomeRank: Record<string, number> = {
  enrolled: 0,
  replied: 1,
  booked: 2,
  reopened: 3,
  won: 4,
};

/** Reconciles canonical campaign and opportunity facts into recovery receipts.
 * This never sends, changes pipeline state, or overwrites acquisition attribution. */
export async function reconcileRecoveryOutcomes(
  supabase: SupabaseClient,
  campaignId: string,
  actorEmail: string,
) {
  const { data: candidates, error: candidateError } = await supabase
    .from("recovery_candidates")
    .select("id,contact_id,email,status,created_at,outcome_window_ends_at")
    .eq("campaign_id", campaignId)
    .in("status", ["enrolled", "replied", "booked", "reopened"])
    .limit(500);
  if (candidateError) throw new Error(candidateError.message);
  if (!candidates?.length) return { reconciled: 0, outcomes: 0 };
  const contactIds = candidates.map((row) => row.contact_id);
  const [
    { data: members, error: memberError },
    { data: opportunities, error: opportunityError },
    { data: existing, error: existingError },
    { data: responseActivities, error: activityError },
  ] = await Promise.all([
    supabase
      .from("campaign_members")
      .select("contact_id,status,stop_reason,id")
      .eq("campaign_id", campaignId)
      .in("contact_id", contactIds),
    supabase
      .from("opportunities")
      .select("id,contact_id,stage,won_value,closed_at")
      .in("contact_id", contactIds),
    supabase
      .from("recovery_outcomes")
      .select("candidate_id,outcome_type,opportunity_id")
      .in(
        "candidate_id",
        candidates.map((row) => row.id),
      ),
    supabase
      .from("activities")
      .select("contact_id,activity_type,occurred_at")
      .in("contact_id", contactIds)
      .in("activity_type", ["calendar_booking", "gmail_reply_received"])
      .limit(1000),
  ]);
  if (memberError || opportunityError || existingError || activityError)
    throw new Error(
      memberError?.message ||
        opportunityError?.message ||
        existingError?.message ||
        activityError?.message ||
        "Could not reconcile recovery outcomes",
    );
  const memberByContact = new Map((members ?? []).map((row) => [row.contact_id, row]));
  const opportunitiesByContact = new Map<
    string,
    Array<{ id: string; stage: string; won_value: number; closed_at: string | null }>
  >();
  for (const opportunity of opportunities ?? [])
    opportunitiesByContact.set(opportunity.contact_id, [
      ...(opportunitiesByContact.get(opportunity.contact_id) || []),
      opportunity,
    ]);
  const latestCalendarBookingByContact = new Map<string, string>();
  const latestGmailReplyByContact = new Map<string, string>();
  for (const activity of responseActivities ?? []) {
    if (!activity.contact_id) continue;
    const target =
      activity.activity_type === "calendar_booking"
        ? latestCalendarBookingByContact
        : latestGmailReplyByContact;
    const previous = target.get(activity.contact_id);
    if (!previous || Date.parse(activity.occurred_at) > Date.parse(previous))
      target.set(activity.contact_id, activity.occurred_at);
  }
  const known = new Set(
    (existing ?? []).map(
      (row) => `${row.candidate_id}:${row.outcome_type}:${row.opportunity_id || "none"}`,
    ),
  );
  let outcomes = 0;
  for (const candidate of candidates) {
    if (
      candidate.outcome_window_ends_at &&
      Date.parse(candidate.outcome_window_ends_at) < Date.now()
    )
      continue;
    const member = memberByContact.get(candidate.contact_id);
    const contactOpportunities = opportunitiesByContact.get(candidate.contact_id) || [];
    // A previously-closed deal is not recovery revenue. Attribute only wins
    // that close after the candidate entered this bounded recovery motion.
    const won = contactOpportunities.find(
      (item) =>
        item.stage === "won" &&
        Boolean(item.closed_at) &&
        Date.parse(item.closed_at!) >= Date.parse(candidate.created_at),
    );
    // Calendar adapters stop the governed membership first to prevent another
    // campaign step from racing a real appointment. That stop receipt is also
    // the canonical booking fact for recovery contacts that do not yet have an
    // opportunity of their own.
    const bookedViaCalendarReceipt = Boolean(
      latestCalendarBookingByContact.get(candidate.contact_id) &&
      Date.parse(latestCalendarBookingByContact.get(candidate.contact_id)!) >=
        Date.parse(candidate.created_at),
    );
    const booked =
      member?.status === "booked" ||
      member?.stop_reason === "calendar_booking" ||
      bookedViaCalendarReceipt;
    // Gmail sync stops the governed membership before the next campaign step
    // can race a human reply. That durable stop reason is the reply fact for
    // recovery; without it a warm reply would be safely stopped yet invisible
    // to the founder's follow-up queue.
    const repliedViaGmailReceipt = Boolean(
      latestGmailReplyByContact.get(candidate.contact_id) &&
      Date.parse(latestGmailReplyByContact.get(candidate.contact_id)!) >=
        Date.parse(candidate.created_at),
    );
    const replied =
      member?.status === "replied" ||
      member?.stop_reason === "gmail_reply" ||
      repliedViaGmailReceipt ||
      booked;
    const next = won ? "won" : booked ? "booked" : replied ? "replied" : null;
    if (!next || (outcomeRank[next] ?? 0) <= (outcomeRank[candidate.status] ?? 0)) continue;
    const opportunityId = won?.id || null;
    const outcomeKey = `${candidate.id}:${next}:${opportunityId || "none"}`;
    if (!known.has(outcomeKey)) {
      const { error } = await supabase.from("recovery_outcomes").insert({
        candidate_id: candidate.id,
        opportunity_id: opportunityId,
        outcome_type: next,
        amount: next === "won" ? Number(won?.won_value || 0) : 0,
        source_receipt_id:
          next === "won"
            ? `opportunity:${opportunityId}`
            : `campaign_member:${member?.id || "unknown"}`,
      });
      if (error) throw new Error(error.message);
      known.add(outcomeKey);
      outcomes++;
    }
    // Recovery only creates a task when a human response can convert into revenue.
    // Create it before advancing the candidate state: if task creation fails, the next
    // reconciliation retries it; if reconciliation retries after success, the task's
    // durable open-task key prevents duplicate founder work.
    if (next === "replied" || next === "booked") {
      const isBooking = next === "booked";
      await createRevenueTask(supabase, {
        title: `${isBooking ? "Confirm recovery booking" : "Reply to recovery lead"}: ${candidate.email}`,
        description: isBooking
          ? "A recovery contact booked the approved next step. Confirm the appointment and prepare the conversation."
          : "A recovery contact replied. Respond personally while intent is fresh and guide them to the approved next step.",
        dueDate: new Date().toISOString().slice(0, 10),
        priority: "high",
        relatedType: "contact",
        relatedId: candidate.contact_id,
        relatedName: candidate.email,
        source: "recovery",
        dedupeKey: `recovery-follow-up:${candidate.id}:${next}`,
        actorEmail,
      });
    }
    const { error: updateError } = await supabase
      .from("recovery_candidates")
      .update({ status: next })
      .eq("id", candidate.id);
    if (updateError) throw new Error(updateError.message);
    await recordActivity(supabase, {
      activityType: "recovery_outcome_recorded",
      title: `Recovery outcome: ${next.replace(/_/g, " ")}`,
      summary:
        next === "won"
          ? `Recovered won value: ${Number(won?.won_value || 0).toLocaleString()}.`
          : `Recovery contact reached ${next.replace(/_/g, " ")}.`,
      contactId: candidate.contact_id,
      opportunityId,
      campaignId,
      source: "recovery",
      actorEmail,
      externalId: `recovery-outcome:${candidate.id}:${next}:${opportunityId || "none"}`,
      metadata: {
        candidateId: candidate.id,
        outcomeType: next,
        amount: next === "won" ? Number(won?.won_value || 0) : 0,
      },
    });
  }
  return { reconciled: candidates.length, outcomes };
}
