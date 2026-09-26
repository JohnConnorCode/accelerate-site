#!/usr/bin/env tsx
/**
 * The operator queue is the scarcest resource in the product: a human's
 * attention. Before the gate, every proposal became a `pending` row and the only
 * suppression was an exact dedupe key, so a weak finding cost a dismissal and
 * the reflex-dismissal it trained made every later row worthless too.
 *
 * A bug in this gate is expensive in both directions. Suppress too much and a
 * real lead dies quietly; suppress nothing and the fatigue it was built to fix
 * is still there. So the properties under test are both halves:
 *   - a proposal a person asked for is never gated
 *   - a scheduled sweep with little to act on creates no row but a real receipt
 *   - a failure to read policy or score degrades to today's behavior, never to a
 *     silent discard
 *   - a passed proposal is auditable, so "nothing worth surfacing" is a recorded
 *     decision rather than a disappearance
 *   - a silent conclusion is a success that says what it checked
 */
import assert from "node:assert/strict";
import { MemorySupabase, type Row } from "./lib/memory-supabase";
import { proposeAction, withProposalWorkContext } from "../src/lib/revenue-os/actions";
import {
  loadTriageSettings,
  routeTriage,
  scoreTriage,
  triageReason,
  triageReceipt,
} from "../src/lib/revenue-os/triage";
import { concludeSilently } from "../src/lib/revenue-os/work-result";
import { loadOperatorQueue } from "../src/lib/revenue-os/queue";

const WORK_ITEM_ID = "11111111-1111-4111-8111-111111111111";

function settings(overrides: Partial<{ suppression_threshold: number | null }> = {}): Row[] {
  return [{ suppression_threshold: null, ...overrides }];
}

async function propose(db: MemorySupabase, input: Record<string, unknown>, background = true) {
  const call = () =>
    proposeAction(db.client as never, input as never) as Promise<Row | null>;
  return background ? withProposalWorkContext(WORK_ITEM_ID, call) : call();
}

const ambientSweep = {
  actionType: "data_quality_scan",
  title: "Two contacts have no company",
  payload: { count: 2 },
  sourceContext: "work_scheduler",
  urgency: "low",
  dedupeKey: "dq:2026-09-30",
};

const ambientUseful = {
  actionType: "qualify_lead",
  title: "Qualify inbound lead from Acme",
  payload: { leadId: "lead-1" },
  sourceContext: "work_scheduler",
  urgency: "high",
  entityType: "contact",
  entityId: "contact-1",
  reasoning: "Inbound demo request with a named budget and a decision date.",
  evidence: { quote: "Looking to replace our CRM this quarter" },
  dedupeKey: "qualify:lead-1",
};

