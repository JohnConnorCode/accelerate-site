/**
 * Step budget for bounded tool loops.
 *
 * A loop that simply stops at its limit produces the worst possible ending: the
 * model spends its last step launching one more lookup, never gets to answer,
 * and the run closes as "partial" with nothing but whatever narration it
 * streamed along the way. The budget is not just a cap, it is a signal.
 *
 * So the loop tells the model how much room is left before it is out, and on
 * the final step it removes tool access entirely. With no tools advertised the
 * model cannot start work it has no budget to finish; it has to synthesize an
 * answer from the context it already gathered. That is the entire mechanism, and
 * it works because the tool list is rebuilt every step already.
 *
 * The warning threshold and the tool-hiding step are deliberately the same for
 * every loop. A model that learns "three steps left means wrap up" across
 * surfaces stops needing the reminder at all.
 */

/** Steps remaining at which the model is told to start wrapping up. */
export const BUDGET_WARN_STEPS = 3;

export interface StepBudgetState {
  /** 1-based index of the step about to run. */
  step: number;
  /** Total steps this loop may take. */
  limit: number;
  /** Steps left after this one, never negative. */
  remaining: number;
  /** True once the model should stop opening new lines of work. */
  shouldWarn: boolean;
  /** True on the last step: tool access is removed so an answer is forced. */
  toolsAllowed: boolean;
}

export function stepBudgetState(step: number, limit: number): StepBudgetState {
  const safeStep = Number.isFinite(step) ? Math.max(0, Math.trunc(step)) : 0;
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 1;
  const remaining = Math.max(0, safeLimit - safeStep - 1);
  return {
    step: safeStep + 1,
    limit: safeLimit,
    remaining,
    shouldWarn: remaining <= BUDGET_WARN_STEPS,
    toolsAllowed: remaining > 0,
  };
}

/**
 * The system-prompt nudge. Only sent once the budget is genuinely tight, so a
 * short run never pays for the reminder and never learns to ignore it.
 */
export function stepBudgetInstruction(state: StepBudgetState): string | null {
  if (!state.shouldWarn) return null;
  if (!state.toolsAllowed)
    return `This is your final step and no tools are available. Answer now using only the information already gathered above. Do not describe work you intend to do next, and do not ask for a tool. If the gathered context genuinely cannot answer the request, say exactly what is missing.`;
  return `${state.remaining} step${state.remaining === 1 ? "" : "s"} remaining after this one. Start converging on a final answer now: prefer a grounded answer from what you already have over opening new lines of research.`;
}

/**
 * The exhaustion receipt.
 *
 * A run that hits its limit is a real, recurring outcome, not an error string
 * buried in a result preview. Recording it as its own event makes "how often do
 * we run out of room" answerable without reading prose. Steps, tokens and
 * duration are what the ledger actually holds; per-run cost is tracked at the
 * budget level, not per run, so it is not invented here.
 */
export function budgetExhaustedReceipt(input: {
  limit: number;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  stagedToolNames: readonly string[];
  gatheredText: boolean;
}): Record<string, unknown> {
  return {
    reason: "step_budget_exhausted",
    step_limit: input.limit,
    steps_used: input.limit,
    input_tokens: input.inputTokens,
    output_tokens: input.outputTokens,
    total_tokens: input.inputTokens + input.outputTokens,
    duration_ms: Math.max(0, Math.trunc(input.durationMs)),
    staged_tools: [...input.stagedToolNames],
    // An empty context is a different failure from a hard-working run that ran
    // long, and the two need different remedies, so they are distinguishable.
    gathered_context: input.gatheredText,
  };
}
