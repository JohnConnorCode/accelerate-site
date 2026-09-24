import assert from "node:assert/strict";
import { workDraftResult, type WorkDraftProposal } from "../src/lib/revenue-os/work-drafts";

const proposal = (overrides: Partial<WorkDraftProposal> = {}): WorkDraftProposal => ({
  id: "action-1",
  action_type: "create_gmail_draft",
  status: "pending",
  payload: { workItemId: "work-1" },
  expires_at: null,
  entity_type: "conversation",
  entity_id: "conversation-1",
  result: null,
  ...overrides,
});

const awaiting = workDraftResult(proposal());
assert.equal(awaiting.status, "awaiting_approval");
assert.ok("nextCheckAt" in awaiting && Date.parse(awaiting.nextCheckAt) > Date.now());

const saved = workDraftResult(
  proposal({
    status: "executed",
    result: { status: "drafted", sent: false, draftId: "draft-1" },
  }),
);
assert.equal(saved.status, "deferred", "saving a draft must leave its follow-up open");
assert.match(saved.outcome, /Not sent/);
assert.ok("nextCheckAt" in saved && Date.parse(saved.nextCheckAt) > Date.now());
assert.deepEqual(saved.artifacts, [{ type: "action", id: "action-1" }]);

const uncertain = workDraftResult(proposal({ status: "failed" }));
assert.equal(uncertain.status, "reconciliation_required");
assert.match(uncertain.outcome, /before retrying/);

const legacySend = workDraftResult(proposal({ action_type: "send_gmail_reply" }));
assert.equal(legacySend.status, "reconciliation_required");
assert.match(legacySend.outcome, /older follow-up.*send action/i);

const falseDraftReceipt = workDraftResult(
  proposal({ status: "executed", result: { status: "sent", sent: true } }),
);
assert.equal(falseDraftReceipt.status, "reconciliation_required");

console.log(
  JSON.stringify({
    result: "passed",
    checks: [
      "approval-keeps-followup-open",
      "saved-draft-is-never-marked-sent-or-complete",
      "uncertain-effect-requires-reconciliation",
      "legacy-send-action-fails-closed",
      "receipt-must-confirm-unsent-draft",
    ],
  }),
);
