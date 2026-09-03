/**
 * The stage subset a few legacy dashboard widgets show (LeadPipeline,
 * ConversionFunnel, RevenueSnapshot, LeadsTable). The subset is deliberate:
 * these widgets summarize the sales path and omit the terminal and holding
 * stages (lost, nurture, negotiation, meeting).
 *
 * Scope trim (accepted as part of the kanban-unification work — see
 * docs/NORTHSTAR.md-adjacent plan and src/lib/revenue-os/types.ts's
 * DEFAULT_PIPELINE_STAGES comment): pipeline stages are now admin add/
 * rename/deletable per tenant via kanban_columns, resolved at request time
 * through `loadPipelineStages()`. These five widgets are synchronous,
 * module-level, and used in several places that don't currently thread a
 * tenant-scoped resolver call through — rather than doing that larger,
 * lower-value refactor now, they keep showing the DEFAULT seed labels here.
 * A tenant that renames "Proposal" to something else won't see that rename
 * reflected in these five widgets until they're migrated to the resolver.
 * The actual Pipeline kanban board and detail page (the primary surfaces)
 * are fully dynamic.
 */
import { REVENUE_STAGE_META, type RevenueStage } from "@/lib/revenue-os/types";

export interface PipelineStage {
  key: RevenueStage;
  label: string;
  /** Tailwind background-color class used for bars/fills. */
  color: string;
}

const WIDGET_STAGE_COLORS: ReadonlyArray<[keyof typeof REVENUE_STAGE_META, string]> = [
  ["new", "bg-blue-500"],
  ["contacted", "bg-yellow-500"],
  ["qualified", "bg-green-500"],
  ["proposal", "bg-purple-500"],
  ["won", "bg-emerald-500"],
];

export const PIPELINE_STAGES: readonly PipelineStage[] = WIDGET_STAGE_COLORS.map(
  ([key, color]) => ({
    key,
    label: REVENUE_STAGE_META[key].label,
    color,
  }),
);
