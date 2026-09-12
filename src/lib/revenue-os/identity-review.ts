import "server-only";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { claimApprovedAction, failAction } from "./actions";
import { isPersonalEmailDomain } from "./identity";
import { domainFromEmailOrWebsite, normalizeEmail } from "./db";

export const IDENTITY_REVIEW_CONTRACT = "revenue-os-identity-review.v1";

/** The only decisions the workbench can make. Merge and delete have no path. */
export type IdentityReviewDecision = "link" | "create" | "no_match" | "defer";

export interface IdentityReviewCandidate {
  id: string;
  full_name: string;
  primary_email: string | null;
  company_id: string | null;
  company_name: string | null;
}

export interface IdentityReviewEvidence {
  strength: string | null;
  observation: string;
  source: string;
}

export interface IdentityReviewItem {
  contract: typeof IDENTITY_REVIEW_CONTRACT;
  actionId: string;
  participantEmail: string;
  reason: "ambiguous" | "unknown";
  source: string;
  conversationId: string | null;
  threadId: string | null;
  createdAt: string;
  candidates: IdentityReviewCandidate[];
  evidence: IdentityReviewEvidence[];
  downstream: {
    conversationSubject: string | null;
    conversationStatus: string | null;
    contactId: string | null;
    companyId: string | null;
    opportunityId: string | null;
  };
}

const IDENTITY_REVIEW_ACTION = "identity_review";

function assertFound<T>(value: T | null | undefined, label: string): asserts value is T {
  if (!value) throw new Error(`${label} not found`);
}

/**
 * Bounded founder read model over unresolved identity work. Today the only
 * producer is Gmail association, but the shape is source-agnostic: every item
 * carries its source, its candidates, its evidence, and the downstream record
 * held for review. No raw provider payloads, no message bodies.
 */
