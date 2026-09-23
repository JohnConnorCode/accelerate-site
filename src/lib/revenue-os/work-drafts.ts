import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkItem } from "./work-items";
import type { WorkArtifact } from "./work-result";
import { deferWork, reconcileWork, type WorkResult } from "./work-result";
import { normalizeEmail } from "./db";
import { tenantIdForDatabase } from "@/lib/supabase/server";

export interface WorkDraftProposal {
  id: string;
  action_type: string;
  status: string;
  payload: Record<string, unknown>;
  expires_at: string | null;
  entity_type: string | null;
  entity_id: string | null;
  result: unknown;
}

export function workDraftKey(item: WorkItem): string {
  return `work:${item.id}:draft`;
}

/** Resolve the exact, linked Gmail thread and canonical recipient before staging or execution. */
export async function assertGmailDraftTarget(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
  workItem?: WorkItem,
) {
  const conversationId = typeof payload.conversationId === "string" ? payload.conversationId : "";
  const opportunityId = typeof payload.opportunityId === "string" ? payload.opportunityId : "";
  const contactId = typeof payload.contactId === "string" ? payload.contactId : "";
  const to = normalizeEmail(typeof payload.to === "string" ? payload.to : "");
  const subject = typeof payload.subject === "string" ? payload.subject.trim() : "";
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  const tenantId = workItem?.tenant_id ?? tenantIdForDatabase(supabase);
  if (!tenantId) throw new Error("Gmail draft requires an explicit workspace");
  if (!conversationId || !opportunityId || !contactId || !to || !subject || !body)
    throw new Error(
      "A linked Gmail thread, contact, opportunity, recipient, subject, and body are required",
    );
  if (body.length > 20_000 || subject.length > 500)
    throw new Error("Gmail draft content exceeds the supported limit");
  if (workItem && (workItem.kind !== "draft_followup" || workItem.entity_id !== opportunityId))
    throw new Error("Draft work must match its canonical opportunity");

  const { data: opportunity, error: opportunityError } = await supabase
    .from("opportunities")
    .select("id,contact_id,stage")
    .eq("tenant_id", tenantId)
    .eq("id", opportunityId)
    .maybeSingle();
  if (opportunityError) throw new Error(opportunityError.message);
  if (
    !opportunity ||
    opportunity.contact_id !== contactId ||
    ["won", "lost"].includes(opportunity.stage)
  )
    throw new Error("Gmail draft opportunity/contact is missing, closed, or mismatched");

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id,email,unsubscribed")
    .eq("tenant_id", tenantId)
    .eq("id", contactId)
    .maybeSingle();
  if (contactError) throw new Error(contactError.message);
  if (!contact?.email || normalizeEmail(contact.email) !== to)
    throw new Error("Gmail draft recipient does not match the canonical contact");
  if (contact.unsubscribed)
    throw new Error("Cannot prepare a Gmail draft for an unsubscribed contact");

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id,external_id,subject,contact_id,opportunity_id,channel")
    .eq("tenant_id", tenantId)
    .eq("id", conversationId)
    .maybeSingle();
  if (conversationError) throw new Error(conversationError.message);
  if (
    !conversation ||
    conversation.channel !== "gmail" ||
    !conversation.external_id ||
    conversation.contact_id !== contactId ||
    conversation.opportunity_id !== opportunityId
  )
    throw new Error("Gmail draft thread is not linked to the selected contact and opportunity");

  return { conversation, opportunity, contact, to, subject, body };
}

/** Verify the proposal destination before staging and again before completion. */
export async function assertWorkDraftTarget(
  supabase: SupabaseClient,
  item: WorkItem,
  actionType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (item.kind !== "draft_followup" || item.entity_type !== "opportunity" || !item.entity_id) {
    throw new Error("Draft work must identify its opportunity");
  }
  const { data: opportunity, error } = await supabase
    .from("opportunities")
    .select("id,contact_id,stage")
    .eq("tenant_id", item.tenant_id)
    .eq("id", item.entity_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!opportunity || ["won", "lost"].includes(opportunity.stage))
    throw new Error("Draft opportunity is missing or closed");
  if (typeof payload.body !== "string" || !payload.body.trim())
    throw new Error("Draft body is required");
  if (actionType === "send_email") {
    if (
      payload.opportunityId !== item.entity_id ||
      !opportunity.contact_id ||
      (payload.contactId && payload.contactId !== opportunity.contact_id)
    )
      throw new Error("Draft opportunity/contact mismatch");
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id,email")
      .eq("tenant_id", item.tenant_id)
      .eq("id", opportunity.contact_id)
      .maybeSingle();
    if (contactError) throw new Error(contactError.message);
    if (
      !contact?.email ||
      typeof payload.to !== "string" ||
      payload.to.trim().toLowerCase() !== contact.email.trim().toLowerCase()
    ) {
      throw new Error("Draft recipient does not match the opportunity contact");
    }
    if (typeof payload.subject !== "string" || !payload.subject.trim())
      throw new Error("Draft subject is required");
  } else if (actionType === "create_gmail_draft") {
    await assertGmailDraftTarget(supabase, payload, item);
  } else if (actionType === "send_gmail_reply") {
    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .select("id,opportunity_id,contact_id,channel")
      .eq("tenant_id", item.tenant_id)
      .eq("id", payload.conversationId)
      .maybeSingle();
    if (conversationError) throw new Error(conversationError.message);
    if (
      !conversation ||
      conversation.opportunity_id !== item.entity_id ||
      conversation.channel !== "gmail" ||
      (conversation.contact_id && conversation.contact_id !== opportunity.contact_id)
    ) {
      throw new Error("Draft conversation does not match the opportunity");
    }
  } else throw new Error("Unsupported draft proposal type");
}

