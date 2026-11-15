import { billingApprovalSchema } from "@/lib/revenue-os/billing-command-contract";
import { contentCalendarCommandApprovalSchema } from "@/lib/revenue-os/content-calendar-contract";
import { ticketAdminCommandSchema } from "@/lib/revenue-os/event-ticketing-contract";

/**
 * One approval-queue row and how every surface presents it. The review dialog,
 * the approval card (Work list, phone feed, canvas, Command Board) and their
 * tests read the same kind, consequence and state, so a proposal never says
 * one thing in a card and another in its review.
 */
export interface ActionRow {
  id: string;
  action_type: string;
  title: string;
  description: string | null;
  urgency: string;
  reasoning: string | null;
  status: string;
  created_at: string;
  expires_at: string | null;
  payload: Record<string, unknown> | null;
  evidence?: Record<string, unknown> | null;
  /** Triage receipt recorded when this proposal passed the operator-queue gate. */
  triage?: Record<string, unknown> | null;
}

/**
 * What each action will actually do if approved, in plain language. Approving is
 * irreversible for external actions, so the operator is told the consequence
 * before the button, not after.
 */
const ACTION_CONSEQUENCE: Record<string, string> = {
  event_ticketing_change:
    "Applies the exact event operation below. Publishing opens ticket sales. Existing orders keep their agreed price and terms. Payment history remains unchanged.",
  content_calendar_change:
    "Applies only the exact calendar command below after checking current records and statuses. Delete permanently removes the calendar item. Website pages and approval history remain; no website content is published.",
  update_content_calendar_item:
    "Saves these editorial values after checking the item revision. A calendar status or date does not publish a website page.",
  update_collection_policy:
    "Updates this collection case and its follow-up work after rechecking current invoice and recipient facts. No reminder is sent and no invoice is changed.",
  command_board_change:
    "Saves the exact Command Board shown below at its current revision. Business records are unchanged and nothing is sent.",
  today_view_change:
    "Saves the exact Today arrangement and preferences shown below. Business records are unchanged. Only the proposing member can approve it.",
  send_email: "Sends this email immediately. It cannot be recalled.",
  send_gmail_reply: "Sends this reply from your Gmail account immediately. It cannot be recalled.",
  create_debate_invitation:
    "Sends one Google Calendar invitation to both named participants immediately. They will be notified. The event is read back and recorded before success is claimed.",
  create_gmail_draft:
    "Saves this exact reply as an editable Gmail draft. It is not sent. You can review, edit, or send it in Gmail Drafts.",
  activate_campaign:
    "Starts this campaign. Enrolled contacts begin receiving email on the next run.",
  duplicate_campaign:
    "Creates a new draft copy of this campaign with no members enrolled. Nothing sends until the copy is enrolled and activated.",
  bulk_tag_contacts: "Adds or removes tags on the selected contacts. No email sends.",
  bulk_suppress_contacts:
    "Stops all pending campaign email to the selected contacts and marks them suppressed. Suppression cannot be undone automatically.",
  bulk_enroll_contacts:
    "Stages the selected contacts as queued members of a draft campaign. Nothing sends until the campaign is activated.",
  transition_opportunity:
    "Moves this opportunity to a new stage and records an immutable stage event.",
  create_task: "Creates a task on your queue.",
  update_next_action: "Changes the next step recorded on this opportunity.",
  internal_permission_change:
    "Replaces the previous workspace permission for this operation with permission for the requesting member on only the records, fields, expiry and daily limit shown below. Only that member can approve it. Messages, publishing, billing and permission changes keep human approval.",
  admin_layout_change:
    "Reorders or hides an admin layout region immediately. Revert it any time from Settings → Layout.",
  create_founder_note:
    "Saves this note to the timeline immediately, visible wherever this record is reviewed. Notes are permanent: there is no edit or delete once saved.",
};

/** Actions whose effect leaves the workspace and cannot be recalled. */
const EXTERNAL_ACTIONS = new Set([
  "billing_change",
  "send_email",
  "send_gmail_reply",
  "create_debate_invitation",
  "activate_campaign",
]);

export function approvalKind(action: Pick<ActionRow, "action_type">) {
  const external = EXTERNAL_ACTIONS.has(action.action_type);
  const label =
    action.action_type === "create_gmail_draft"
      ? "Gmail Draft"
      : external
        ? "External Action"
        : action.action_type === "workspace_configuration_change"
          ? "Configuration"
          : "Internal Mutation";
  return { external, label };
}

/** The operation name shown under a proposal's title. */
export function approvalTypeLabel(action: Pick<ActionRow, "action_type">) {
  return action.action_type === "content_calendar_change"
    ? "Editorial calendar"
    : action.action_type.replace(/_/g, " ");
}

/** The exact consequence of approving, from the payload when it states one. */
export function approvalConsequence(action: Pick<ActionRow, "action_type" | "payload">): string {
  const { action_type: type, payload } = action;
  const blueprint =
    type === "blueprint_draft_change"
      ? (payload?.review as Record<string, unknown> | undefined)?.Consequence
      : null;
  if (typeof blueprint === "string") return blueprint;
  if (type === "billing_change") {
    const billing = billingApprovalSchema.safeParse(payload);
    if (billing.success) return billing.data.review.Consequence;
  }
  if (type === "event_ticketing_change") {
    const ticket = ticketAdminCommandSchema.safeParse(payload);
    if (ticket.success)
      return ticket.data.operation === "save_event"
        ? ticket.data.event.status === "published"
          ? "Saves these event settings and opens ticket sales. Existing orders retain their agreed price and refund terms."
          : "Saves these event settings. New checkouts follow the saved sales status; existing orders retain their agreed price and terms."
        : ticket.data.operation === "reconcile"
          ? "Checks expired reservations against Stripe. Places are released only when the provider confirms expiry or the complete receipt lookup proves checkout was never created."
          : "Checks the existing email receipt and retries an eligible failed confirmation using its original provider key. Paid admission remains recorded.";
  }
  if (type === "workspace_configuration_change" && typeof payload?.consequences === "string")
    return payload.consequences;
  if (type === "content_calendar_change") {
    const calendar = contentCalendarCommandApprovalSchema.safeParse(payload);
    if (calendar.success)
      return calendar.data.command.operation === "delete"
        ? "Permanently deletes the named calendar item after checking its current state. Approval history and audit receipts remain. Website pages stay live."
        : "Saves only the calendar changes shown below after checking current items and columns. Website publication is a separate step.";
  }
  return (
    ACTION_CONSEQUENCE[type] ?? "Executes this action through the same service the admin uses."
  );
}

const DECIDED: Record<string, string> = {
  approved: "Approved. It is running now.",
  executing: "Approved. It is running now.",
  executed: "Approved and done.",
  rejected: "Rejected. Nothing ran.",
  failed: "Approved, but it failed. See the receipt in Work.",
  expired: "Expired before anyone decided. Nothing ran.",
};

/**
 * Whether a proposal can still be decided. A card or review read after someone
 * decided it elsewhere shows that decision instead of offering one.
 */
export function approvalState(
  action: Pick<ActionRow, "status" | "expires_at">,
  now = Date.now(),
): { open: true } | { open: false; label: string } {
  if (action.status === "pending")
    return action.expires_at && Date.parse(action.expires_at) <= now
      ? { open: false, label: DECIDED.expired! }
      : { open: true };
  return {
    open: false,
    label: DECIDED[action.status] ?? "Already decided. Nothing waits for you.",
  };
}
