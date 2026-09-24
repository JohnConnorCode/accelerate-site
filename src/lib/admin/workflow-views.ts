export type WorkflowLayout = "list" | "board" | "calendar";

export interface WorkflowViewDescriptor<T> {
  id: string;
  label: string;
  layouts: readonly WorkflowLayout[];
  fields: readonly { id: string; label: string }[];
  groupBy: { label: string; values: readonly { id: string; label: string }[] };
  sortBy: readonly { id: string; label: string }[];
  filters: readonly { id: string; label: string }[];
  title(item: T): string;
  dueDate(item: T): string | null;
  status(item: T): string;
  summary?(item: T): string | null;
}

export interface WorkflowViewPreference {
  layout: WorkflowLayout;
  visibleFields: string[];
  filters?: Record<string, string>;
}

export function normalizeWorkflowPreference(
  value: unknown,
  descriptor: Pick<WorkflowViewDescriptor<unknown>, "layouts" | "fields" | "filters">,
  fallback: WorkflowViewPreference = {
    layout: descriptor.layouts[0] ?? "list",
    visibleFields: descriptor.fields.map((field) => field.id),
  },
): WorkflowViewPreference {
  const raw = value && typeof value === "object" ? (value as Partial<WorkflowViewPreference>) : {};
  const visibleFields = Array.isArray(raw.visibleFields)
    ? raw.visibleFields.filter(
        (id): id is string =>
          typeof id === "string" && descriptor.fields.some((field) => field.id === id),
      )
    : fallback.visibleFields;
  const filters =
    raw.filters && typeof raw.filters === "object"
      ? Object.fromEntries(
          Object.entries(raw.filters)
            .filter(
              ([id, value]) =>
                descriptor.filters.some((filter) => filter.id === id) && typeof value === "string",
            )
            .map(([id, value]) => [id, (value as string).slice(0, 200)]),
        )
      : undefined;
  return {
    layout:
      typeof raw.layout === "string" && descriptor.layouts.includes(raw.layout as WorkflowLayout)
        ? (raw.layout as WorkflowLayout)
        : fallback.layout,
    visibleFields: visibleFields.length ? [...new Set(visibleFields)] : fallback.visibleFields,
    ...(filters ? { filters } : {}),
  };
}

function preferenceKey(scope: string, descriptorId: string) {
  return `accelerate:workflow-view:v1:${encodeURIComponent(scope)}:${encodeURIComponent(descriptorId)}`;
}

export function readWorkflowPreference<T>(
  scope: string,
  descriptor: WorkflowViewDescriptor<T>,
): WorkflowViewPreference {
  const fallback = {
    layout: descriptor.layouts[0] ?? "list",
    visibleFields: descriptor.fields.map((field) => field.id),
  };
  if (typeof window === "undefined" || !scope) return fallback;
  try {
    const raw = window.localStorage.getItem(preferenceKey(scope, descriptor.id));
    return raw ? normalizeWorkflowPreference(JSON.parse(raw), descriptor, fallback) : fallback;
  } catch {
    return fallback;
  }
}

export function writeWorkflowPreference<T>(
  scope: string,
  descriptor: WorkflowViewDescriptor<T>,
  value: WorkflowViewPreference,
) {
  if (typeof window === "undefined" || !scope) return;
  try {
    window.localStorage.setItem(
      preferenceKey(scope, descriptor.id),
      JSON.stringify(normalizeWorkflowPreference(value, descriptor)),
    );
  } catch {
    // The view remains usable for this page when browser storage is unavailable.
  }
}

/** Keep DATE values as local calendar days; only timestamp values are converted
 *  from instants into the viewer's local day. */
export function workflowDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year!, month! - 1, day!);
    return date.getFullYear() === year && date.getMonth() === month! - 1 && date.getDate() === day
      ? value
      : null;
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function workflowDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function workflowCalendarDays(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first.getFullYear(), first.getMonth(), first.getDate() - first.getDay());
  const count =
    Math.ceil(
      (first.getDay() + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7,
    ) * 7;
  return Array.from(
    { length: count },
    (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index),
  );
}
