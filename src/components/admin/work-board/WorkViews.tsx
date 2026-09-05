"use client";
import { useState } from "react";
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
};
export const WORK_QUEUES = [
  { key: "all", label: "All work" },
  { key: "ready", label: "Ready to claim" },
  { key: "blocked", label: "Blocked" },
  { key: "review", label: "Needs review" },
  { key: "stale", label: "Expired claims" },
  { key: "unmerged", label: "Verified · merge unrecorded" },
];
export function WorkViews({
  filters,
  onChange,
}: {
  filters: WorkFilters;
  onChange: (filters: WorkFilters) => void;
}) {
  const query = useAdminQuery<{
    views: { id: string; name: string; shared: boolean; filters: WorkFilters }[];
  }>(["admin", "work-views"], "/api/admin/features/views");
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
      <div className="flex flex-wrap gap-2">
        {WORK_QUEUES.map((q) => (
          <button
            type="button"
            key={q.key}
            onClick={() => onChange({ ...filters, queue: q.key, milestone: "all" })}
            aria-pressed={filters.queue === q.key}
            className={`min-h-10 rounded-xl border px-3 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)] ${filters.queue === q.key ? "border-[var(--admin-accent)] bg-[var(--admin-accent-soft)]" : "border-[var(--admin-border)]"}`}
          >
            {q.label}
          </button>
        ))}
      </div>
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
            className="min-h-11 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm"
          />
          <label className="flex min-h-11 items-center gap-2 text-xs">
            <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
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
    </div>
  );
}
