#!/usr/bin/env tsx
/**
 * A step budget is only useful if it changes what the model does. Without the
 * signal, the classic failure is quiet and looks like success right up until a
 * founder asks a question and gets "I stopped after N steps" instead of an
 * answer: the model spends its last step opening one more lookup and never gets
 * to conclude anything.
 *
 * The properties under test:
 *   - the warning arrives before the boundary, not after the run has failed
 *   - the final step advertises no tools at all, so an answer is forced rather
 *     than merely encouraged
 *   - a run that finishes early never sees the reminder and keeps its tools
 *   - exhaustion is a recorded, queryable event, not prose in a result preview
 *   - running out of room with nothing gathered is distinguishable from running
 *     out of room after real work
 */
import assert from "node:assert/strict";
import {
  BUDGET_WARN_STEPS,
  budgetExhaustedReceipt,
  stepBudgetInstruction,
  stepBudgetState,
} from "../src/lib/revenue-os/step-budget";

const LIMIT = 5;

function states(limit = LIMIT) {
  return Array.from({ length: limit }, (_, turn) => stepBudgetState(turn, limit));
}

function main() {
  // --- the boundary --------------------------------------------------------
  const steps = states();
  assert.equal(steps.length, LIMIT);
  assert.deepEqual(
    steps.map((state) => state.remaining),
    [4, 3, 2, 1, 0],
    "remaining steps count down to zero",
  );
  assert.deepEqual(
    steps.map((state) => state.step),
    [1, 2, 3, 4, 5],
    "steps are reported 1-based so the model is not told it has step zero",
  );
  assert.equal(
    steps[0]!.toolsAllowed,
    true,
    "the first step keeps its tools; the run is not hobbled at the start",
  );
  assert.equal(
    steps[steps.length - 1]!.toolsAllowed,
    false,
    "the final step advertises no tools, so the model must answer",
  );
  assert.equal(
    steps.filter((state) => !state.toolsAllowed).length,
    1,
    "exactly one step is tool-free",
  );

  // --- the warning arrives early enough to act on ---------------------------
  assert.equal(
    steps.filter((state) => state.shouldWarn).length,
    BUDGET_WARN_STEPS + 1,
    "the model is warned for the last few steps, not only the last one",
  );
  assert.equal(steps[0]!.shouldWarn, false, "an early step pays for no reminder");
  const warn = stepBudgetInstruction(steps[1]!);
  assert.ok(warn, "the warning is present once the budget is tight");
  assert.match(warn!, /3 steps remaining after this one/);
  assert.match(warn!, /final answer/i);
  assert.equal(
    stepBudgetInstruction(steps[0]!),
    null,
    "a run with room to work is never told to wrap up",
  );

  const finalInstruction = stepBudgetInstruction(steps[steps.length - 1]!);
  assert.ok(finalInstruction, "the tool-free step explains itself");
  assert.match(finalInstruction!, /final step and no tools are available/);
  assert.match(finalInstruction!, /Answer now/);
  assert.match(
    finalInstruction!,
    /what is missing/,
    "an unanswerable wrap-up is told how to say so rather than inventing something",
  );
  assert.equal(
    stepBudgetInstruction(steps[2]!),
    stepBudgetInstruction(steps[2]!),
    "the instruction is stable so it can be reasoned about",
  );
  assert.match(stepBudgetInstruction(steps[2]!)!, /2 steps remaining/);
  assert.match(stepBudgetInstruction(steps[3]!)!, /1 step remaining after this one\./);
  assert.doesNotMatch(
    stepBudgetInstruction(steps[3]!)!,
    /1 steps remaining/,
    "the singular reads like a person wrote it",
  );

  // --- a run that finishes early is untouched -------------------------------
  const short = stepBudgetState(0, 20);
  assert.equal(short.toolsAllowed, true);
  assert.equal(short.shouldWarn, false);
  assert.equal(stepBudgetInstruction(short), null);

  // --- exhaustion is a record, not a sentence -------------------------------
  const receipt = budgetExhaustedReceipt({
    limit: LIMIT,
    inputTokens: 1200,
    outputTokens: 340,
    durationMs: 8123.7,
    stagedToolNames: ["propose_send_email", "propose_task"],
    gatheredText: true,
  });
  assert.equal(receipt.reason, "step_budget_exhausted");
  assert.equal(receipt.step_limit, LIMIT);
  assert.equal(receipt.steps_used, LIMIT);
  assert.equal(receipt.input_tokens, 1200);
  assert.equal(receipt.output_tokens, 340);
  assert.equal(receipt.total_tokens, 1540);
  assert.equal(receipt.duration_ms, 8123, "duration is a whole number of milliseconds");
  assert.deepEqual(
    receipt.staged_tools,
    ["propose_send_email", "propose_task"],
    "the receipt records what the run staged; dedupe is the caller's Set",
  );
  assert.equal(
    receipt.gathered_context,
    true,
    "a long run that did real work is distinguishable from an empty one",
  );
  assert.equal(
    budgetExhaustedReceipt({
      limit: LIMIT,
      inputTokens: 0,
      outputTokens: 0,
      durationMs: 5,
      stagedToolNames: [],
      gatheredText: false,
    }).gathered_context,
    false,
  );

  // --- degenerate inputs stay inside the loop -------------------------------
  for (const bad of [0, -3, 1.7]) {
    const state = stepBudgetState(bad, LIMIT);
    assert.ok(state.step >= 1 && state.remaining >= 0, `step ${bad} is clamped`);
  }
  for (const bad of [0, -1, Number.NaN]) {
    const state = stepBudgetState(0, bad);
    assert.equal(state.limit, 1, `limit ${bad} degrades to a single tool-free step`);
    assert.equal(state.toolsAllowed, false);
  }

  console.log("step budget forced wrap-up: all checks passed");
}

main();
