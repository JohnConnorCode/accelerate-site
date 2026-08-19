/**
 * The stage subset the legacy dashboard widgets show (LeadPipeline,
 * ConversionFunnel, RevenueSnapshot, LeadsTable).
 *
 * These labels used to be a second hard-coded stage list that could drift from
 * the canonical one in `src/lib/revenue-os/types.ts`, which is the source the
 * database constraint, transition rules and analytics are all built on. Keys and
 * labels are now derived from that single source, so a tenant stage relabel
 * reaches these widgets too and the two lists cannot disagree. Only the colour,
 * which is pure presentation, is defined here.
 *
 * The subset is deliberate: these widgets summarise the sales path and omit the
 * terminal and holding stages (lost, nurture, negotiation, meeting).
 */
import { REVENUE_STAGE_META, type RevenueStage } from "@/lib/revenue-os/types";

export interface PipelineStage {
  key: RevenueStage;
  label: string;
  /** Tailwind background-color class used for bars/fills. */
  color: string;
}

const WIDGET_STAGE_COLORS: ReadonlyArray<[RevenueStage, string]> = [
  ["new", "bg-blue-500"],
  ["contacted", "bg-yellow-500"],
  ["qualified", "bg-green-500"],
  ["proposal", "bg-purple-500"],
  ["won", "bg-emerald-500"],
];

export const PIPELINE_STAGES: readonly PipelineStage[] = WIDGET_STAGE_COLORS.map(([key, color]) => ({
  key,
  label: REVENUE_STAGE_META[key].label,
  color,
}));