export async function findWorkDraftProposal(
  supabase: SupabaseClient,
  item: WorkItem,
  proposalId?: string,
): Promise<WorkDraftProposal | null> {
  let query = supabase
    .from("action_queue")
    .select("*")
    .eq("tenant_id", item.tenant_id)
    .eq("dedupe_key", workDraftKey(item))
    .in("status", ["pending", "approved", "executing", "executed", "failed"]);
  if (proposalId) query = query.eq("id", proposalId);
  const { data: proposals, error } = await query
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);
  for (const proposal of proposals ?? []) {
    if (proposal.payload?.workItemId !== item.id) continue;
    if (proposal.status === "failed") {
      const { data: uncertain, error: uncertainError } = await supabase
        .from("messages")
        .select("id")
        .eq("tenant_id", item.tenant_id)
        .in("status", ["processing", "uncertain"])
        .contains("metadata", { action_id: proposal.id })
        .limit(1);
      if (uncertainError) throw new Error(uncertainError.message);
      if (!uncertain?.length) continue;
    }
    // Executed/approved receipts remain valid after the draft's approval deadline.
    if (
      proposal.status === "pending" &&
      proposal.expires_at &&
      Date.parse(proposal.expires_at) <= Date.now()
    )
      continue;
    await assertWorkDraftTarget(supabase, item, proposal.action_type, proposal.payload ?? {});
    if (
      proposal.action_type === "send_email" &&
      (proposal.entity_type !== "opportunity" || proposal.entity_id !== item.entity_id)
    )
      continue;
    if (
      proposal.action_type === "send_gmail_reply" &&
      (proposal.entity_type !== "conversation" ||
        proposal.entity_id !== proposal.payload.conversationId)
    )
      continue;
    if (
      proposal.action_type === "create_gmail_draft" &&
      (proposal.entity_type !== "conversation" ||
        proposal.entity_id !== proposal.payload.conversationId)
    )
      continue;
    return proposal as WorkDraftProposal;
  }
  return null;
}

export async function findWorkDraft(
  supabase: SupabaseClient,
  item: WorkItem,
  proposalId?: string,
): Promise<WorkArtifact | null> {
  const proposal = await findWorkDraftProposal(supabase, item, proposalId);
  return proposal ? { type: "action", id: proposal.id } : null;
}

export function workDraftResult(proposal: WorkDraftProposal): WorkResult {
  const artifact = { type: "action" as const, id: proposal.id };
  if (proposal.action_type !== "create_gmail_draft")
    return reconcileWork(
      "An older follow-up is staged as a send action. Reject it, then prepare a reviewed Gmail draft before continuing.",
    );
  if (["pending", "approved"].includes(proposal.status))
    return {
      status: "awaiting_approval",
      outcome:
        "Review the exact recipient and message, then approve to save it as an unsent Gmail draft.",
      nextCheckAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      artifacts: [artifact],
    };
  if (proposal.status === "executing")
    return {
      ...deferWork(
        "Gmail is saving the approved draft; verify the provider receipt before retrying.",
      ),
      artifacts: [artifact],
    };
  if (proposal.status === "failed")
    return reconcileWork(
      "The Gmail draft result is uncertain. Check Gmail Drafts and reconcile the action receipt before retrying.",
    );
  if (proposal.status === "executed") {
    const receipt = proposal.result as { status?: unknown; sent?: unknown } | null;
    if (receipt?.status !== "drafted" || receipt.sent !== false)
      return reconcileWork(
        "The action receipt does not confirm an unsent Gmail draft. Reconcile it before continuing.",
      );
    return {
      ...deferWork(
        "Gmail draft saved. Not sent. Review, edit, or send it in Gmail; sync will track the send and reply.",
        new Date(Date.now() + 3 * 24 * 60 * 60_000).toISOString(),
      ),
      artifacts: [artifact],
    };
  }
  return reconcileWork("The follow-up action has an unsupported status; inspect its receipt.");
}
