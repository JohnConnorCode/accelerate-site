/**
 * Canonical lead-pipeline stages, shared across the dashboard widgets
 * (LeadPipeline, ConversionFunnel, RevenueSnapshot) so the order, labels,
 * and colors stay in sync in one place.
 */
export interface PipelineStage {
  key: string;
  label: string;
  /** Tailwind background-color class used for bars/fills. */
  color: string;
}

export const PIPELINE_STAGES: readonly PipelineStage[] = [
  { key: "new", label: "New", color: "bg-blue-500" },
  { key: "contacted", label: "Contacted", color: "bg-yellow-500" },
  { key: "qualified", label: "Qualified", color: "bg-green-500" },
  { key: "proposal", label: "Proposal", color: "bg-purple-500" },
  { key: "won", label: "Won", color: "bg-emerald-500" },
];
