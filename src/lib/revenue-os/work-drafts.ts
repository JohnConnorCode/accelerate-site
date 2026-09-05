import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkItem } from "./work-items";
import type { WorkArtifact } from "./work-result";

export function workDraftKey(item: WorkItem): string {
  return `work:${item.id}:draft`;
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

export async function findWorkDraft(
  supabase: SupabaseClient,
  item: WorkItem,
  proposalId?: string,
): Promise<WorkArtifact | null> {
  let query = supabase
    .from("action_queue")
    .select("*")
    .eq("tenant_id", item.tenant_id)
    .eq("dedupe_key", workDraftKey(item))
    .in("status", ["pending", "approved", "executing", "executed"]);
  if (proposalId) query = query.eq("id", proposalId);
  const { data: proposals, error } = await query
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);
  for (const proposal of proposals ?? []) {
    if (proposal.payload?.workItemId !== item.id) continue;
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
    return { type: "action", id: proposal.id };
  }
  return null;
}
