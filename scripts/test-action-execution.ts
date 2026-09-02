#!/usr/bin/env tsx
/**
 * The approval path had no executing coverage at all, which is indefensible for
 * what it is: the single place where a row a human ticked turns into a real
 * side effect. Everything here is about the queue's state machine, because a
 * bug in that machine either performs an action twice or reports one that never
 * happened.
 *
 * The properties under test:
 *   - the claim is atomic, so approving twice cannot execute twice
 *   - an expired proposal cannot be approved, however it is reached
 *   - payload validation happens before any side effect is attempted
 *   - a failed execution is recorded as failed and the error is re-thrown
 *     rather than swallowed into a successful-looking response
 *   - an unregistered action type fails closed
 */
import assert from "node:assert/strict";
import { MemorySupabase, type Row } from "./lib/memory-supabase";
import { approveAndExecuteAction } from "../src/lib/revenue-os/action-executor";
import {
  failAction,
  finishAction,
  recoverStaleExecutingActions,
  rejectAction,
} from "../src/lib/revenue-os/actions";

const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

function pending(overrides: Row = {}): Row {
  return {
    id: "action-1",
    status: "pending",
    action_type: "update_next_action",
    title: "Set the next step",
    payload: {
      opportunityId: "opp-1",
      nextAction: "Send the revised scope",
      nextActionAt: iso(86400000),
    },
    expires_at: iso(86400000),
    ...overrides,
  };
}

function seed(action: Row = pending()) {
  return new MemorySupabase({
    action_queue: [action],
    opportunities: [
      {
        id: "opp-1",
        name: "Northside Roofing",
        stage: "qualified",
        next_action: null,
        next_action_at: null,
      },
    ],
    audit_log: [],
  });
}

