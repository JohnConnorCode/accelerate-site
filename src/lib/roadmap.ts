import {
  FEATURE_PRIORITIES,
  FEATURE_STATUSES,
  isFeaturePriority,
  type FeaturePriority,
  type FeatureStatus,
} from "@/lib/feature-board";

export const ACTIVE_ROADMAP_STATUSES: FeatureStatus[] = ["in_progress", "planned", "blocked"];

export const ROADMAP_STATUS_FILTERS = ["active", "all", ...FEATURE_STATUSES] as const;
export type RoadmapStatusFilter = (typeof ROADMAP_STATUS_FILTERS)[number];

export interface PublicRoadmapCard {
  seedKey: string;
  title: string;
  description: string;
  status: FeatureStatus;
  priority: FeaturePriority;
  category: string | null;
  capabilities: string[];
  acceptance: string[];
  ready: boolean;
}

export interface RoadmapFilters {
  query: string;
  status: RoadmapStatusFilter;
  category: string | null;
  priority: FeaturePriority | null;
  readyOnly: boolean;
}

export const DEFAULT_ROADMAP_FILTERS: RoadmapFilters = {
  query: "",
  status: "active",
  category: null,
  priority: null,
  readyOnly: false,
};

export function isRoadmapStatusFilter(value: unknown): value is RoadmapStatusFilter {
  return typeof value === "string" && ROADMAP_STATUS_FILTERS.includes(value as RoadmapStatusFilter);
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function readParam(
  source: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string,
): string {
  if (source instanceof URLSearchParams) return source.get(key) ?? "";
  return firstParam(source[key]);
}

export function parseRoadmapSearchParams(
  source: URLSearchParams | Record<string, string | string[] | undefined>,
): RoadmapFilters {
  const query = readParam(source, "q").trim();
  const statusRaw = readParam(source, "status").trim();
  const categoryRaw = readParam(source, "category").trim();
  const priorityRaw = readParam(source, "priority").trim();
  const readyRaw = readParam(source, "ready").trim();

  return {
    query,
    status: isRoadmapStatusFilter(statusRaw) ? statusRaw : DEFAULT_ROADMAP_FILTERS.status,
    category: categoryRaw || null,
    priority: isFeaturePriority(priorityRaw) ? priorityRaw : null,
    readyOnly: readyRaw === "1" || readyRaw === "true",
  };
}

export function serializeRoadmapSearchParams(filters: RoadmapFilters): string {
  const params = new URLSearchParams();
  const query = filters.query.trim();
  if (query) params.set("q", query);
  if (filters.status !== DEFAULT_ROADMAP_FILTERS.status) params.set("status", filters.status);
  if (filters.category) params.set("category", filters.category);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.readyOnly) params.set("ready", "1");
  return params.toString();
}

export function roadmapFiltersAreDefault(filters: RoadmapFilters): boolean {
  return (
    filters.query.trim() === "" &&
    filters.status === DEFAULT_ROADMAP_FILTERS.status &&
    filters.category === null &&
    filters.priority === null &&
    filters.readyOnly === false
  );
}

function haystack(card: PublicRoadmapCard): string {
  return [
    card.title,
    card.description,
    card.seedKey,
    card.category ?? "",
    card.priority,
    card.status.replace("_", " "),
    ...card.capabilities,
    ...card.acceptance,
  ]
    .join("\n")
    .toLowerCase();
}

export function cardMatchesStatus(card: PublicRoadmapCard, status: RoadmapStatusFilter): boolean {
  if (status === "all") return true;
  if (status === "active") return ACTIVE_ROADMAP_STATUSES.includes(card.status);
  return card.status === status;
}

export function cardMatchesQuery(card: PublicRoadmapCard, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const hay = haystack(card);
  return normalized.split(/\s+/).every((term) => hay.includes(term));
}

export function filterRoadmapCards(
  cards: PublicRoadmapCard[],
  filters: RoadmapFilters,
): PublicRoadmapCard[] {
  return cards.filter((card) => {
    if (!cardMatchesStatus(card, filters.status)) return false;
    if (filters.category && card.category !== filters.category) return false;
    if (filters.priority && card.priority !== filters.priority) return false;
    if (filters.readyOnly && !card.ready) return false;
    return cardMatchesQuery(card, filters.query);
  });
}

export function countRoadmapByStatus(
  cards: PublicRoadmapCard[],
): Record<FeatureStatus, number> & { active: number; all: number } {
  const counts = {
    all: cards.length,
    active: 0,
    backlog: 0,
    planned: 0,
    in_progress: 0,
    blocked: 0,
    shipped: 0,
  };
  for (const card of cards) {
    counts[card.status] += 1;
    if (ACTIVE_ROADMAP_STATUSES.includes(card.status)) counts.active += 1;
  }
  return counts;
}

export function uniqueRoadmapCategories(cards: PublicRoadmapCard[]): string[] {
  return [...new Set(cards.map((card) => card.category).filter((value): value is string => Boolean(value)))].sort(
    (a, b) => a.localeCompare(b),
  );
}

const STATUS_SECTION_ORDER: FeatureStatus[] = [
  "in_progress",
  "planned",
  "blocked",
  "backlog",
  "shipped",
];

export function groupRoadmapByStatus(
  cards: PublicRoadmapCard[],
): Array<{ status: FeatureStatus; cards: PublicRoadmapCard[] }> {
  return STATUS_SECTION_ORDER.map((status) => ({
    status,
    cards: cards.filter((card) => card.status === status),
  })).filter((group) => group.cards.length > 0);
}

export const ROADMAP_PRIORITY_ORDER: FeaturePriority[] = [...FEATURE_PRIORITIES];
