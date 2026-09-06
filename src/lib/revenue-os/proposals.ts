import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";
import { proposalAuditSummary, recordAudit } from "./audit";
import { recordActivity } from "./activities";
import { transitionOpportunity } from "./pipeline";
import { createRevenueTask } from "./tasks";

export const PROPOSAL_STATUSES = [
  "draft",
  "sent",
  "viewed",
  "accepted",
  "declined",
  "expired",
  "superseded",
] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

const TERMINAL: ProposalStatus[] = ["accepted", "declined", "expired", "superseded"];

export const PROPOSAL_TRANSITIONS: Record<ProposalStatus, ProposalStatus[]> = {
  draft: ["sent"],
  sent: ["viewed", "accepted", "declined", "expired", "superseded"],
  viewed: ["accepted", "declined", "expired", "superseded"],
  accepted: [],
  declined: [],
  expired: [],
  superseded: [],
};

const MATERIAL_FIELDS = ["title", "content", "total_one_time", "total_monthly", "client_name"] as const;

export function isProposalStatus(value: unknown): value is ProposalStatus {
  return typeof value === "string" && (PROPOSAL_STATUSES as readonly string[]).includes(value);
}

export function isTerminalProposalStatus(status: string): boolean {
  return TERMINAL.includes(status as ProposalStatus);
}

export function canTransitionProposal(from: string, to: string): boolean {
  if (!isProposalStatus(from) || !isProposalStatus(to)) return false;
  if (from === to) return true;
  return PROPOSAL_TRANSITIONS[from].includes(to);
}

export function assertProposalTransition(from: string, to: string) {
  if (!canTransitionProposal(from, to)) {
    throw new Error(`Cannot move a ${from} proposal to ${to}`);
  }
}

export function isMaterialProposalChange(
  before: Record<string, unknown>,
  patch: Record<string, unknown>,
): boolean {
  return MATERIAL_FIELDS.some((field) => {
    if (!(field in patch)) return false;
    return JSON.stringify(patch[field]) !== JSON.stringify(before[field]);
  });
}

type ProposalRow = Record<string, unknown> & {
  id: string;
  status: string;
  version?: number;
  share_token?: string;
  expires_at?: string | null;
  opportunity_id?: string | null;
  client_name?: string;
  title?: string;
};

async function loadProposal(supabase: SupabaseClient, id: string): Promise<ProposalRow> {
  const { data, error } = await supabase.from("proposals").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Proposal not found");
  return data as ProposalRow;
}

async function writeEvent(
  supabase: SupabaseClient,
  proposalId: string,
  eventType: string,
  source: string,
  metadata: Record<string, unknown> = {},
) {
  const { error } = await supabase.from("proposal_events").insert({
    proposal_id: proposalId,
    event_type: eventType,
    source,
    metadata,
  });
  if (error) throw new Error(error.message);
}

async function commitStatus(
  supabase: SupabaseClient,
  proposal: ProposalRow,
  to: ProposalStatus,
  extra: Record<string, unknown>,
): Promise<ProposalRow> {
  assertProposalTransition(proposal.status, to);
  const { data, error } = await supabase
    .from("proposals")
    .update({ status: to, updated_at: new Date().toISOString(), ...extra })
    .eq("id", proposal.id)
    .eq("status", proposal.status)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("This proposal was already updated. Refresh and try again.");
  return data as ProposalRow;
}

export async function sendProposal(
  supabase: SupabaseClient,
  input: { id: string; actorEmail: string; source?: string },
): Promise<ProposalRow> {
  const proposal = await loadProposal(supabase, input.id);
  if (proposal.status === "sent" || proposal.status === "viewed") return proposal;
  const updated = await commitStatus(supabase, proposal, "sent", {
    sent_at: new Date().toISOString(),
  });
  await writeEvent(supabase, updated.id, "sent", input.source ?? "admin");
  await recordAudit(supabase, {
    actorEmail: input.actorEmail,
    action: "proposal.sent",
    entityType: "proposal",
    entityId: updated.id,
    source: "admin",
    before: proposalAuditSummary(proposal),
    after: proposalAuditSummary(updated),
  });
  return updated;
}

export async function recordProposalView(
  supabase: SupabaseClient,
  input: { id: string; source?: string },
): Promise<{ proposal: ProposalRow; alreadyViewed: boolean }> {
  const proposal = await expireIfDue(supabase, await loadProposal(supabase, input.id), input.source ?? "public_link");
  if (proposal.status === "draft") return { proposal, alreadyViewed: false };
  if (proposal.viewed_at || proposal.status === "viewed") return { proposal, alreadyViewed: true };
  if (isTerminalProposalStatus(proposal.status)) return { proposal, alreadyViewed: true };
  const updated = await commitStatus(supabase, proposal, "viewed", {
    viewed_at: new Date().toISOString(),
  });
  await writeEvent(supabase, updated.id, "viewed", input.source ?? "public_link");
  await recordAudit(supabase, {
    action: "proposal.viewed",
    entityType: "proposal",
    entityId: updated.id,
    source: "public",
    before: proposalAuditSummary(proposal),
    after: proposalAuditSummary(updated),
  });
  return { proposal: updated, alreadyViewed: false };
}

