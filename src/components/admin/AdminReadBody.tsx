"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { AdminAsyncRegion } from "@/components/admin/AdminAsyncRegion";
import { AdminSurface } from "@/components/admin/AdminSurface";

interface AdminReadBodyProps {
  loading: boolean;
  hasData: boolean;
  error?: string;
  onRetry?: () => void;
  refreshing?: boolean;
  loadingFallback: React.ReactNode;
  label?: string;
  children: React.ReactNode;
}

/** Keeps page identity mounted. Fast reads skip the skeleton; failures stay
 * distinct from empty data; a refetch never blanks a useful snapshot. */
export function AdminReadBody({
  loading,
  hasData,
  error,
  onRetry,
  refreshing,
  loadingFallback,
  label,
  children,
}: AdminReadBodyProps) {
  if (!hasData && error && !loading) {
    return (
      <AdminSurface tone="attention" className="mx-auto flex max-w-2xl flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-300">
          <TriangleAlert className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-[var(--admin-ink)]">This workspace could not be loaded</h2>
          <p className="admin-copy mt-1 text-sm">{error} Filters and drafts were not discarded.</p>
          {onRetry && (
            <button
              type="button"
              onClick={() => void onRetry()}
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--admin-ink)] px-4 text-xs font-semibold text-[var(--admin-surface)]"
            >
              <RefreshCw className="size-3.5" /> Retry
            </button>
          )}
        </div>
      </AdminSurface>
    );
  }

  return (
    <div className="admin-read-body">
      {error && hasData && (
        <AdminSurface tone="attention" className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <TriangleAlert className="size-5 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--admin-ink)]">Showing the last successful snapshot</p>
            <p className="admin-copy mt-0.5 text-xs">{error} Existing data remains visible.</p>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={() => void onRetry()}
              disabled={refreshing}
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] disabled:opacity-60"
            >
              <RefreshCw className={refreshing ? "size-3.5 animate-spin" : "size-3.5"} /> Retry
            </button>
          )}
        </AdminSurface>
      )}
      <AdminAsyncRegion loading={loading} hasData={hasData} loadingFallback={loadingFallback} label={label} contentClassName="admin-content-stack">
        {children}
      </AdminAsyncRegion>
    </div>
  );
}
