/** Browser-safe execution dispositions; database lifecycle states remain unchanged. */
export interface WorkArtifact {
  type: "action" | "work_item";
  id: string;
}

type WorkResultBase = { outcome: string; value?: unknown; artifacts?: WorkArtifact[] };
export type WorkResult = WorkResultBase &
  (
    | { status: "completed" | "skipped" | "partial" | "failed" }
    | { status: "reconciliation_required" }
    | { status: "deferred" | "awaiting_approval"; nextCheckAt: string }
  );

export function deferWork(
  outcome: string,
  nextCheckAt = new Date(Date.now() + 3_600_000).toISOString(),
): WorkResultBase & { status: "deferred"; nextCheckAt: string } {
  return { status: "deferred", outcome, nextCheckAt };
}

/** Unknown effects require an explicit receipt review before any retry. */
export function reconcileWork(
  outcome: string,
): WorkResultBase & { status: "reconciliation_required" } {
  return { status: "reconciliation_required", outcome };
}

/**
 * A background check that found nothing actionable.
 *
 * This is a success, not a failure and not a deferral: the work ran, reached a
 * conclusion, and the conclusion was that a human does not need to be interrupted.
 * Reporting it as anything else is what produces "checked and found nothing"
 * messages and trains people to ignore the agent. The reason is required so the
 * conclusion stays auditable rather than merely quiet.
 */
export function concludeSilently(
  examined: string,
  conclusion: string,
): WorkResultBase & { status: "skipped" } {
  return { status: "skipped", outcome: `Checked ${examined}. ${conclusion}` };
}

export function workResultText(result: WorkResult): string {
  const refs = result.artifacts?.map((artifact) => `${artifact.type}:${artifact.id}`).join(", ");
  return refs ? `${result.outcome} [${refs}]` : result.outcome;
}