export async function decideProposal(
  supabase: SupabaseClient,
  input: {
    id: string;
    decision: "accepted" | "declined";
    reason?: string | null;
    actorEmail: string;
    source?: string;
  },
): Promise<{ proposal: ProposalRow; alreadyResponded: boolean }> {
  const source = input.source ?? "public_link";
  let proposal = await expireIfDue(supabase, await loadProposal(supabase, input.id), source);
  if (proposal.status === input.decision) {
    await syncOpportunity(supabase, proposal, input.decision, input.reason, input.actorEmail, source);
    return { proposal, alreadyResponded: true };
  }
  if (isTerminalProposalStatus(proposal.status)) {
    throw new Error("This proposal is no longer open for a response");
  }
  if (input.decision === "declined" && !input.reason?.trim()) {
    throw new Error("A decline reason is required");
  }
  const now = new Date().toISOString();
  const before = proposal;
  proposal = await commitStatus(supabase, proposal, input.decision, {
    responded_at: now,
    decline_reason: input.decision === "declined" ? input.reason!.trim().slice(0, 1000) : null,
  });
  await writeEvent(supabase, proposal.id, input.decision, source, {
    reason: input.reason?.trim() || null,
  });
  await recordActivity(supabase, {
    activityType: `proposal_${input.decision}`,
    title: `${proposal.client_name} ${input.decision} ${proposal.title}`,
    summary: input.reason?.trim() || null,
    opportunityId: (proposal.opportunity_id as string | null) ?? null,
    proposalId: proposal.id,
    source,
    actorEmail: input.actorEmail,
    externalId: `proposal:${proposal.id}:decision:${input.decision}`,
    occurredAt: now,
  });
  await createRevenueTask(supabase, {
    title: `${input.decision === "accepted" ? "Start next steps with" : "Review decline from"} ${proposal.client_name}`,
    description: input.reason?.trim() || `Proposal ${input.decision}. Follow up personally.`,
    dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    priority: "high",
    relatedType: "proposal",
    relatedId: proposal.id,
    relatedName: String(proposal.client_name || ""),
    opportunityId: (proposal.opportunity_id as string | null) ?? null,
    source: "proposal_response",
    dedupeKey: `proposal-response:${proposal.id}`,
    actorEmail: input.actorEmail,
  });
  await recordAudit(supabase, {
    actorEmail: input.actorEmail,
    action: input.decision === "accepted" ? "proposal.accepted" : "proposal.declined",
    entityType: "proposal",
    entityId: proposal.id,
    source: source === "public_link" ? "public" : "admin",
    before: proposalAuditSummary(before),
    after: proposalAuditSummary(proposal),
    metadata: { has_reason: Boolean(input.reason?.trim()) },
  });
  await syncOpportunity(supabase, proposal, input.decision, input.reason, input.actorEmail, source);
  return { proposal, alreadyResponded: false };
}

async function syncOpportunity(
  supabase: SupabaseClient,
  proposal: ProposalRow,
  decision: "accepted" | "declined",
  reason: string | null | undefined,
  actorEmail: string,
  source: string,
) {
  if (!proposal.opportunity_id) return;
  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("stage")
    .eq("id", proposal.opportunity_id)
    .maybeSingle();
  if (!opportunity) return;
  const to = decision === "accepted" ? "negotiation" : "lost";
  const current = String(opportunity.stage);
  if (current === to || ["won", "lost"].includes(current)) return;
  await transitionOpportunity(supabase, {
    id: String(proposal.opportunity_id),
    to,
    actorEmail,
    source,
    reason: decision === "accepted" ? "Client accepted proposal" : "Client declined proposal",
    lossReason: decision === "declined" ? reason?.trim().slice(0, 1000) : undefined,
  });
}

async function expireIfDue(
  supabase: SupabaseClient,
  proposal: ProposalRow,
  source: string,
): Promise<ProposalRow> {
  if (!proposal.expires_at || isTerminalProposalStatus(proposal.status)) return proposal;
  if (Date.parse(String(proposal.expires_at)) > Date.now()) return proposal;
  if (!canTransitionProposal(proposal.status, "expired")) return proposal;
  const updated = await commitStatus(supabase, proposal, "expired", {});
  await writeEvent(supabase, updated.id, "expired", source);
  await recordAudit(supabase, {
    action: "proposal.expired",
    entityType: "proposal",
    entityId: updated.id,
    source: "automation",
    before: proposalAuditSummary(proposal),
    after: proposalAuditSummary(updated),
  });
  return updated;
}

