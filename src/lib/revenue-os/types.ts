import { tenant } from "@/config/tenant";

/**
 * DEFAULT_PIPELINE_STAGES / DEFAULT_STAGE_META are the seed values migrated
 * into `kanban_columns` (board_key="pipeline") — they are no longer the
 * enforced stage set. A tenant's actual pipeline stages, labels, roles, and
 * probabilities are admin add/renamable/deletable at runtime; read them via
 * `loadPipelineStages()` (./pipeline-stage-resolver), never from this
 * constant. This stays around only as (a) the default seed reference and (b)
 * a synchronous fallback for a couple of legacy display-only widgets
 * (src/lib/admin/pipeline-stages.ts) that haven't been made per-tenant-async
 * yet — see that file for the accepted scope trim.
 */
export const DEFAULT_PIPELINE_STAGES = [
  "new",
  "contacted",
  "qualified",
  "meeting",
  "proposal",
  "negotiation",
  "won",
  "lost",
  "nurture",
] as const;

/** No longer a literal union enforced anywhere — stage keys are admin-defined
 * per tenant now. Kept as a named alias since it's still a useful type-level
 * label at existing call sites (`as RevenueStage`, `stage: RevenueStage`). */
export type RevenueStage = string;

const DEFAULT_STAGE_META: Record<
  (typeof DEFAULT_PIPELINE_STAGES)[number],
  {
    label: string;
    probability: number;
    tone: "neutral" | "info" | "attention" | "success" | "danger";
  }
> = {
  new: { label: "New", probability: 10, tone: "neutral" },
  contacted: { label: "Contacted", probability: 20, tone: "info" },
  qualified: { label: "Qualified", probability: 40, tone: "info" },
  meeting: { label: "Meeting", probability: 55, tone: "attention" },
  proposal: { label: "Proposal", probability: 70, tone: "attention" },
  negotiation: { label: "Negotiation", probability: 85, tone: "attention" },
  won: { label: "Won", probability: 100, tone: "success" },
  lost: { label: "Lost", probability: 0, tone: "danger" },
  nurture: { label: "Nurture", probability: 10, tone: "neutral" },
};

/** Default seed labels, with the bootstrap tenant's static config override
 * applied — used only where a synchronous, non-tenant-aware fallback is
 * unavoidable (see the file-level comment above). */
export const REVENUE_STAGE_META = Object.fromEntries(
  Object.entries(DEFAULT_STAGE_META).map(([stage, meta]) => [
    stage,
    { ...meta, label: tenant.pipeline.stageLabels[stage] ?? meta.label },
  ]),
) as typeof DEFAULT_STAGE_META;

export const LEGACY_STAGE_MAP: Record<string, string> = {
  calendar_viewed: "qualified",
  booked: "meeting",
  showed: "meeting",
  no_show: "nurture",
};

export interface RevenueContact {
  id: string;
  full_name: string;
  primary_email: string | null;
  phone: string | null;
  title: string | null;
  company_id: string | null;
  last_interaction_at: string | null;
  next_action_at: string | null;
  next_action: string | null;
}

export interface RevenueCompany {
  id: string;
  name: string;
  domain: string | null;
  website: string | null;
  industry: string | null;
  research_summary: string | null;
}

export interface RevenueOpportunity {
  id: string;
  name: string | null;
  contact_id: string | null;
  company_id: string | null;
  email: string | null;
  stage: string;
  source: string | null;
  source_detail: string | null;
  estimated_value: number;
  won_value: number;
  probability: number;
  next_action: string | null;
  next_action_at: string | null;
  last_activity_at: string | null;
  created_at: string;
  contact?: RevenueContact | null;
  company?: RevenueCompany | null;
}

export interface OperatorQueueItem {
  id: string;
  kind: "reply" | "task" | "follow_up" | "proposal" | "meeting" | "approval" | "system";
  title: string;
  summary: string;
  urgency: "critical" | "high" | "normal" | "low";
  dueAt: string | null;
  /** When the source fact was last observed; never inferred from the deadline. */
  sourceTimestamp: string;
  /** A concise, evidence-based explanation for why this item is ranked here. */
  priorityReason: string;
  /** The concrete, safe action the operator can take from this item. */
  recommendedNextAction: string;
  href: string;
  entityType?: string;
  entityId?: string;
}

export interface SetupCapability {
  id: string;
  group:
    | "core"
    | "email"
    | "google"
    | "ai"
    | "campaigns"
    | "proposals"
    | "analytics"
    | "booking"
    | "operations";
  label: string;
  description: string;
  accomplishes: string;
  status: "ready" | "action" | "degraded" | "disabled" | "optional";
  required: boolean;
  keys?: string[];
  lastSuccessAt?: string | null;
  lastFailure?: string | null;
  nextRun?: string | null;
  action?: { label: string; href: string; external?: boolean };
}
