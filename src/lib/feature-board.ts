export const FEATURE_STATUSES = [
  "backlog",
  "planned",
  "in_progress",
  "blocked",
  "shipped",
] as const;
export const FEATURE_PRIORITIES = ["urgent", "high", "medium", "low"] as const;

export type FeatureStatus = (typeof FEATURE_STATUSES)[number];
export type FeaturePriority = (typeof FEATURE_PRIORITIES)[number];

export interface FeatureRequest {
  id: string;
  seed_key: string | null;
  title: string;
  description: string | null;
  status: FeatureStatus;
  priority: FeaturePriority;
  labels: string[];
  sort_order: number;
  owner: string | null;
  target_date: string | null;
  acceptance_criteria: string | null;
  notes: string | null;
  source: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export const FEATURE_STATUS_META: Record<
  FeatureStatus,
  { label: string; description: string; accent: string }
> = {
  backlog: { label: "Backlog", description: "Captured, not yet committed", accent: "bg-slate-400" },
  planned: { label: "Planned", description: "Committed and ready", accent: "bg-blue-500" },
  in_progress: {
    label: "In progress",
    description: "Actively being built",
    accent: "bg-amber-500",
  },
  blocked: { label: "Blocked", description: "Waiting on a dependency", accent: "bg-rose-500" },
  shipped: { label: "Shipped", description: "Delivered and verified", accent: "bg-emerald-500" },
};

export function isFeatureStatus(value: unknown): value is FeatureStatus {
  return typeof value === "string" && FEATURE_STATUSES.includes(value as FeatureStatus);
}

export function isFeaturePriority(value: unknown): value is FeaturePriority {
  return typeof value === "string" && FEATURE_PRIORITIES.includes(value as FeaturePriority);
}
