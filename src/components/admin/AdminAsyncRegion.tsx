"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { adminEase } from "@/lib/admin/motion";
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

/** Fast reads never flash a skeleton; slower reads crossfade locally. */
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
  const reducedMotion = useReducedMotion();
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    const resetFrame = window.requestAnimationFrame(() => setShowFallback(false));
    if (!loading || hasData) return () => window.cancelAnimationFrame(resetFrame);
    const timer = window.setTimeout(() => setShowFallback(true), delayMs);
    return () => {
      window.cancelAnimationFrame(resetFrame);
      window.clearTimeout(timer);
    };
  }, [delayMs, hasData, loading]);

  return (
    <div className={className} aria-busy={loading && !hasData} aria-live="polite">
      <AnimatePresence initial={false} mode="wait">
        {hasData ? (
          <motion.div
            key="ready"
            data-admin-async-state={loading ? "refreshing" : "ready"}
            className={cn(contentClassName)}
            initial={reducedMotion ? false : { opacity: 0, y: 8, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reducedMotion ? undefined : { opacity: 0 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.34, ease: adminEase }}
          >
            {children}
          </motion.div>
        ) : loading ? (
          <motion.div
            key="loading"
            data-admin-async-state="loading"
            data-admin-async-visible={showFallback ? "true" : "false"}
            role={showFallback ? "status" : undefined}
            aria-hidden={showFallback ? undefined : true}
            aria-label={showFallback ? label : undefined}
            initial={false}
            animate={{ opacity: showFallback ? 1 : 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.18, ease: adminEase }}
          >
            {loadingFallback}
          </motion.div>
        ) : (
          <span key="pending" className="sr-only" role="status">
            {label}
          </span>
        )}
      </AnimatePresence>
    </div>
  );
}