async function rejects(run: () => Promise<unknown>, includes: string, because: string) {
  let message: string | null = null;
  try {
    await run();
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  assert.ok(message !== null, `expected a rejection: ${because}`);
  assert.ok(
    message.toLowerCase().includes(includes.toLowerCase()),
    `${because}\n  expected the message to mention "${includes}"\n  got: ${message}`,
  );
}

async function main() {
  // ---- The happy path leaves an auditable, executed row ------------------

  const ok = seed();
  const result = (await approveAndExecuteAction(
    ok.client,
    "action-1",
    "john@acceleratewith.us",
  )) as Row;
  assert.equal(
    result.next_action,
    "Send the revised scope",
    "the executor must return what it actually wrote",
  );

  const executed = ok.rows("action_queue")[0]!;
  assert.equal(
    executed.status,
    "executed",
    "a successful action must end `executed`, not linger in `executing`",
  );
  assert.equal(
    executed.approved_by,
    "john@acceleratewith.us",
    "the queue must record who approved it",
  );
  assert.ok(executed.approved_at, "approval time must be recorded");
  assert.ok(executed.executed_at, "execution time must be recorded");
  assert.equal(executed.error, null, "a successful action must not carry an error");
  assert.equal(
    ok.rows("opportunities")[0]!.next_action,
    "Send the revised scope",
    "the side effect must actually have happened",
  );
  assert.ok(ok.rows("audit_log").length > 0, "approving an action must leave an audit entry");

  // ---- Approving twice must not execute twice ---------------------------

  await rejects(
    () => approveAndExecuteAction(ok.client, "action-1", "john@acceleratewith.us"),
    "already handled",
    "the claim is what makes approval single-shot; a double click must not send an email twice",
  );
  assert.equal(
    ok.rows("action_queue")[0]!.status,
    "executed",
    "the failed second claim must not disturb the completed row",
  );

  // ---- An expired proposal cannot be approved ---------------------------

  const stale = seed(pending({ expires_at: iso(-86400000) }));
  await rejects(
    () => approveAndExecuteAction(stale.client, "action-1", "john@acceleratewith.us"),
    "expired",
    "an expired proposal was built on stale facts; approving it must fail rather than act on them",
  );
  assert.equal(
    stale.rows("action_queue")[0]!.status,
    "pending",
    "a refused claim must leave the row untouched",
  );
  assert.equal(
    stale.rows("opportunities")[0]!.next_action,
    null,
    "no side effect may happen when the claim is refused",
  );

  // A proposal with no expiry at all is still approvable; the guard must not
  // treat "never expires" as "already expired".
  const eternal = seed(pending({ expires_at: null }));
  await assert.doesNotReject(() =>
    approveAndExecuteAction(eternal.client, "action-1", "john@acceleratewith.us"),
  );

  // ---- Validation happens before the side effect ------------------------

  // send_email reaches a real provider. A payload missing its recipient must be
  // refused by validation first, so this proves the ordering without sending.
  const malformed = seed(
    pending({ action_type: "send_email", payload: { subject: "Hello", body: "Hi there" } }),
  );
  await rejects(
    () => approveAndExecuteAction(malformed.client, "action-1", "john@acceleratewith.us"),
    "to is required",
    "a payload missing its recipient must fail validation before the sender is ever called",
  );
  assert.equal(
    malformed.rows("action_queue")[0]!.status,
    "failed",
    "a validation failure must be recorded on the row, not left `executing` forever",
  );
  assert.match(
    String(malformed.rows("action_queue")[0]!.error),
    /to is required/,
    "the row must say why it failed",
  );

  // ---- An invalid stage is rejected before the pipeline moves -----------

  const badStage = seed(
    pending({
      action_type: "transition_opportunity",
      payload: { opportunityId: "opp-1", stage: "definitely_not_a_stage", reason: "test" },
    }),
  );
  await rejects(
    () => approveAndExecuteAction(badStage.client, "action-1", "john@acceleratewith.us"),
    "Invalid pipeline stage",
    "a stage outside the canonical set must be refused; the pipeline is the thing revenue is measured from",
  );
  assert.equal(
    badStage.rows("opportunities")[0]!.stage,
    "qualified",
    "the opportunity must not have moved",
  );

  // ---- An unregistered action type fails closed ------------------------

  const unknown = seed(pending({ action_type: "wire_money_somewhere" }));
  await rejects(
    () => approveAndExecuteAction(unknown.client, "action-1", "john@acceleratewith.us"),
    "not registered for execution",
    "an action type with no executor must fail closed rather than silently report success",
  );
  assert.equal(unknown.rows("action_queue")[0]!.status, "failed");

  // ---- A failed side effect is recorded and the error still surfaces ----

  const broken = seed();
  broken.fail("opportunities", { message: "opportunities table unavailable" });
  await rejects(
    () => approveAndExecuteAction(broken.client, "action-1", "john@acceleratewith.us"),
    "unavailable",
    "the original error must be re-thrown; swallowing it would let the API report success for work that did not happen",
  );
  assert.equal(
    broken.rows("action_queue")[0]!.status,
    "failed",
    "a failed execution must be recorded as failed",
  );
  assert.match(
    String(broken.rows("action_queue")[0]!.error),
    /unavailable/,
    "the failure reason must be preserved for the operator",
  );

  // ---- Rejection is also single-shot -----------------------------------

  const rejected = seed();
  await rejectAction(rejected.client, "action-1", "john@acceleratewith.us", "Wrong contact");
  const row = rejected.rows("action_queue")[0]!;
  assert.equal(row.status, "rejected");
  assert.deepEqual(
    row.result,
    { reason: "Wrong contact" },
    "the reason must be kept; it is the signal the agent-learning loop reads",
  );
  assert.ok(rejected.rows("audit_log").length > 0, "a rejection must be audited too");

  await rejects(
    () => rejectAction(rejected.client, "action-1", "john@acceleratewith.us"),
    "already handled",
    "rejecting twice must fail rather than overwrite the first decision",
  );

  // A rejected action must not then be executable.
  await rejects(
    () => approveAndExecuteAction(rejected.client, "action-1", "john@acceleratewith.us"),
    "already handled",
    "an action the founder rejected must never execute afterwards",
  );
  assert.equal(
    rejected.rows("opportunities")[0]!.next_action,
    null,
    "a rejected action must have caused no side effect",
  );

  // ---- Terminal writes are scoped to the state they belong to ----------

  // Both finishAction and failAction filter on `status = 'executing'`. Without
  // that scope a late or duplicated completion overwrites a row that has
  // already been failed or rejected, so the queue would show `executed` for an
  // action that never succeeded. Nothing else in this file exercises it,
  // because the executor always reaches them through a fresh claim.
  const terminal = seed(pending({ status: "failed", error: "Provider rejected the recipient" }));
  await finishAction(terminal.client, "action-1", { pretend: "success" });
  assert.equal(
    terminal.rows("action_queue")[0]!.status,
    "failed",
    "finishAction must not resurrect a row that is not currently executing",
  );
  assert.equal(
    terminal.rows("action_queue")[0]!.error,
    "Provider rejected the recipient",
    "the real failure reason must survive a stray completion",
  );

  const alreadyRejected = seed(pending({ status: "rejected" }));
  await failAction(alreadyRejected.client, "action-1", "late failure");
  assert.equal(
    alreadyRejected.rows("action_queue")[0]!.status,
    "rejected",
    "failAction must not overwrite a founder's rejection",
  );

  // ---- Abandoned executing claims must not disable the queue forever ----

  const abandonedAt = iso(-2 * 60 * 60 * 1000);
  const abandoned = seed(
    pending({
      id: "abandoned",
      status: "executing",
      action_type: "send_email",
      updated_at: abandonedAt,
      payload: { to: "alex@example.com", subject: "Hello", body: "Hi" },
    }),
  );
  (abandoned.tables.action_queue ??= []).push(pending({ id: "fresh-after-recovery" }));
  const recoveredCount = await recoverStaleExecutingActions(abandoned.client);
  assert.equal(
    recoveredCount,
    1,
    "an executing action older than the stale window must be recovered",
  );
  const abandonedRow = abandoned.rows("action_queue").find((row) => row.id === "abandoned")!;
  assert.equal(
    abandonedRow.status,
    "failed",
    "the abandoned action must close as failed rather than stay executing",
  );
  assert.match(
    String(abandonedRow.error),
    /abandoned/i,
    "the recovered action must say why it was closed",
  );
  assert.ok(
    abandoned
      .rows("audit_log")
      .some(
        (row) => row.action === "execution.stale_claim_recovered" && row.entity_id === "abandoned",
      ),
    "action stale recovery must write an audit receipt",
  );
  const afterRecovery = (await approveAndExecuteAction(
    abandoned.client,
    "fresh-after-recovery",
    "john@acceleratewith.us",
  )) as Row;
  assert.equal(
    afterRecovery.next_action,
    "Send the revised scope",
    "recovering an abandoned action must not block a later claim",
  );

  // ---- State change invalidation ----------------------------------------

  // When an opportunity stage has moved since proposal was created, execution fails
  const staleStageOpp = new MemorySupabase({
    action_queue: [
      pending({
        id: "action-stage-conflict",
        action_type: "transition_opportunity",
        payload: {
          opportunityId: "opp-moved",
          stage: "won",
          expectedStage: "qualified",
          reason: "Deal closed",
        },
      }),
    ],
    opportunities: [
      {
        id: "opp-moved",
        name: "Northside Roofing",
        stage: "proposal", // changed from qualified to proposal
      },
    ],
    audit_log: [],
  });

  await rejects(
    () =>
      approveAndExecuteAction(
        staleStageOpp.client,
        "action-stage-conflict",
        "john@acceleratewith.us",
      ),
    "opportunity state changed",
    "when the underlying record stage has changed since proposal, approval must be rejected",
  );

  // When opportunity is already in target stage
  const duplicateStageOpp = new MemorySupabase({
    action_queue: [
      pending({
        id: "action-stage-dup",
        action_type: "transition_opportunity",
        payload: {
          opportunityId: "opp-dup",
          stage: "proposal",
          reason: "Advance deal",
        },
      }),
    ],
    opportunities: [
      {
        id: "opp-dup",
        name: "Northside Roofing",
        stage: "proposal",
      },
    ],
    audit_log: [],
  });

  await rejects(
    () =>
      approveAndExecuteAction(duplicateStageOpp.client, "action-stage-dup", "john@acceleratewith.us"),
    "already in stage",
    "advancing to an identical stage must be rejected",
  );

  // When a campaign version has changed since proposal
  const staleCampaign = new MemorySupabase({
    action_queue: [
      pending({
        id: "action-camp-conflict",
        action_type: "activate_campaign",
        payload: {
          campaignId: "camp-1",
          expectedVersion: 1,
          reasoning: "Launch campaign",
        },
      }),
    ],
    campaigns: [
      {
        id: "camp-1",
        name: "Re-engagement v2",
        status: "draft",
        version: 2, // bumped
        approved_version: 2,
      },
    ],
    audit_log: [],
  });

  await rejects(
    () =>
      approveAndExecuteAction(
        staleCampaign.client,
        "action-camp-conflict",
        "john@acceleratewith.us",
      ),
    "Campaign version changed",
    "campaign version mismatch must require re-approval",
  );

  // When an email target contact has unsubscribed
  const unsubscribedContact = new MemorySupabase({
    action_queue: [
      pending({
        id: "action-email-unsub",
        action_type: "send_email",
        payload: {
          to: "unsub@example.com",
          subject: "Check in",
          body: "Hello",
          contactId: "cont-unsub",
        },
      }),
    ],
    contacts: [
      {
        id: "cont-unsub",
        full_name: "Unsubscribed User",
        primary_email: "unsub@example.com",
        unsubscribed: true,
      },
    ],
    audit_log: [],
  });

  await rejects(
    () =>
      approveAndExecuteAction(
        unsubscribedContact.client,
        "action-email-unsub",
        "john@acceleratewith.us",
      ),
    "contact has unsubscribed",
    "unsubscribed contacts must not be emailed on approval",
  );

  // When a conversation reply is attempted on an archived conversation
  const archivedConv = new MemorySupabase({
    action_queue: [
      pending({
        id: "action-reply-archived",
        action_type: "send_gmail_reply",
        payload: {
          conversationId: "conv-archived",
          body: "Following up",
        },
      }),
    ],
    conversations: [
      {
        id: "conv-archived",
        status: "archived",
      },
    ],
    audit_log: [],
  });

  await rejects(
    () =>
      approveAndExecuteAction(
        archivedConv.client,
        "action-reply-archived",
        "john@acceleratewith.us",
      ),
    "conversation is archived",
    "archived conversations cannot receive replies",
  );

  console.log(
    JSON.stringify(
      {
        checks: [
          "executes-and-audits",
          "claim-is-single-shot",
          "expired-refused",
          "no-expiry-allowed",
          "validates-before-side-effect",
          "invalid-stage-refused",
          "unregistered-fails-closed",
          "failure-recorded-and-rethrown",
          "reject-single-shot",
          "rejected-never-executes",
          "terminal-writes-scoped",
          "stale-executing-recovered",
          "underlying-stage-change-refused",
          "duplicate-stage-refused",
          "campaign-version-mismatch-refused",
          "unsubscribed-contact-refused",
          "archived-conversation-reply-refused",
        ],
        result: "passed",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
