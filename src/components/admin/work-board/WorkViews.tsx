"use client";
import { NORTHSTAR_PHASES } from "@/lib/work-packet";
import { useState, type ReactNode } from "react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { SlidersHorizontal, X } from "lucide-react";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { fetchJson } from "@/lib/admin/fetchJson";
import { toast } from "@/lib/admin/useToast";
export type WorkFilters = {
  search: string;
  milestone: string;
  category: string;
  capability: string;
  ownerFilter: string;
  priority: string;
  queue: string;
  phase?: string;
  initiative?: string;
};
export const WORK_QUEUES = [
  { key: "all", label: "All work" },
  { key: "ready", label: "Ready to claim" },
  { key: "specification", label: "Needs specification" },
  { key: "blocked", label: "Blocked" },
  { key: "review", label: "Needs review" },
  { key: "stale", label: "Expired claims" },
  { key: "unmerged", label: "Awaiting integration / proof" },
];
export function WorkViews({
  filters,
  onChange,
  initiatives = [],
  children,
}: {
  filters: WorkFilters;
  children?: ReactNode;
  initiatives?: string[];
  onChange: (filters: WorkFilters) => void;
}) {
  const query = useAdminQuery<{
    views: { id: string; name: string; shared: boolean; filters: WorkFilters }[];
  }>(["admin", "work-views"], "/api/admin/features/views");
  const [open, setOpen] = useState(false);
  const active = Object.entries(filters).filter(
    ([key, value]) => !["search", "queue"].includes(key) && value && value !== "all",
  );
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const save = async () => {
    try {
      await fetchJson("/api/admin/features/views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, shared, filters }),
      });
      setName("");
      await query.refetch();
      toast.success("View saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save view");
    }
  };
  return (
    <div className="space-y-3" aria-label="Saved work views">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Work view"
          value={filters.queue}
          onChange={(event) =>
            onChange({ ...filters, queue: event.target.value, milestone: "all" })
          }
          className="admin-field admin-field--inline min-h-11 min-w-0 flex-1 rounded-[var(--admin-control-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm sm:flex-none"
        >
          {WORK_QUEUES.map((view) => (
            <option key={view.key} value={view.key}>
              {view.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className="inline-flex min-h-11 items-center gap-2 rounded-[var(--admin-control-radius)] border border-[var(--admin-border)] px-3 text-sm"
        >
          <SlidersHorizontal size={16} />
          Filters{active.length > 0 && <span className="tabular-nums">{active.length}</span>}
        </button>
        {active.map(([key, value]) => (
          <button
            type="button"
            key={key}
            aria-label={`Remove ${key} filter`}
            onClick={() => onChange({ ...filters, [key]: "all" })}
            className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-full bg-[var(--admin-surface-subtle)] px-3 text-xs"
          >
            <span className="truncate">
              {value === "active"
                ? "Now + Next"
                : String(value)
                    .replace(/^[^:]+:/, "")
                    .replace(/-/g, " ")}
            </span>
            <X size={12} />
          </button>
        ))}
      </div>
      <AdminDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Filter work"
        maxWidth="lg"
        className="rounded-2xl bg-[var(--admin-surface)] text-[var(--admin-ink)] shadow-2xl"
      >
        <div className="space-y-5 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Filter work</h2>
            <button
              type="button"
              aria-label="Close filters"
              onClick={() => setOpen(false)}
              className="grid min-h-11 min-w-11 place-items-center rounded-lg hover:bg-[var(--admin-surface-subtle)]"
            >
              <X size={18} />
            </button>
          </div>
          {children}
          <div className="flex flex-wrap gap-3">
            <label className="flex min-w-0 flex-1 flex-col gap-2 text-xs">
              North star phase
              <select
                aria-label="North star phase"
                value={filters.phase ?? "all"}
                onChange={(e) => onChange({ ...filters, phase: e.target.value })}
                className="admin-field min-h-11 min-w-0 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3"
              >
                <option value="all">All phases</option>
                {Object.entries(NORTHSTAR_PHASES).map(([key, name]) => (
                  <option key={key} value={key}>
                    {key} · {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-2 text-xs">
              Initiative
              <select
                aria-label="Initiative"
                value={filters.initiative ?? "all"}
                onChange={(e) => onChange({ ...filters, initiative: e.target.value })}
                className="admin-field min-h-11 min-w-0 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3"
              >
                <option value="all">All initiatives</option>
                {initiatives.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {filters.queue === "unmerged" && (
            <p className="text-xs text-[var(--admin-muted)]">
              Delivery evidence is unrecorded. Inspect historical receipts before assuming work is
              unmerged or undeployed.
            </p>
          )}
          <details>
            <summary className="min-h-10 cursor-pointer py-2 text-xs font-semibold">
              Saved views and sharing
            </summary>
            <div className="flex flex-wrap gap-2">
              {query.data?.views.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center rounded-xl border border-[var(--admin-border)]"
                >
                  <button
                    type="button"
                    className="min-h-10 px-3 text-xs"
                    onClick={() => onChange(v.filters)}
                  >
                    {v.name}
                    {v.shared ? " · shared" : " · private"}
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete saved view ${v.name}`}
                    className="min-h-10 px-3 text-xs"
                    onClick={() =>
                      void fetchJson("/api/admin/features/views", {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: v.id }),
                      })
                        .then(() => query.refetch())
                        .catch((e) => toast.error(e.message))
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                aria-label="View name"
                placeholder="Name this view"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="admin-field admin-field--inline min-h-11 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm"
              />
              <label className="flex min-h-11 items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={shared}
                  onChange={(e) => setShared(e.target.checked)}
                />
                Share with operators
              </label>
              <button
                type="button"
                disabled={!name.trim()}
                onClick={() => void save()}
                className="min-h-11 rounded-xl border border-[var(--admin-border)] px-4 text-xs font-semibold disabled:opacity-40"
              >
                Save current view
              </button>
              <button
                type="button"
                className="min-h-11 rounded-xl border border-[var(--admin-border)] px-4 text-xs"
                onClick={() => {
                  const url = new URL(location.href);
                  url.searchParams.set("filters", JSON.stringify(filters));
                  void navigator.clipboard
                    .writeText(url.toString())
                    .then(() => toast.success("View link copied"))
                    .catch(() => toast.error("Clipboard unavailable"));
                }}
              >
                Copy view link
              </button>
            </div>
          </details>
          <div className="flex items-center justify-between gap-3 border-t border-[var(--admin-border)] pt-4">
            <button
              type="button"
              className="min-h-11 px-3 text-sm"
              onClick={() =>
                onChange({
                  ...filters,
                  milestone: "all",
                  category: "all",
                  capability: "all",
                  ownerFilter: "all",
                  priority: "all",
                  phase: "all",
                  initiative: "all",
                })
              }
            >
              Clear filters
            </button>
            <button
              type="button"
              className="min-h-11 rounded-lg bg-[var(--admin-action)] px-5 text-sm font-semibold text-[var(--admin-action-ink)]"
              onClick={() => setOpen(false)}
            >
              Show results
            </button>
          </div>
        </div>
      </AdminDialog>
    </div>
  );
}
