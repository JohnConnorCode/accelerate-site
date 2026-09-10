import type { PipelineStageResolver } from "./pipeline-stage-resolver";
/** Shared pipeline totals use stored probabilities and configured stage roles. */
export function pipelineMetrics(
  rows: Array<{ stage: string; estimated_value: unknown; probability: unknown }>,
  stages: PipelineStageResolver,
) {
  const open = rows.filter((row) => {
    const stage = stages.canonicalStage(row.stage);
    return stage ? stages.role(stage) === "open" : true;
  });
  return {
    openOpportunities: open.length,
    pipelineValue: open.reduce((sum, row) => sum + Number(row.estimated_value || 0), 0),
    weightedValue: Math.round(
      open.reduce(
        (sum, row) =>
          sum +
          (Number(row.estimated_value || 0) *
            Math.min(100, Math.max(0, Number(row.probability || 0)))) /
            100,
        0,
      ),
    ),
  };
}
