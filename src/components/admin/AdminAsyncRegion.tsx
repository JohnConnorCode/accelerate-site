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
  const [showFallback, setShowFallback] = useState(false);
  useEffect(() => {
    if (hasData || !loading) return;
    const reset = requestAnimationFrame(() => setShowFallback(false));
    const timer = window.setTimeout(() => setShowFallback(true), delayMs);
    return () => {
      cancelAnimationFrame(reset);
      window.clearTimeout(timer);
    };
  }, [delayMs, hasData, loading]);

  return (
    <div className={cn("admin-async-region", className)} aria-busy={loading}>
      {hasData ? (
        <div
          key="ready"
          data-admin-async-state={loading ? "refreshing" : "ready"}
          className={contentClassName}
        >
          {children}
        </div>
      ) : loading ? (
        <div
          key="loading"
          data-admin-async-state="loading"
          data-admin-async-visible={showFallback ? "true" : "false"}
          style={{ visibility: showFallback ? "visible" : "hidden" }}
          role={showFallback ? "status" : undefined}
          aria-hidden={!showFallback || undefined}
          aria-label={showFallback ? label : undefined}
        >
          {loadingFallback}
        </div>
      ) : null}
    </div>
  );
}
