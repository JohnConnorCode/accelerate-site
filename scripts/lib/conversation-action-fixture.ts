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
