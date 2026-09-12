import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { callProposalHostRpc, tenantIdForDatabase } from "@/lib/supabase/server";
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

const MATERIAL_FIELDS = [
  "title",
  "content",
  "total_one_time",
  "total_monthly",
  "client_name",
] as const;

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
  decline_reason?: string | null;
  client_name?: string;
  title?: string;
};

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(300).optional(),
    client_name: z.string().trim().min(1).max(300).optional(),
    content: z.record(z.string(), z.unknown()).optional(),
    total_one_time: z.number().finite().min(0).max(1e9).optional(),
    total_monthly: z.number().finite().min(0).max(1e9).optional(),
  })
  .strict();
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
async function loadProposal(db: SupabaseClient, id: string): Promise<ProposalRow> {
  z.uuid().parse(id);
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("Proposal workspace required");
  const { data, error } = await db
    .from("proposals")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Proposal not found");
  return data as ProposalRow;
}
async function command(
  db: SupabaseClient,
  input: {
    id: string;
    operation: string;
    actorEmail: string;
    source?: string;
    patch?: Record<string, unknown>;
    reason?: string | null;
    expectedUpdatedAt?: unknown;
  },
) {
  const patch = patchSchema.parse(input.patch ?? {});
  const value = {
    id: z.uuid().parse(input.id),
    operation: input.operation,
    source: input.source ?? "admin",
    patch,
    reason: input.reason?.trim() ?? null,
    expectedUpdatedAt: input.expectedUpdatedAt ?? null,
  };
  if (JSON.stringify(value).length > 90000) throw new Error("Proposal command is too large");
  const identity = {
    ...value,
    expectedUpdatedAt: input.operation === "edit" ? value.expectedUpdatedAt : null,
  };
  const key = createHash("sha256")
    .update(JSON.stringify(canonical(identity)))
    .digest("hex");
  const { data, error } = await callProposalHostRpc(db, {
    p_key: key,
    p_command: value,
    p_actor_email: z.string().trim().min(1).max(320).parse(input.actorEmail),
  });
  if (error) throw new Error(error.message);
  return data as {
    proposal: ProposalRow;
    successor: ProposalRow | null;
    changed: boolean;
    replayed: boolean;
  };
}
export async function sendProposal(
  db: SupabaseClient,
  input: { id: string; actorEmail: string; source?: string },
): Promise<ProposalRow> {
  return (await command(db, { ...input, operation: "send" })).proposal;
}
async function expireIfDue(db: SupabaseClient, p: ProposalRow, source: string) {
  if (
    p.expires_at &&
    Date.parse(p.expires_at) <= Date.now() &&
    ["sent", "viewed"].includes(p.status)
  )
    return (
      await command(db, {
        id: p.id,
        operation: "expire",
        actorEmail: "system:proposal-expiry",
        source,
      })
    ).proposal;
  return p;
}
export async function recordProposalView(
  db: SupabaseClient,
  input: { id: string; source?: string },
) {
  const p = await expireIfDue(db, await loadProposal(db, input.id), input.source ?? "public_link");
  if (p.status === "draft") throw new Error("Draft proposal is not shared");
  const r = await command(db, { ...input, operation: "view", actorEmail: "public_link" });
  return { proposal: r.proposal, alreadyViewed: r.replayed || !r.changed };
}
/** Public explanations are optional, bounded plain text; no customer reason is invented. */
export function normalizeProposalReason(value: unknown): string | null {
  const reason = z.string().max(1000).nullish().parse(value);
  return reason?.replaceAll(/\p{Cc}/gu, " ").trim() || null;
}

/** The transaction records the decision first. Canonical activity/task/pipeline
 * follow-up is separately idempotent and reruns on receipt replay after interruption. */
