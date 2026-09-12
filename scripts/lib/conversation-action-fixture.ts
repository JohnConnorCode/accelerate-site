import { isDeepStrictEqual } from "node:util";
import type { Row } from "./memory-supabase";

/** Transport fixture; native PostgreSQL tests prove authorization and atomic rollback. */
export function conversationActionFixture(rows: (table: string) => Row[], args: Row) {
  const payload = args.p_payload as Row;
  const action = rows("action_queue").find((row) => row.id === args.p_id);
  if (!action) throw new Error("Conversation action unavailable");
  if (action.status === "executed" && !args.p_undo) return structuredClone(action.result);
  const current = rows("conversations").find((row) => row.id === payload.conversationId);
  if (!current) throw new Error("Conversation unavailable");
  const before = structuredClone(current);
  if (args.p_undo) {
    const compensation = action.compensation as Row;
    if (compensation.receipt) return compensation.receipt;
    if (!isDeepStrictEqual(current, compensation.after)) throw new Error("Conversation changed");
    Object.assign(current, compensation.before);
    compensation.receipt = {
      undone: action.action_type,
      detail: { conversation: structuredClone(current) },
    };
    rows("audit_log").push({ action: "action.compensated", entity_id: action.id });
    return compensation.receipt;
  }
  if (!isDeepStrictEqual(current, payload.expectedState))
    throw new Error("Conversation changed since preview");
  let audit: string;
  let activity: string;
  if (args.p_operation === "update_conversation_status") {
    current.status = payload.status;
    if (["resolved", "archived"].includes(String(payload.status))) current.unread_count = 0;
    audit = `conversation.status_${payload.status}`;
    activity = "conversation_status_updated";
  } else if (args.p_operation === "assign_conversation") {
    current.metadata = { ...(current.metadata as Row), assigned_to: payload.assigneeEmail };
    audit = payload.assigneeEmail ? "conversation.assigned" : "conversation.unassigned";
    activity = "conversation_assigned";
  } else {
    const patch = payload.patch as Row;
    if (action.action_type === "identity_review") {
      const decision = (action.payload as Row).approvedDecision as Row;
      if (decision.decision === "link" && patch.contact_id !== decision.contactId)
        throw new Error("Link outside approved decision");
    }
    Object.assign(current, patch);
    for (const [field, value] of Object.entries(patch)) {
      if (!value) continue;
      const claimId = `claim-${rows("claims").length + 1}`;
      rows("claims").push({
        id: claimId,
        entity_type: "conversation",
        entity_id: current.id,
        field,
        proposed_value: value,
        best_evidence: "human_entered",
        status: "verified",
      });
      rows("evidence").push({
        claim_id: claimId,
        source_type: "operator_link",
        strength: "human_entered",
      });
    }
    audit = "conversation.linked_record";
    activity = "conversation_linked";
  }
  current.updated_at = new Date().toISOString();
  rows("audit_log").push({ action: audit, entity_id: current.id, actor_email: args.p_actor });
  rows("activities").push({ activity_type: activity, conversation_id: current.id });
  const result = structuredClone(current);
  if (action.action_type === "identity_review")
    action.result = { conversationEffect: { payload, result } };
  else
    Object.assign(action, {
      status: "executed",
      result,
      reversibility: args.p_operation === "link_conversation_record" ? "compensable" : "reversible",
      compensation: { version: 1, before, after: result },
    });
  return result;
}

/** Human-review transport seam; actual PostgreSQL tests exercise the transaction. */
export function identityReviewActionFixture(rows: (table: string) => Row[], args: Row) {
  const action = rows("action_queue").find((row) => row.id === args.p_id);
  if (!action) throw new Error("Review action unavailable");
  const payload = args.p_payload as Row;
  const decision = payload.approvedDecision as Row;
  const choice = String(decision.decision);
  const conversation = rows("conversations").find((row) => row.id === payload.conversation_id);
  if (!conversation || !isDeepStrictEqual(conversation, payload.conversationState))
    throw new Error("Conversation changed since identity review");
  const email = String(payload.participant_email).trim().toLowerCase();
  let contactId: unknown = null;
  let companyId: unknown = null;
  if (choice === "link") {
    const contact = rows("contacts").find((row) => row.id === decision.contactId);
    const candidates = (payload.candidates as Row[]) ?? [];
    if (
      !contact ||
      (String(contact.primary_email).toLowerCase() !== email &&
        !candidates.some((row) => row.id === contact.id))
    )
      throw new Error("Identity changed after review: chosen contact no longer matches");
    if (conversation.contact_id && conversation.contact_id !== contact.id)
      throw new Error("Conversation was linked elsewhere while under review");
    contactId = contact.id;
    companyId = decision.companyId || contact.company_id || null;
  } else if (choice === "create") {
    if (
      rows("contacts").some((row) =>
        [row.primary_email, ...((row.alternate_emails as unknown[]) ?? [])].some(
          (value) => String(value).toLowerCase() === email,
        ),
      )
    )
      throw new Error(
        "Identity changed after review: this email now belongs to an existing contact",
      );
    companyId = decision.companyId || null;
    if (!companyId && decision.companyName) {
      companyId = `review-company-${action.id}`;
      rows("companies").push({
        id: companyId,
        name: decision.companyName,
        domain: decision.companyDomain,
        source_record_type: "identity_review_company_row",
        source_record_id: action.id,
      });
    }
    contactId = `review-contact-${action.id}`;
    rows("contacts").push({
      id: contactId,
      full_name: decision.fullName,
      primary_email: email,
      phone: decision.phone,
      company_id: companyId,
      source_record_type: "identity_review_row",
      source_record_id: action.id,
    });
    rows("audit_log").push({ action: "contact.created", entity_id: contactId });
  }
  if (choice === "link" || choice === "create")
    conversationActionFixture(rows, {
      p_id: action.id,
      p_operation: "link_conversation_record",
      p_actor: args.p_actor,
      p_payload: {
        conversationId: conversation.id,
        patch: { contact_id: contactId, company_id: companyId },
        expectedState: payload.conversationState,
      },
    });
  if (choice === "no_match") {
    rows("claims").push({
      entity_type: "conversation",
      entity_id: conversation.id,
      field: "identity_review_decision",
      best_evidence: "human_entered",
    });
    rows("evidence").push({ source_type: "operator_review", strength: "human_entered" });
  }
  const result = {
    decision: choice,
    conversation_id: conversation.id,
    contact_id: contactId,
    company_id: companyId,
  };
  rows("activities").push({
    activity_type: choice === "defer" ? "identity_review_deferred" : "identity_review_resolved",
    conversation_id: conversation.id,
  });
  rows("audit_log").push({
    action: choice === "defer" ? "identity_review.deferred" : "identity_review.resolved",
    entity_id: action.id,
  });
  Object.assign(action, {
    result,
    status: choice === "defer" ? "pending" : "executed",
    ...(choice === "defer" ? { approved_by: null, approved_at: null } : {}),
  });
  return result;
}
