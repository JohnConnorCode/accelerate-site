"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface AdminAsyncRegionProps {
  loading: boolean;
  hasData: boolean;
  loadingFallback: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  label?: string;
  delayMs?: number;
}

/** Mount only for a data-less read so each retry starts with a fresh delay. */
function AdminLoadingFallback({
  children,
  label,
  delayMs,
}: {
  children: React.ReactNode;
  label: string;
  delayMs: number;
}) {
  const [showFallback, setShowFallback] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setShowFallback(true), delayMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [delayMs]);

  return (
    <div
      data-admin-async-state="loading"
      data-admin-async-visible={showFallback ? "true" : "false"}
      style={{ visibility: showFallback ? "visible" : "hidden" }}
      role={showFallback ? "status" : undefined}
      aria-hidden={!showFallback || undefined}
      aria-label={showFallback ? label : undefined}
    >
      {children}
    </div>
  );
}

/** One regional lifecycle. Ready data never waits for a placeholder to exit. */
export function AdminAsyncRegion({
  loading,
  hasData,
  loadingFallback,
  children,
  className,
  contentClassName,
  label = "Loading content",
  delayMs = 120,
}: AdminAsyncRegionProps) {
  return (
    <div className={cn("admin-async-region", className)} aria-busy={loading}>
      {hasData || !loading ? (
        <div
          key="ready"
          data-admin-async-state={loading ? "refreshing" : "ready"}
          className={contentClassName}
        >
          {children}
        </div>
      ) : (
        <AdminLoadingFallback label={label} delayMs={delayMs}>
          {loadingFallback}
        </AdminLoadingFallback>
      )}
    </div>
  );
}
