import type { RevenueStage } from "@/lib/revenue-os/types";

export type PipelineSystemViewId =
  | "all"
  | "attention"
  | "new"
  | "missing-next-action"
  | "overdue"
  | "upcoming"
  | "proposals"
  | "at-risk"
  | "recent-wins"
  | "nurture";

export type PipelineSortField = "next_action_at" | "created_at" | "estimated_value" | "name";
export type PipelineSortDirection = "asc" | "desc";
export type PipelineVisibleField = "contact" | "source" | "value" | "next_action" | "owner";
export type PipelineLayout = "board" | "list";

export interface PipelineViewOpportunity {
  id: string;
  name: string | null;
  email: string | null;
  stage: string;
  canonical_stage: RevenueStage | null;
  estimated_value: number;
  next_action: string | null;
  next_action_at: string | null;
  owner_email?: string | null;
  last_activity_at?: string | null;
  next_meeting_at?: string | null;
  closed_at?: string | null;
  updated_at?: string | null;
  created_at: string;
  contact?: { full_name: string; primary_email: string | null } | null;
  company?: { name: string; domain: string | null } | null;
}

export interface PipelineViewState {
  systemView: PipelineSystemViewId;
  stage: RevenueStage | "all";
  search: string;
  owner: string;
  sortField: PipelineSortField;
  sortDirection: PipelineSortDirection;
  visibleFields: PipelineVisibleField[];
  layout: PipelineLayout;
}

export interface SavedPipelineView {
  id: string;
  name: string;
  state: PipelineViewState;
}

export interface PipelineSystemView {
  id: PipelineSystemViewId;
  label: string;
  description: string;
}

export const SYSTEM_PIPELINE_VIEWS: readonly PipelineSystemView[] = [
  { id: "all", label: "All", description: "Every canonical opportunity" },
  { id: "attention", label: "Needs attention", description: "Open work that is overdue, due soon, or missing a next action" },
  { id: "new", label: "New inquiries", description: "Unworked opportunities in the New stage" },
  { id: "missing-next-action", label: "No next action", description: "Open opportunities without a specific next step and date" },
  { id: "overdue", label: "Overdue", description: "Open opportunities with a next action in the past" },
  { id: "upcoming", label: "Coming up", description: "A next action or meeting falls within the next seven days" },
  { id: "proposals", label: "Proposals", description: "Proposal and negotiation work" },
  { id: "at-risk", label: "At risk", description: "Active opportunities quiet for at least fourteen days with no near-term meeting" },
  { id: "recent-wins", label: "Recent wins", description: "Won opportunities closed in the last thirty days" },
  { id: "nurture", label: "Nurture", description: "Opportunities intentionally waiting for a later cycle" },
] as const;

export const PIPELINE_VISIBLE_FIELDS: readonly { id: PipelineVisibleField; label: string }[] = [
  { id: "contact", label: "Contact" },
  { id: "source", label: "Source" },
  { id: "value", label: "Value" },
  { id: "next_action", label: "Next action" },
  { id: "owner", label: "Owner" },
] as const;

export const DEFAULT_PIPELINE_VIEW: PipelineViewState = {
  systemView: "all",
  stage: "all",
  search: "",
  owner: "all",
  sortField: "next_action_at",
  sortDirection: "asc",
  visibleFields: ["contact", "source", "value", "next_action"],
  layout: "board",
};

const LAST_VIEW_KEY = "accelerate:pipeline-view-state:v1";
const SAVED_VIEWS_KEY = "accelerate:pipeline-saved-views:v1";
const OPEN_STAGES = new Set<RevenueStage>(["new", "contacted", "qualified", "meeting", "proposal", "negotiation", "nurture"]);
const SYSTEM_VIEW_IDS = new Set(SYSTEM_PIPELINE_VIEWS.map((view) => view.id));
const SORT_FIELDS = new Set<PipelineSortField>(["next_action_at", "created_at", "estimated_value", "name"]);
const VISIBLE_FIELDS = new Set(PIPELINE_VISIBLE_FIELDS.map((field) => field.id));

function stageOf(item: PipelineViewOpportunity): RevenueStage | null {
  return item.canonical_stage;
}

function timestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function isOpen(item: PipelineViewOpportunity): boolean {
  const stage = stageOf(item);
  return stage ? OPEN_STAGES.has(stage) : false;
}

function isWithin(value: string | null | undefined, start: number, end: number): boolean {
  const time = timestamp(value);
  return time !== null && time >= start && time <= end;
}

export function matchesPipelineSystemView(item: PipelineViewOpportunity, view: PipelineSystemViewId, now = new Date()): boolean {
  const nowTime = now.getTime();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const fourteenDays = 14 * 24 * 60 * 60 * 1000;
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const stage = stageOf(item);
  const nextActionTime = timestamp(item.next_action_at);
  const hasCompleteNextAction = Boolean(item.next_action?.trim()) && nextActionTime !== null;
  const overdue = isOpen(item) && nextActionTime !== null && nextActionTime < nowTime;
  const dueSoon = isOpen(item) && (
    isWithin(item.next_action_at, nowTime, nowTime + sevenDays)
    || isWithin(item.next_meeting_at, nowTime, nowTime + sevenDays)
  );

  switch (view) {
    case "all": return true;
    case "attention": return isOpen(item) && (!hasCompleteNextAction || overdue || dueSoon);
    case "new": return stage === "new";
    case "missing-next-action": return isOpen(item) && !hasCompleteNextAction;
    case "overdue": return overdue;
    case "upcoming": return dueSoon;
    case "proposals": return stage === "proposal" || stage === "negotiation";
    case "at-risk": {
      if (!isOpen(item) || stage === "nurture") return false;
      const lastSignal = timestamp(item.last_activity_at) ?? timestamp(item.created_at);
      const meetingSoon = isWithin(item.next_meeting_at, nowTime, nowTime + sevenDays);
      return lastSignal !== null && lastSignal < nowTime - fourteenDays && !meetingSoon;
    }
    case "recent-wins": {
      const closed = timestamp(item.closed_at) ?? timestamp(item.updated_at);
      return stage === "won" && closed !== null && closed >= nowTime - thirtyDays && closed <= nowTime;
    }
    case "nurture": return stage === "nurture";
  }
}

