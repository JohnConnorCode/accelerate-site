/**
 * localStorage persistence for the Leads page: the last-used filter/sort
 * state plus a list of named "saved views". SSR-safe — every accessor
 * guards on `typeof window` and swallows storage/JSON errors.
 */

export interface LeadsFilterState {
  statusFilter: string;
  industryFilter: string;
  dateFrom: string;
  dateTo: string;
  sortField: string;
  sortOrder: string;
}

export interface SavedLeadsView {
  id: string;
  name: string;
  filters: LeadsFilterState;
}

const LAST_STATE_KEY = "accel.admin.leads.filters";
const SAVED_VIEWS_KEY = "accel.admin.leads.savedViews";

export const DEFAULT_LEADS_FILTERS: LeadsFilterState = {
  statusFilter: "all",
  industryFilter: "all",
  dateFrom: "",
  dateTo: "",
  sortField: "created_at",
  sortOrder: "desc",
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable — persistence is best-effort.
  }
}

export function loadLastFilters(): LeadsFilterState {
  const stored = readJson<Partial<LeadsFilterState>>(LAST_STATE_KEY, {});
  return { ...DEFAULT_LEADS_FILTERS, ...stored };
}

export function saveLastFilters(state: LeadsFilterState): void {
  writeJson(LAST_STATE_KEY, state);
}

export function loadSavedViews(): SavedLeadsView[] {
  const views = readJson<SavedLeadsView[]>(SAVED_VIEWS_KEY, []);
  return Array.isArray(views) ? views.filter((v) => v && v.name && v.filters) : [];
}

export function addSavedView(name: string, filters: LeadsFilterState): SavedLeadsView[] {
  const trimmed = name.trim();
  if (!trimmed) return loadSavedViews();
  const view: SavedLeadsView = {
    id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: trimmed,
    filters,
  };
  const next = [...loadSavedViews(), view];
  writeJson(SAVED_VIEWS_KEY, next);
  return next;
}

export function removeSavedView(id: string): SavedLeadsView[] {
  const next = loadSavedViews().filter((v) => v.id !== id);
  writeJson(SAVED_VIEWS_KEY, next);
  return next;
}
