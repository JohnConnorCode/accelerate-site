import { tenant } from "@/config/tenant";

export const REVENUE_STAGES = [
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

export type RevenueStage = (typeof REVENUE_STAGES)[number];

const DEFAULT_STAGE_META: Record<RevenueStage, {
  label: string;
  probability: number;
  tone: "neutral" | "info" | "attention" | "success" | "danger";
}> = {
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

/**
 * Stage keys are canonical and never configurable: the database constraint, the
 * transition rules, and every analytics query are built on them. Only the label
 * a human reads is per-tenant, so a different business can call `meeting` a
 * Consultation without any of that moving.
 */
export const REVENUE_STAGE_META = Object.fromEntries(
  Object.entries(DEFAULT_STAGE_META).map(([stage, meta]) => [
    stage,
    { ...meta, label: tenant.pipeline.stageLabels[stage] ?? meta.label },
  ]),
) as typeof DEFAULT_STAGE_META;

export const LEGACY_STAGE_MAP: Record<string, RevenueStage> = {
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
  group: "core" | "email" | "google" | "ai" | "campaigns" | "proposals" | "analytics" | "booking" | "operations";
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