function compareNullable(a: number | null, b: number | null, direction: PipelineSortDirection): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return direction === "asc" ? a - b : b - a;
}

export function applyPipelineView<T extends PipelineViewOpportunity>(items: readonly T[], state: PipelineViewState, now = new Date()): T[] {
  const query = state.search.trim().toLowerCase();
  const filtered = items.filter((item) => {
    if (!matchesPipelineSystemView(item, state.systemView, now)) return false;
    if (state.stage !== "all" && stageOf(item) !== state.stage) return false;
    if (state.owner !== "all" && (item.owner_email || "unassigned") !== state.owner) return false;
    if (!query) return true;
    return [item.id, item.name, item.email, item.contact?.full_name, item.company?.name, item.company?.domain]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  return filtered.sort((a, b) => {
    let result = 0;
    if (state.sortField === "estimated_value") {
      result = state.sortDirection === "asc"
        ? Number(a.estimated_value || 0) - Number(b.estimated_value || 0)
        : Number(b.estimated_value || 0) - Number(a.estimated_value || 0);
    } else if (state.sortField === "name") {
      const aName = a.name || a.company?.name || "";
      const bName = b.name || b.company?.name || "";
      result = state.sortDirection === "asc" ? aName.localeCompare(bName) : bName.localeCompare(aName);
    } else {
      result = compareNullable(timestamp(a[state.sortField]), timestamp(b[state.sortField]), state.sortDirection);
    }
    return result || a.id.localeCompare(b.id);
  });
}

export function countPipelineSystemViews(items: readonly PipelineViewOpportunity[], now = new Date()): Record<PipelineSystemViewId, number> {
  return Object.fromEntries(SYSTEM_PIPELINE_VIEWS.map((view) => [view.id, items.filter((item) => matchesPipelineSystemView(item, view.id, now)).length])) as Record<PipelineSystemViewId, number>;
}

function normalizeState(value: unknown): PipelineViewState {
  if (!value || typeof value !== "object") return { ...DEFAULT_PIPELINE_VIEW };
  const candidate = value as Partial<PipelineViewState>;
  const visibleFields = Array.isArray(candidate.visibleFields)
    ? candidate.visibleFields.filter((field): field is PipelineVisibleField => VISIBLE_FIELDS.has(field as PipelineVisibleField))
    : DEFAULT_PIPELINE_VIEW.visibleFields;
  return {
    systemView: SYSTEM_VIEW_IDS.has(candidate.systemView as PipelineSystemViewId) ? candidate.systemView as PipelineSystemViewId : "all",
    stage: candidate.stage === "all" || ["new", "contacted", "qualified", "meeting", "proposal", "negotiation", "won", "lost", "nurture"].includes(String(candidate.stage)) ? candidate.stage as PipelineViewState["stage"] : "all",
    search: typeof candidate.search === "string" ? candidate.search.slice(0, 200) : "",
    owner: typeof candidate.owner === "string" ? candidate.owner.slice(0, 320) : "all",
    sortField: SORT_FIELDS.has(candidate.sortField as PipelineSortField) ? candidate.sortField as PipelineSortField : DEFAULT_PIPELINE_VIEW.sortField,
    sortDirection: candidate.sortDirection === "desc" ? "desc" : "asc",
    visibleFields: visibleFields.length ? visibleFields : DEFAULT_PIPELINE_VIEW.visibleFields,
    layout: candidate.layout === "list" ? "list" : "board",
  };
}

function readJson(key: string): unknown {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(key) || "null") as unknown;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Persistence is best-effort. The active in-memory view remains usable.
  }
}

export function loadLastPipelineView(): PipelineViewState {
  return normalizeState(readJson(LAST_VIEW_KEY));
}

export function hasLastPipelineView(): boolean {
  return typeof window !== "undefined" && window.localStorage.getItem(LAST_VIEW_KEY) !== null;
}

export function saveLastPipelineView(state: PipelineViewState): void {
  writeJson(LAST_VIEW_KEY, normalizeState(state));
}

export function loadSavedPipelineViews(): SavedPipelineView[] {
  const value = readJson(SAVED_VIEWS_KEY);
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<SavedPipelineView>;
    if (typeof candidate.id !== "string" || typeof candidate.name !== "string" || !candidate.name.trim()) return [];
    return [{ id: candidate.id, name: candidate.name.trim().slice(0, 60), state: normalizeState(candidate.state) }];
  });
}

export function savePipelineView(name: string, state: PipelineViewState): SavedPipelineView[] {
  const trimmed = name.trim().slice(0, 60);
  if (!trimmed) return loadSavedPipelineViews();
  const existing = loadSavedPipelineViews();
  const view: SavedPipelineView = {
    id: `pipeline-view-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: trimmed,
    state: normalizeState(state),
  };
  const next = [...existing.filter((item) => item.name.toLowerCase() !== trimmed.toLowerCase()), view].slice(-20);
  writeJson(SAVED_VIEWS_KEY, next);
  return next;
}

export function removePipelineView(id: string): SavedPipelineView[] {
  const next = loadSavedPipelineViews().filter((view) => view.id !== id);
  writeJson(SAVED_VIEWS_KEY, next);
  return next;
}