async function main() {
  // --- routing -------------------------------------------------------------
  // A person asked for this. No heuristic gets a vote.
  const explicit = routeTriage(
    { actionType: "data_quality_scan", urgency: "low", explicit: true },
    { suppressionThreshold: 100 },
  );
  assert.equal(explicit.action, "answer", "an explicit request is never suppressed");
  assert.equal(explicit.explicit, true);
  assert.match(explicit.reason, /asked for this directly/);

  // A scheduled sweep reporting a low-value condition is noise by construction.
  const noise = routeTriage(
    { actionType: "data_quality_scan", urgency: "low" },
    { suppressionThreshold: null },
  );
  assert.equal(noise.action, "pass", "an ambient low-value sweep is held back");
  assert.match(noise.reason, /Scheduled sweep/);
  assert.equal(noise.thresholdApplied, false, "the noise rule is independent of the threshold");

  // Useful but thin: check before spending a person's attention.
  const investigate = routeTriage(
    { actionType: "propose_stage_change", urgency: "high" },
    { suppressionThreshold: null },
  );
  assert.equal(investigate.action, "investigate", "high usefulness with no support investigates");
  assert.equal(investigate.scores.investigationValue, 80);
  assert.ok(investigate.scores.confidence < 60);

  // Supported and useful: answer.
  const answer = routeTriage(
    {
      actionType: "send_email",
      urgency: "high",
      entityId: "opp-1",
      evidence: { quote: "Can you send the revised quote?" },
    },
    { suppressionThreshold: null },
  );
  assert.equal(answer.action, "answer");
  assert.equal(answer.scores.confidence, 80, "supplied evidence is what raises confidence");

  // The threshold is a workspace choice, and silence is not consent: unset keeps
  // current behavior rather than silencing a workspace nobody configured.
  assert.deepEqual(await loadTriageSettings(new MemorySupabase({}).client as never), {
    suppressionThreshold: null,
  });
  assert.deepEqual(
    await loadTriageSettings(
      new MemorySupabase({ triage_settings: settings({ suppression_threshold: 60 }) }).client as never,
    ),
    { suppressionThreshold: 60 },
  );

  const belowThreshold = routeTriage(
    { actionType: "propose_stage_change", urgency: "low" },
    { suppressionThreshold: 60 },
  );
  assert.equal(belowThreshold.action, "pass");
  assert.equal(belowThreshold.thresholdApplied, true);
  assert.match(belowThreshold.reason, /below this workspace's 60 threshold/);

  // An unreadable policy must not silence a workspace by accident.
  const brokenSettings = new MemorySupabase({ triage_settings: settings() });
  brokenSettings.fail("triage_settings", { code: "42501", message: "permission denied" });
  assert.deepEqual(await loadTriageSettings(brokenSettings.client as never), {
    suppressionThreshold: null,
  });

  // --- pass creates no row, but is not a disappearance ----------------------
  const suppressed = new MemorySupabase({ triage_settings: settings() });
  const suppressedResult = await propose(suppressed, ambientSweep);
  assert.equal(suppressedResult, null, "a passed proposal returns no action row");
  assert.equal(
    suppressed.rows("action_queue").length,
    0,
    "a passed proposal never reaches the operator queue",
  );
  const receipts = suppressed.rows("activities");
  assert.equal(receipts.length, 1, "the suppression leaves exactly one receipt");
  assert.equal(receipts[0]!.activity_type, "agent_triage_skipped");
  const receiptMetadata = receipts[0]!.metadata as Record<string, unknown>;
  assert.equal(receiptMetadata.action, "pass");
  assert.equal(
    (receiptMetadata.scores as Record<string, number>).usefulness,
    scoreTriage({ actionType: "data_quality_scan", urgency: "low" }).usefulness,
    "the receipt carries the scores that produced the decision",
  );
  assert.ok(typeof receiptMetadata.reason === "string" && receiptMetadata.reason.length > 0);
  assert.ok(
    suppressed.rows("audit_log").some((row) => row.action === "action.triage_skipped"),
    "the immutable audit trail records the decision too",
  );

  // Replaying the same finding must not manufacture a second receipt.
  await propose(suppressed, ambientSweep);
  assert.equal(suppressed.rows("activities").length, 1, "replay is idempotent at the receipt");

  // --- answer behaves exactly as it did before the gate ---------------------
  const answered = new MemorySupabase({ triage_settings: settings() });
  const answeredRow = await propose(answered, ambientUseful);
  assert.ok(answeredRow?.id, "a useful proposal is still proposed");
  assert.equal(answeredRow!.work_item_id, WORK_ITEM_ID, "the work link is preserved");
  const triage = answeredRow!.triage as Record<string, unknown>;
  assert.equal(triage.action, "answer");
  assert.ok(typeof triage.reason === "string");
  assert.equal(triageReason(triage), triage.reason);
  assert.equal(triageReason(null), null, "a row without triage keeps its pre-gate reason");

  // Duplicate/replay of a real proposal still collapses to one pending row.
  const replayed = await propose(answered, ambientUseful);
  assert.equal(replayed?.id, answeredRow!.id, "the dedupe boundary is unchanged");
  assert.equal(answered.rows("action_queue").length, 1);

  // --- the human path is untouched ------------------------------------------
  const humanDb = new MemorySupabase({ triage_settings: settings({ suppression_threshold: 100 }) });
  const humanRow = await propose(humanDb, ambientSweep, false);
  assert.ok(humanRow?.id, "a proposal a person triggered is never gated, however thin");
  assert.equal(humanDb.rows("action_queue").length, 1);
  assert.equal(humanDb.rows("activities").length, 0, "no suppression receipt on the human path");

  // Even a background proposal can be declared explicit by its caller.
  const declared = new MemorySupabase({ triage_settings: settings({ suppression_threshold: 100 }) });
  const declaredRow = await propose(declared, { ...ambientSweep, explicit: true });
  assert.ok(declaredRow?.id, "an explicitly flagged proposal is not suppressed");

  // --- investigate holds the work open without interrupting -------------------
  const investigateDb = new MemorySupabase({ triage_settings: settings() });
  const investigateRow = await propose(investigateDb, {
    actionType: "propose_stage_change",
    title: "Move Acme to negotiation",
    payload: { opportunityId: "opp-1" },
    sourceContext: "work_scheduler",
    urgency: "high",
  });
  assert.equal(investigateRow, null, "an unverified hunch does not reach the queue");
  assert.equal(investigateDb.rows("action_queue").length, 0);
  assert.ok(
    investigateDb.rows("audit_log").some((row) => row.action === "action.triage_investigate"),
    "the decision to go check is recorded",
  );

  // --- the receipt is what the operator reads --------------------------------
  const decision = routeTriage(ambientUseful, { suppressionThreshold: null });
  const receipt = triageReceipt(decision);
  assert.equal(receipt.action, "answer");
  assert.equal(
    triageReason(receipt),
    decision.reason,
    "every shown row can explain why it is there",
  );

  // --- silent conclusion is a success, not a finding -------------------------
  const silent = concludeSilently("open opportunities", "No deal is stale.");
  assert.equal(silent.status, "skipped");
  assert.match(silent.outcome, /Checked open opportunities\./);
  assert.match(silent.outcome, /No deal is stale\./);
  assert.ok(
    !/found nothing to report/i.test(silent.outcome),
    "a quiet conclusion never reads as a message to a human",
  );

  // A gate that cannot run must cost nothing. This is the dangerous direction:
  // a broken heuristic that discards work loses a lead, so it falls through to
  // the pre-gate behavior instead.
  const brokenGate = new MemorySupabase({ triage_settings: settings() });
  const baseClient = brokenGate.client as { from: (table: string) => unknown };
  const brokenClient = {
    ...baseClient,
    from: (table: string) => {
      if (table === "triage_settings") throw new Error("settings transport exploded");
      return baseClient.from(table);
    },
  } as never;
  const brokenRow = await withProposalWorkContext(WORK_ITEM_ID, () =>
    proposeAction(brokenClient, ambientSweep as never) as Promise<Row | null>,
  );
  assert.ok(brokenRow?.id, "a broken gate queues the proposal rather than losing it");
  assert.equal(brokenGate.rows("action_queue").length, 1);
  assert.equal(brokenGate.rows("activities").length, 0, "no false suppression receipt");
  assert.ok(
    brokenGate.rows("audit_log").some((row) => row.action === "action.triage_unavailable"),
    "the fallback is recorded, not silent",
  );

  // --- the operator queue shows the reason ---------------------------------
  const queueDb = new MemorySupabase({
    triage_settings: settings(),
    action_queue: [
      {
        id: "a-explained",
        status: "pending",
        title: "Qualify inbound lead from Acme",
        description: null,
        urgency: "high",
        entity_type: "contact",
        entity_id: "contact-1",
        created_at: new Date().toISOString(),
        expires_at: null,
        triage: triageReceipt(answer),
      },
      {
        id: "a-legacy",
        status: "pending",
        title: "Older proposal with no triage record",
        description: null,
        urgency: "normal",
        entity_type: null,
        entity_id: null,
        created_at: new Date().toISOString(),
        expires_at: null,
        triage: null,
      },
    ],
  });
  const sourceErrors: string[] = [];
  const queue = await loadOperatorQueue(queueDb.client as never, {
    onSourceError: (source) => sourceErrors.push(source),
  });
  const explained = queue.find((item) => item.id === "action:a-explained");
  const legacy = queue.find((item) => item.id === "action:a-legacy");
  assert.equal(
    explained?.priorityReason,
    answer.reason,
    "a queued item explains why it reached the operator",
  );
  assert.equal(
    legacy?.priorityReason,
    "Approval required before execution",
    "a row written before the gate keeps a truthful reason",
  );
  assert.ok(
    !queue.some((item) => item.id.startsWith("action:") && !item.priorityReason.trim()),
    "no approval row is left unexplained",
  );

  console.log("triage gate and silent exit: all checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
