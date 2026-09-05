/** Browser-safe execution dispositions; database lifecycle states remain unchanged. */
export interface WorkArtifact {
  type: "action" | "work_item";
  id: string;
}

type WorkResultBase = { outcome: string; value?: unknown; artifacts?: WorkArtifact[] };
export type WorkResult = WorkResultBase &
  (
    | { status: "completed" | "skipped" | "partial" | "failed" }
    | { status: "deferred" | "awaiting_approval"; nextCheckAt: string }
  );

export function deferWork(
  outcome: string,
  nextCheckAt = new Date(Date.now() + 3_600_000).toISOString(),
): WorkResultBase & { status: "deferred"; nextCheckAt: string } {
  return { status: "deferred", outcome, nextCheckAt };
}

export function workResultText(result: WorkResult): string {
  const refs = result.artifacts?.map((artifact) => `${artifact.type}:${artifact.id}`).join(", ");
  return refs ? `${result.outcome} [${refs}]` : result.outcome;
}