export async function updateProposalDraft(
  supabase: SupabaseClient,
  input: { id: string; actorEmail: string; patch: Record<string, unknown> },
): Promise<ProposalRow> {
  const proposal = await loadProposal(supabase, input.id);
  if (proposal.status !== "draft") {
    throw new Error("Only draft proposals can be edited in place");
  }
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of MATERIAL_FIELDS) {
    if (field in input.patch) patch[field] = input.patch[field];
  }
  const { data, error } = await supabase
    .from("proposals")
    .update(patch)
    .eq("id", proposal.id)
    .eq("status", "draft")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("This proposal was already updated. Refresh and try again.");
  await recordAudit(supabase, {
    actorEmail: input.actorEmail,
    action: "proposal.updated",
    entityType: "proposal",
    entityId: proposal.id,
    source: "admin",
    before: proposalAuditSummary(proposal),
    after: proposalAuditSummary(data),
  });
  return data as ProposalRow;
}

export async function reviseProposal(
  supabase: SupabaseClient,
  input: { id: string; actorEmail: string; patch: Record<string, unknown>; source?: string },
): Promise<{ current: ProposalRow; successor: ProposalRow }> {
  const proposal = await loadProposal(supabase, input.id);
  if (proposal.status === "draft") {
    return {
      current: proposal,
      successor: await updateProposalDraft(supabase, input),
    };
  }
  if (isTerminalProposalStatus(proposal.status)) {
    throw new Error("Accepted, declined, expired, or superseded proposals cannot be edited");
  }
  const token = nanoid(16);
  const successorFields = {
    lead_id: proposal.lead_id ?? null,
    opportunity_id: proposal.opportunity_id ?? null,
    contact_id: proposal.contact_id ?? null,
    company_id: proposal.company_id ?? null,
    client_name: input.patch.client_name ?? proposal.client_name,
    title: input.patch.title ?? proposal.title,
    content: input.patch.content ?? proposal.content,
    total_one_time: input.patch.total_one_time ?? proposal.total_one_time,
    total_monthly: input.patch.total_monthly ?? proposal.total_monthly,
    share_token: token,
    status: "draft",
    version: Number(proposal.version || 1) + 1,
    supersedes_id: proposal.id,
    expires_at: proposal.expires_at ?? null,
  };
  const { data: successor, error: insertError } = await supabase
    .from("proposals")
    .insert(successorFields)
    .select("*")
    .single();
  if (insertError) throw new Error(insertError.message);
  const superseded = await commitStatus(supabase, proposal, "superseded", {
    superseded_by: successor.id,
  });
  await writeEvent(supabase, superseded.id, "superseded", input.source ?? "admin", {
    successor_id: successor.id,
    version: successor.version,
  });
  await recordAudit(supabase, {
    actorEmail: input.actorEmail,
    action: "proposal.superseded",
    entityType: "proposal",
    entityId: superseded.id,
    source: "admin",
    before: proposalAuditSummary(proposal),
    after: proposalAuditSummary(superseded),
    metadata: { successor_id: successor.id },
  });
  await recordAudit(supabase, {
    actorEmail: input.actorEmail,
    action: "proposal.created",
    entityType: "proposal",
    entityId: successor.id,
    source: "admin",
    after: proposalAuditSummary(successor),
    metadata: { supersedes_id: proposal.id, version: successor.version },
  });
  return { current: superseded, successor: successor as ProposalRow };
}

export async function applyProposalWrite(
  supabase: SupabaseClient,
  input: { id: string; actorEmail: string; patch: Record<string, unknown> },
): Promise<ProposalRow> {
  const proposal = await loadProposal(supabase, input.id);
  const status = input.patch.status;
  if (status === "sent" && proposal.status === "draft") {
    if (isMaterialProposalChange(proposal, input.patch)) {
      await updateProposalDraft(supabase, input);
    }
    return sendProposal(supabase, { id: input.id, actorEmail: input.actorEmail });
  }
  if (status && status !== proposal.status) {
    if (status === "accepted" || status === "declined") {
      const decided = await decideProposal(supabase, {
        id: input.id,
        decision: status,
        reason: typeof input.patch.decline_reason === "string" ? input.patch.decline_reason : null,
        actorEmail: input.actorEmail,
        source: "admin",
      });
      return decided.proposal;
    }
    throw new Error(`Cannot move a ${proposal.status} proposal to ${String(status)}`);
  }
  if (!isMaterialProposalChange(proposal, input.patch)) return proposal;
  if (proposal.status === "draft") return updateProposalDraft(supabase, input);
  const revised = await reviseProposal(supabase, input);
  return revised.successor;
}