export async function decideProposal(
  db: SupabaseClient,
  input: {
    id: string;
    decision: "accepted" | "declined";
    reason?: string | null;
    actorEmail: string;
    source?: string;
  },
) {
  const decision = z.enum(["accepted", "declined"]).parse(input.decision);
  const source = input.source ?? "public_link";
  const reason = normalizeProposalReason(input.reason);
  if (decision === "declined" && source !== "public_link")
    z.string().min(1).max(1000).parse(reason);
  const before = await loadProposal(db, input.id);
  const statusBeforeExpiryCheck = before.status;
  const afterExpiryCheck = await expireIfDue(db, before, source);
  // Distinguish "this request is the one that just retired the link" from
  // "it was already expired" so callers on the public link can surface a
  // specific, actionable refusal (410) instead of the generic terminal-state
  // conflict a decision on an already-settled link gets. Read the status
  // before expireIfDue runs into a local, not off `before` afterward - some
  // callers hand back the same row reference they mutated.
  if (
    ["sent", "viewed"].includes(statusBeforeExpiryCheck) &&
    afterExpiryCheck.status === "expired"
  ) {
    throw new Error("Proposal is no longer open for a response; it just expired");
  }
  const r = await command(db, {
    ...input,
    source,
    operation: decision === "accepted" ? "accept" : "decline",
    reason,
  });
  const p = r.proposal,
    at = String(p.responded_at);
  const recordedReason = decision === "declined" ? (p.decline_reason ?? null) : reason;
  await recordActivity(db, {
    activityType: `proposal_${decision}`,
    title: `${p.client_name} ${decision} ${p.title}`,
    summary: recordedReason,
    opportunityId: p.opportunity_id ?? null,
    proposalId: p.id,
    source,
    actorEmail: input.actorEmail,
    externalId: `proposal:${p.id}:decision:${decision}`,
    occurredAt: at,
  });
  await createRevenueTask(db, {
    title: `${decision === "accepted" ? "Start next steps with" : "Review decline from"} ${p.client_name}`,
    description: recordedReason ?? `Proposal ${decision}. Follow up personally.`,
    dueDate: new Date(Date.parse(at) + 86400000).toISOString().slice(0, 10),
    priority: "high",
    relatedType: "proposal",
    relatedId: p.id,
    relatedName: p.client_name ?? "",
    opportunityId: p.opportunity_id ?? null,
    source: "proposal_response",
    dedupeKey: `proposal-response:${p.id}`,
    actorEmail: input.actorEmail,
  });
  await syncOpportunity(db, p, decision, recordedReason, input.actorEmail, source);
  return { proposal: p, alreadyResponded: r.replayed || !r.changed };
}
export async function updateProposalDraft(
  db: SupabaseClient,
  input: { id: string; actorEmail: string; patch: Record<string, unknown> },
) {
  const p = await loadProposal(db, input.id);
  return (await command(db, { ...input, operation: "edit", expectedUpdatedAt: p.updated_at }))
    .proposal;
}
export async function reviseProposal(
  db: SupabaseClient,
  input: { id: string; actorEmail: string; patch: Record<string, unknown>; source?: string },
) {
  const p = await loadProposal(db, input.id);
  if (p.status === "draft") return { current: p, successor: await updateProposalDraft(db, input) };
  const r = await command(db, { ...input, operation: "revise", expectedUpdatedAt: p.updated_at });
  if (!r.successor) throw new Error("Revision receipt has no successor");
  return { current: r.proposal, successor: r.successor };
}
export async function applyProposalWrite(
  db: SupabaseClient,
  input: { id: string; actorEmail: string; patch: Record<string, unknown> },
) {
  const p = await loadProposal(db, input.id),
    status = input.patch.status;
  const patch = Object.fromEntries(
    Object.entries(input.patch).filter(([key]) =>
      (MATERIAL_FIELDS as readonly string[]).includes(key),
    ),
  );
  if (status === "sent" && p.status === "draft") {
    if (isMaterialProposalChange(p, patch)) await updateProposalDraft(db, { ...input, patch });
    return sendProposal(db, input);
  }
  if (status && status !== p.status) {
    if (status === "accepted" || status === "declined")
      return (
        await decideProposal(db, {
          ...input,
          decision: status,
          reason:
            typeof input.patch.decline_reason === "string" ? input.patch.decline_reason : null,
          source: "admin",
        })
      ).proposal;
    throw new Error(`Cannot move a ${p.status} proposal to ${String(status)}`);
  }
  if (!isMaterialProposalChange(p, patch)) return p;
  if (p.status === "draft") return updateProposalDraft(db, { ...input, patch });
  return (await reviseProposal(db, { ...input, patch })).successor;
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
  const { data: opportunity, error } = await supabase
    .from("opportunities")
    .select("stage")
    .eq("id", proposal.opportunity_id)
    .maybeSingle();
  if (error) throw new Error("Proposal pipeline follow-up unavailable; retry the same response");
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
    lossReason:
      decision === "declined" ? reason || `Proposal declined (${proposal.id})` : undefined,
  });
}