export async function listIdentityReviewItems(
  supabase: SupabaseClient,
  input: { limit?: number } = {},
): Promise<{ contract: typeof IDENTITY_REVIEW_CONTRACT; items: IdentityReviewItem[] }> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const { data: actions, error } = await supabase
    .from("action_queue")
    .select("id,payload,source_context,entity_type,entity_id,created_at")
    .eq("action_type", IDENTITY_REVIEW_ACTION)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  const conversationIds = [
    ...new Set(
      ((actions ?? []) as Array<Record<string, unknown>>)
        .map(
          (a) => ((a.payload as Record<string, unknown> | null)?.conversation_id as string) ?? null,
        )
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
  const { data: conversations, error: convError } = conversationIds.length
    ? await supabase
        .from("conversations")
        .select("id,subject,status,contact_id,company_id,opportunity_id")
        .in("id", conversationIds)
    : { data: [], error: null };
  if (convError) throw new Error(convError.message);
  const convMap = new Map(
    ((conversations ?? []) as Array<Record<string, unknown>>).map((c) => [c.id as string, c]),
  );

  const candidateIds = [
    ...new Set(
      ((actions ?? []) as Array<Record<string, unknown>>).flatMap((a) => {
        const raw =
          ((a.payload as Record<string, unknown> | null)?.candidates as Array<
            Record<string, unknown>
          >) ?? [];
        return raw.map((c) => c.id).filter((id): id is string => typeof id === "string");
      }),
    ),
  ];
  const { data: candidateContacts, error: candError } = candidateIds.length
    ? await supabase
        .from("contacts")
        .select("id,full_name,primary_email,company_id")
        .in("id", candidateIds)
    : { data: [], error: null };
  if (candError) throw new Error(candError.message);
  const contactMap = new Map(
    ((candidateContacts ?? []) as Array<Record<string, unknown>>).map((c) => [c.id as string, c]),
  );
  const companyIds = [
    ...new Set(
      [...contactMap.values()]
        .map((c) => c.company_id as string | null)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
  const { data: companies, error: coError } = companyIds.length
    ? await supabase.from("companies").select("id,name").in("id", companyIds)
    : { data: [], error: null };
  if (coError) throw new Error(coError.message);
  const companyMap = new Map(
    ((companies ?? []) as Array<Record<string, unknown>>).map((c) => [c.id as string, c]),
  );

  const items: IdentityReviewItem[] = [];
  for (const action of (actions ?? []) as Array<Record<string, unknown>>) {
    const payload = (action.payload as Record<string, unknown> | null) ?? {};
    const conversationId =
      typeof payload.conversation_id === "string" ? payload.conversation_id : null;
    const conv = conversationId ? convMap.get(conversationId) : undefined;
    const rawCandidates = (payload.candidates as Array<Record<string, unknown>>) ?? [];
    const candidates: IdentityReviewCandidate[] = rawCandidates
      .filter((c) => typeof c.id === "string")
      .map((c) => {
        const fresh = contactMap.get(c.id as string);
        const freshCompanyId =
          fresh && typeof fresh.company_id === "string" ? fresh.company_id : null;
        return {
          id: c.id as string,
          full_name: String(fresh?.full_name ?? c.full_name ?? ""),
          primary_email: (fresh?.primary_email as string) ?? (c.primary_email as string) ?? null,
          company_id: freshCompanyId,
          company_name: freshCompanyId ? String(companyMap.get(freshCompanyId)?.name ?? "") : "",
        };
      });

    let evidence: IdentityReviewEvidence[] = [];
    if (conversationId) {
      const { data: claims } = await supabase
        .from("claims")
        .select("id,best_evidence")
        .eq("entity_type", "conversation")
        .eq("entity_id", conversationId);
      const claimIds = ((claims ?? []) as Array<Record<string, unknown>>).map(
        (c) => c.id as string,
      );
      if (claimIds.length) {
        const { data: rows } = await supabase
          .from("evidence")
          .select("strength,observation,source_type,claim_id")
          .in("claim_id", claimIds)
          .order("created_at", { ascending: true })
          .limit(20);
        evidence = ((rows ?? []) as Array<Record<string, unknown>>).map((r) => ({
          strength: (r.strength as string) ?? null,
          observation: String(r.observation ?? ""),
          source: String(r.source_type ?? ""),
        }));
      }
    }

    items.push({
      contract: IDENTITY_REVIEW_CONTRACT,
      actionId: action.id as string,
      participantEmail: String(payload.participant_email ?? ""),
      reason: payload.reason === "ambiguous" ? "ambiguous" : "unknown",
      source: String(action.source_context ?? "gmail_record_association"),
      conversationId,
      threadId: typeof payload.thread_id === "string" ? (payload.thread_id as string) : null,
      createdAt: String(action.created_at ?? ""),
      candidates,
      evidence,
      downstream: {
        conversationSubject: (conv?.subject as string) ?? null,
        conversationStatus: (conv?.status as string) ?? null,
        contactId: (conv?.contact_id as string) ?? null,
        companyId: (conv?.company_id as string) ?? null,
        opportunityId: (conv?.opportunity_id as string) ?? null,
      },
    });
  }
  return { contract: IDENTITY_REVIEW_CONTRACT, items };
}

export interface ResolveIdentityReviewInput {
  actionId: string;
  decision: IdentityReviewDecision;
  /** link: canonical contact id. create: existing canonical company id (optional). */
  contactId?: string | null;
  companyId?: string | null;
  /** create: founder-supplied fields. */
  fullName?: string | null;
  phone?: string | null;
  companyName?: string | null;
  actorEmail: string;
}

export interface ResolveIdentityReviewResult {
  contract: typeof IDENTITY_REVIEW_CONTRACT;
  actionId: string;
  decision: IdentityReviewDecision;
  replayed: boolean;
  contactId: string | null;
  companyId: string | null;
}

/**
 * Apply one founder identity decision. Concurrency is owned by the action
 * claim: exactly one resolver wins, everyone else gets "already handled",
 * and an already-executed action replays its stored result instead of
 * writing twice. AI can never enter here: there is no registered executor
 * path, only this founder-called service.
 */
export async function resolveIdentityReview(
  supabase: SupabaseClient,
  input: ResolveIdentityReviewInput,
): Promise<ResolveIdentityReviewResult> {
  const actionId = input.actionId.trim();
  if (!actionId) throw new Error("Action id is required");
  if (!["link", "create", "no_match", "defer"].includes(input.decision))
    throw new Error(`Unknown identity decision "${input.decision}"`);
  const actorEmail = input.actorEmail.trim();
  if (!actorEmail) throw new Error("Actor email is required");

  const { data: current, error: readError } = await supabase
    .from("action_queue")
    .select("id,status,action_type,payload,result,approved_by")
    .eq("id", actionId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  const row = current;
  assertFound(row, "Review action");
  if (row.action_type !== IDENTITY_REVIEW_ACTION)
    throw new Error(`Action ${actionId} is not an identity review`);
  if (
    row.status === "executed" ||
    (row.status === "pending" &&
      input.decision === "defer" &&
      (row.result as Record<string, unknown> | null)?.decision === "defer")
  )
    return {
      contract: IDENTITY_REVIEW_CONTRACT,
      actionId,
      decision:
        ((row.result as Record<string, unknown> | null)?.decision as IdentityReviewDecision) ??
        "no_match",
      replayed: true,
      contactId: ((row.result as Record<string, unknown> | null)?.contact_id as string) ?? null,
      companyId: ((row.result as Record<string, unknown> | null)?.company_id as string) ?? null,
    };
  if (!["pending", "executing", "failed"].includes(row.status))
    throw new Error("This review was already handled");

  if (input.decision === "link" && !input.contactId?.trim())
    throw new Error("Link requires a canonical contact id");
  if (input.decision === "create" && !input.fullName?.trim())
    throw new Error("Create requires the contact's full name");
  const expectedPayload = (row.payload as Record<string, unknown> | null) ?? {};
  const participantEmail = normalizeEmail(
    typeof expectedPayload.participant_email === "string" ? expectedPayload.participant_email : "",
  );
  if (!participantEmail) throw new Error("Review payload has no participant email");
  const companyDomain = domainFromEmailOrWebsite(participantEmail, null);
  const decision = {
    decision: input.decision,
    contactId: input.contactId?.trim() || null,
    companyId: input.companyId?.trim() || null,
    fullName: input.fullName?.trim() || null,
    phone: input.phone?.trim() || null,
    companyName: input.companyName?.trim() || null,
    companyDomain,
  };
  let claimedPayload = expectedPayload;
  if (row.status === "pending") {
    const { data: conversationState, error: conversationError } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", expectedPayload.conversation_id)
      .maybeSingle();
    if (conversationError || !conversationState)
      throw new Error("Review conversation is unavailable");
    const claimed = await claimApprovedAction(supabase, actionId, actorEmail, "approved", {
      expectedPayload,
      conversationState,
      decision,
    });
    claimedPayload = claimed.payload;
  } else {
    const approved = expectedPayload.approvedDecision as Record<string, unknown> | undefined;
    if (
      row.approved_by !== actorEmail ||
      !approved ||
      Object.entries(decision).some(([key, value]) => approved[key] !== value)
    )
      throw new Error(
        "This review was already handled; retry requires the same approved decision and actor",
      );
  }
  try {
    if (
      input.decision === "create" &&
      !input.companyId?.trim() &&
      input.companyName?.trim() &&
      isPersonalEmailDomain(companyDomain)
    )
      throw new Error(
        "A personal email address cannot seed a company; create the contact without one",
      );

    const { data, error } = await supabase.rpc("apply_identity_review_action", {
      p_id: actionId,
      p_payload: claimedPayload,
      p_actor: actorEmail,
    });
    if (error) throw new Error(error.message);
    const result = data as {
      decision: IdentityReviewDecision;
      contact_id: string | null;
      company_id: string | null;
    };
    return {
      contract: IDENTITY_REVIEW_CONTRACT,
      actionId,
      decision: result.decision,
      replayed: false,
      contactId: result.contact_id,
      companyId: result.company_id,
    };
  } catch (error) {
    if (row.status !== "failed")
      await failAction(
        supabase,
        actionId,
        error instanceof Error ? error.message : "Resolution failed",
      );
    throw error;
  }
}

/** Conservative bounded unresolved-identity check for canonical relationship reads. */
export async function readContactIdentityReviewState(
  supabase: SupabaseClient,
  contactIds: string[],
) {
  const tenantId = tenantIdForDatabase(supabase);
  const ids = [...new Set(contactIds)];
  if (!tenantId || ids.length > 50) throw new Error("Bounded tenant contact context required");
  const read = await supabase
    .from("action_queue")
    .select("id,payload")
    .eq("tenant_id", tenantId)
    .eq("action_type", IDENTITY_REVIEW_ACTION)
    .eq("status", "pending")
    .order("created_at")
    .order("id")
    .limit(201);
  if (read.error) throw new Error("Identity review context unavailable");
  const records = ids.length
    ? await supabase
        .from("contacts")
        .select("id,primary_email,alternate_emails")
        .eq("tenant_id", tenantId)
        .in("id", ids)
        .limit(50)
    : { data: [], error: null };
  if (records.error) throw new Error("Canonical identity context unavailable");
  const pending = new Set<string>();
  for (const row of read.data ?? []) {
    const payload = row.payload as Record<string, unknown> | null;
    const email = normalizeEmail(
      typeof payload?.participant_email === "string" ? payload.participant_email : null,
    );
    if (email)
      for (const contact of records.data ?? []) {
        if (
          [contact.primary_email, ...(contact.alternate_emails ?? [])].some(
            (value) => normalizeEmail(value) === email,
          )
        )
          pending.add(contact.id);
      }
    const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
    for (const candidate of candidates) {
      if (candidate && typeof candidate === "object" && ids.includes(candidate.id))
        pending.add(candidate.id);
    }
  }
  return { pendingContactIds: [...pending], complete: (read.data?.length ?? 0) <= 200 };
}
