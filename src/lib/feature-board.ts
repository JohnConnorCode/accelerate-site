/** Default in-progress cap. Keep in sync with claim_feature_request's p_wip_limit. */
export const FEATURE_BOARD_WIP_LIMIT = 6;

export const FEATURE_STATUSES = [
  "backlog",
  "planned",
  "in_progress",
  "in_review",
  "blocked",
  "shipped",
] as const;
export const FEATURE_PRIORITIES = ["urgent", "high", "medium", "low"] as const;

export type FeatureStatus = (typeof FEATURE_STATUSES)[number];
export type FeaturePriority = (typeof FEATURE_PRIORITIES)[number];

export interface FeatureSubtask {
  id: string;
  title: string;
  done: boolean;
}

export interface FeatureRequest {
  revision?: number;
  project_key?: string;
  initiative?: string;
  parent_id?: string | null;
  work_kind?: string;
  work_spec?: Record<string, unknown>;
  work_delivery?: Record<string, unknown>;
  work_blocker?: string | null;
  readiness?: string[];
  dependencies?: string[];
  id: string;
  seed_key: string | null;
  title: string;
  description: string | null;
  /** Columns are now admin-defined (`kanban_columns`, board_key='features'),
   * not the static `FeatureStatus` union — this is any live column_key. */
  status: string;
  priority: FeaturePriority;
  labels: string[];
  sort_order: number;
  owner: string | null;
  lease_owner?: string | null;
  lease_expires_at?: string | null;
  claimed_at?: string | null;
  target_date: string | null;
  acceptance_criteria: string | null;
  notes: string | null;
  subtasks?: FeatureSubtask[] | null;
  source: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

const MAX_SUBTASKS = 40;
const MAX_SUBTASK_TITLE = 180;

export function parseAcceptanceLines(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*[-*]\s*(\[[ xX]\]\s*)?/, "").trim())
    .filter(Boolean)
    .slice(0, MAX_SUBTASKS);
}

export function cleanSubtasks(value: unknown): FeatureSubtask[] {
  if (!Array.isArray(value)) return [];
  const cleaned: FeatureSubtask[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const title = typeof row.title === "string" ? row.title.trim().slice(0, MAX_SUBTASK_TITLE) : "";
    if (!title) continue;
    const id =
      typeof row.id === "string" && row.id.trim()
        ? row.id.trim().slice(0, 64)
        : `subtask-${cleaned.length + 1}`;
    cleaned.push({ id, title, done: row.done === true });
    if (cleaned.length >= MAX_SUBTASKS) break;
  }
  return cleaned;
}

export function hydrateSubtasks(
  feature: Pick<FeatureRequest, "id" | "subtasks" | "acceptance_criteria">,
): FeatureSubtask[] {
  const stored = cleanSubtasks(feature.subtasks);
  if (stored.length) return stored;
  return parseAcceptanceLines(feature.acceptance_criteria).map((title, index) => ({
    id: `${feature.id}:acceptance:${index}`,
    title,
    done: false,
  }));
}

export function subtaskProgress(items: FeatureSubtask[]): { done: number; total: number } {
  return { done: items.filter((item) => item.done).length, total: items.length };
}

export function toggleSubtask(items: FeatureSubtask[], id: string): FeatureSubtask[] {
  return items.map((item) => (item.id === id ? { ...item, done: !item.done } : item));
}

export function renameSubtask(
  items: FeatureSubtask[],
  id: string,
  title: string,
): FeatureSubtask[] {
  const next = title.trim().slice(0, MAX_SUBTASK_TITLE);
  if (!next) return items.filter((item) => item.id !== id);
  return items.map((item) => (item.id === id ? { ...item, title: next } : item));
}

export function moveSubtask(
  items: FeatureSubtask[],
  id: string,
  direction: -1 | 1,
): FeatureSubtask[] {
  const index = items.findIndex((item) => item.id === id);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return items;
  const copy = [...items];
  const [row] = copy.splice(index, 1);
  if (!row) return items;
  copy.splice(nextIndex, 0, row);
  return copy;
}

export function remainingSubtasks(items: FeatureSubtask[]): FeatureSubtask[] {
  return items.filter((item) => !item.done);
}

export function isFeatureOverdue(feature: Pick<FeatureRequest, "target_date" | "status">): boolean {
  if (!feature.target_date || feature.status === "shipped") return false;
  return feature.target_date < new Date().toISOString().slice(0, 10);
}

export const FEATURE_STATUS_META: Record<
  FeatureStatus,
  { label: string; description: string; accent: string }
> = {
  backlog: { label: "Backlog", description: "Captured, not yet committed", accent: "bg-slate-400" },
  planned: {
    label: "Planned",
    description: "Committed; readiness checked at claim",
    accent: "bg-blue-500",
  },
  in_progress: {
    label: "In progress",
    description: "Actively being built",
    accent: "bg-amber-500",
  },
  in_review: {
    label: "In review",
    description: "Verification submitted for review",
    accent: "bg-violet-500",
  },
  blocked: { label: "Blocked", description: "Waiting on a dependency", accent: "bg-rose-500" },
  shipped: {
    label: "Verified",
    description: "Verification accepted; merge and deployment tracked separately",
    accent: "bg-emerald-500",
  },
};

export function isFeatureStatus(value: unknown): value is FeatureStatus {
  return typeof value === "string" && FEATURE_STATUSES.includes(value as FeatureStatus);
}

export function isFeaturePriority(value: unknown): value is FeaturePriority {
  return typeof value === "string" && FEATURE_PRIORITIES.includes(value as FeaturePriority);
}
