import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  approvalConsequence,
  approvalKind,
  approvalState,
  approvalTypeLabel,
  type ActionRow,
} from "../src/lib/admin/approval-presentation";
import { elapsedTime } from "../src/lib/admin/work-presentation";

const row = (patch: Partial<ActionRow>): ActionRow => ({
  id: "00000000-0000-4000-8000-000000000001",
  action_type: "create_task",
  title: "Fixture proposal",
  description: null,
  urgency: "normal",
  reasoning: null,
  status: "pending",
  created_at: new Date(Date.now() - 3 * 3_600_000).toISOString(),
  expires_at: null,
  payload: {},
  ...patch,
});

// Kind: external actions are marked before anyone approves them.
assert.deepEqual(approvalKind(row({ action_type: "send_gmail_reply" })), {
  external: true,
  label: "External Action",
  short: "External",
});
assert.equal(approvalKind(row({ action_type: "create_gmail_draft" })).label, "Gmail Draft");
assert.equal(
  approvalKind(row({ action_type: "workspace_configuration_change" })).label,
  "Configuration",
);
assert.deepEqual(approvalKind(row({ action_type: "create_task" })), {
  external: false,
  label: "Internal Mutation",
  short: "Internal",
});
assert.equal(
  approvalTypeLabel(row({ action_type: "transition_opportunity" })),
  "transition opportunity",
);
assert.equal(
  approvalTypeLabel(row({ action_type: "content_calendar_change" })),
  "Editorial calendar",
);

// Consequence: the payload's own statement wins, then the action type, then a safe default.
assert.equal(
  approvalConsequence(row({ action_type: "send_email" })),
  "Sends this email immediately. It cannot be recalled.",
);
assert.equal(
  approvalConsequence(
    row({
      action_type: "workspace_configuration_change",
      payload: { consequences: "Disconnects Gmail. Drafts stay in Gmail." },
    }),
  ),
  "Disconnects Gmail. Drafts stay in Gmail.",
);
assert.equal(
  approvalConsequence(
    row({
      action_type: "blueprint_draft_change",
      payload: { review: { Consequence: "Saves the draft only." } },
    }),
  ),
  "Saves the draft only.",
);
assert.equal(
  approvalConsequence(row({ action_type: "unregistered_fixture" })),
  "Executes this action through the same service the admin uses.",
);

// State: a proposal decided or expired elsewhere is shown as decided, never offered.
assert.deepEqual(approvalState(row({})), { open: true });
const now = Date.now();
assert.equal(
  approvalState(row({ expires_at: new Date(now - 1000).toISOString() }), now).open,
  false,
  "A pending proposal past its expiry is closed",
);
for (const [status, label] of [
  ["approved", "Approved. It is running now."],
  ["executing", "Approved. It is running now."],
  ["executed", "Approved and done."],
  ["rejected", "Rejected. Nothing ran."],
  ["failed", "Approved, but it failed. See the receipt in Work."],
  ["expired", "Expired before anyone decided. Nothing ran."],
] as const)
  assert.deepEqual(approvalState(row({ status })), { open: false, label });
assert.equal(approvalState(row({ status: "something-new" })).open, false);

// Elapsed time reads as an age, not a due date.
assert.equal(elapsedTime(new Date(Date.now() - 3 * 3_600_000).toISOString()), "3h ago");
assert.equal(elapsedTime(new Date().toISOString()), "Just now");

// One presentation: the dialog and every card read these functions instead of copies.
const dialog = readFileSync("src/components/admin/ActionReviewDialog.tsx", "utf8");
assert(!dialog.includes("ACTION_CONSEQUENCE"), "The review dialog keeps no consequence copy");
assert(dialog.includes("approvalConsequence(action)") && dialog.includes("<ApprovalKindBadge"));
const card = readFileSync("src/components/admin/ApprovalCard.tsx", "utf8");
assert(
  !/onApprove|onReject|data-review-decision|"PATCH"/.test(card),
  "Cards open the review; they never decide",
);
const canvasContent = readFileSync("src/components/canvas/CanvasNodeContent.tsx", "utf8");
assert(
  !canvasContent.includes("ApprovalCanvasContent"),
  "Approval canvas content lives with the card",
);

console.log(JSON.stringify({ result: "passed" }));
