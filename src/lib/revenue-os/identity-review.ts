import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit } from "./audit";
import { recordActivity } from "./activities";
import { claimApprovedAction, failAction, finishAction } from "./actions";
import { recordEvidence } from "./claims";
import { linkConversationRecord } from "./conversations";
import { findCanonicalContactByEmail, isPersonalEmailDomain } from "./identity";
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
    .select("id,status,action_type,payload,result")
    .eq("id", actionId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  const row = current;
  assertFound(row, "Review action");
  if (row.action_type !== IDENTITY_REVIEW_ACTION)
    throw new Error(`Action ${actionId} is not an identity review`);
  if (row.status === "executed")
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
  if (row.status !== "pending") throw new Error("This review was already handled");

  const claimed = await claimApprovedAction(supabase, actionId, actorEmail);
  const payload = (claimed.payload as Record<string, unknown> | null) ?? {};
  const conversationId =
    typeof payload.conversation_id === "string" ? (payload.conversation_id as string) : null;
  const participantEmail = normalizeEmail(
    typeof payload.participant_email === "string" ? payload.participant_email : "",
  );
  const storedCandidates = ((payload.candidates as Array<Record<string, unknown>>) ?? [])
    .map((c) => c.id)
    .filter((id): id is string => typeof id === "string");
  if (!conversationId) {
    await failAction(supabase, actionId, "Review payload has no conversation");
    throw new Error("Review payload has no conversation");
  }
  if (!participantEmail) {
    await failAction(supabase, actionId, "Review payload has no participant email");
    throw new Error("Review payload has no participant email");
  }

  try {
    if (input.decision === "defer") {
      await supabase
        .from("action_queue")
        .update({ status: "pending", approved_by: null, approved_at: null })
        .eq("id", actionId)
        .eq("status", "executing");
      await recordAudit(supabase, {
        actorEmail,
        action: "identity_review.deferred",
        entityType: "action_queue",
        entityId: actionId,
        source: "admin",
        metadata: { conversation_id: conversationId, participant_email: participantEmail },
      });
      await recordActivity(supabase, {
        activityType: "identity_review_deferred",
        title: `Identity review deferred: ${participantEmail}`,
        summary: "Founder deferred the identity decision; the item stays in the review queue.",
        conversationId,
        actorEmail,
        source: "operator",
        externalId: `identity_defer:${actionId}:${Date.now()}`,
      });
      return {
        contract: IDENTITY_REVIEW_CONTRACT,
        actionId,
        decision: "defer",
        replayed: false,
        contactId: null,
        companyId: null,
      };
    }

    if (input.decision === "no_match") {
      const result = {
        decision: "no_match",
        conversation_id: conversationId,
        contact_id: null,
        company_id: null,
      };
      await recordEvidence(supabase, {
        entityType: "conversation",
        entityId: conversationId,
        field: "identity_review_decision",
        proposedValue: actionId,
        sourceType: "operator_review",
        observation: `Founder decided ${participantEmail} matches no canonical record`,
        strength: "human_entered",
        provenance: { conversation_id: conversationId, action_id: actionId },
        actorEmail,
      });
      await recordAudit(supabase, {
        actorEmail,
        action: "identity_review.resolved",
        entityType: "action_queue",
        entityId: actionId,
        source: "admin",
        after: result,
      });
      await recordActivity(supabase, {
        activityType: "identity_review_resolved",
        title: `Identity review resolved without a match: ${participantEmail}`,
        summary: "Founder confirmed no canonical record; the conversation stays unlinked.",
        conversationId,
        actorEmail,
        source: "operator",
        externalId: `identity_no_match:${actionId}`,
      });
      await finishAction(supabase, actionId, result);
      return {
        contract: IDENTITY_REVIEW_CONTRACT,
        actionId,
        decision: "no_match",
        replayed: false,
        contactId: null,
        companyId: null,
      };
    }

    if (input.decision === "link") {
      const contactId = input.contactId?.trim();
      if (!contactId) throw new Error("Link requires a canonical contact id");
      const { data: contact, error: contactError } = await supabase
        .from("contacts")
        .select("id,full_name,primary_email,company_id")
        .eq("id", contactId)
        .maybeSingle();
      if (contactError) throw new Error(contactError.message);
      assertFound(contact, "Chosen contact");
      const stillMatches =
        normalizeEmail(contact.primary_email) === participantEmail ||
        storedCandidates.includes(contact.id);
      if (!stillMatches)
        throw new Error(
          "Identity changed after review: the chosen contact no longer matches this item",
        );
      let companyId: string | null = null;
      if (input.companyId?.trim()) {
        const { data: company, error: companyError } = await supabase
          .from("companies")
          .select("id")
          .eq("id", input.companyId.trim())
          .maybeSingle();
        if (companyError) throw new Error(companyError.message);
        assertFound(company, "Chosen company");
        companyId = company.id as string;
      } else {
        companyId = (contact.company_id as string) ?? null;
      }
      const { data: conv, error: convError } = await supabase
        .from("conversations")
        .select("id,contact_id")
        .eq("id", conversationId)
        .maybeSingle();
      if (convError) throw new Error(convError.message);
      assertFound(conv, "Conversation");
      if (conv.contact_id && conv.contact_id !== contactId)
        throw new Error(
          "Conversation was linked elsewhere while under review; re-review before linking",
        );
      await linkConversationRecord(supabase, {
        conversationId,
        contactId,
        companyId,
        actorEmail,
      });
      const result = {
        decision: "link",
        conversation_id: conversationId,
        contact_id: contactId,
        company_id: companyId,
      };
      await recordAudit(supabase, {
        actorEmail,
        action: "identity_review.resolved",
        entityType: "action_queue",
        entityId: actionId,
        source: "admin",
        after: result,
      });
      await recordActivity(supabase, {
        activityType: "identity_review_resolved",
        title: `Identity review linked ${participantEmail}`,
        summary: `Founder linked the participant to ${contact.full_name}.`,
        contactId,
        companyId,
        conversationId,
        actorEmail,
        source: "operator",
        externalId: `identity_link:${actionId}`,
      });
      await finishAction(supabase, actionId, result);
      return {
        contract: IDENTITY_REVIEW_CONTRACT,
        actionId,
        decision: "link",
        replayed: false,
        contactId,
        companyId,
      };
    }

    // create: the founder confirms this participant is a new person.
    const fullName = input.fullName?.trim();
    if (!fullName) throw new Error("Create requires the contact's full name");
    const existing = await findCanonicalContactByEmail(supabase, participantEmail);
    if (existing)
      throw new Error(
        "Identity changed after review: this email now belongs to an existing contact",
      );
    let companyId: string | null = null;
    if (input.companyId?.trim()) {
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("id")
        .eq("id", input.companyId.trim())
        .maybeSingle();
      if (companyError) throw new Error(companyError.message);
      assertFound(company, "Chosen company");
      companyId = company.id as string;
    } else if (input.companyName?.trim()) {
      const domain = domainFromEmailOrWebsite(participantEmail, null);
      if (isPersonalEmailDomain(domain))
        throw new Error(
          "A personal email address cannot seed a company; create the contact without one",
        );
      const { data: created, error: createError } = await supabase
        .from("companies")
        .insert({
          name: input.companyName.trim(),
          domain,
          source: "identity_review",
          source_record_type: "identity_review_company_row",
          source_record_id: actionId,
        })
        .select("id")
        .single();
      if (createError) throw new Error(createError.message);
      companyId = created.id as string;
    }
    const replay = await supabase
      .from("contacts")
      .select("id,company_id")
      .eq("source_record_type", "identity_review_row")
      .eq("source_record_id", actionId)
      .maybeSingle();
    if (replay.error) throw new Error(replay.error.message);
    let contactId: string;
    if (replay.data) {
      contactId = replay.data.id as string;
      companyId = (replay.data.company_id as string) ?? companyId;
    } else {
      const names = fullName.split(/\s+/);
      const { data: created, error: createError } = await supabase
        .from("contacts")
        .insert({
          first_name: names[0] || null,
          last_name: names.length > 1 ? names.slice(1).join(" ") : null,
          full_name: fullName,
          primary_email: participantEmail,
          phone: input.phone?.trim() || null,
          company_id: companyId,
          source: "identity_review",
          source_record_type: "identity_review_row",
          source_record_id: actionId,
        })
        .select("id")
        .single();
      if (createError) throw new Error(createError.message);
      contactId = created.id as string;
      await recordAudit(supabase, {
        actorEmail,
        action: "contact.created",
        entityType: "contact",
        entityId: contactId,
        source: "admin",
        after: { company_id: companyId, review_action_id: actionId },
      });
    }
    await linkConversationRecord(supabase, {
      conversationId,
      contactId,
      companyId,
      actorEmail,
    });
    const result = {
      decision: "create",
      conversation_id: conversationId,
      contact_id: contactId,
      company_id: companyId,
    };
    await recordAudit(supabase, {
      actorEmail,
      action: "identity_review.resolved",
      entityType: "action_queue",
      entityId: actionId,
      source: "admin",
      after: result,
    });
    await recordActivity(supabase, {
      activityType: "identity_review_resolved",
      title: `Identity review created ${fullName}`,
      summary: `Founder confirmed ${participantEmail} is a new contact and linked the conversation.`,
      contactId,
      companyId,
      conversationId,
      actorEmail,
      source: "operator",
      externalId: `identity_create:${actionId}`,
    });
    await finishAction(supabase, actionId, result);
    return {
      contract: IDENTITY_REVIEW_CONTRACT,
      actionId,
      decision: "create",
      replayed: false,
      contactId,
      companyId,
    };
  } catch (error) {
    await failAction(
      supabase,
      actionId,
      error instanceof Error ? error.message : "Resolution failed",
    );
    throw error;
  }
}
