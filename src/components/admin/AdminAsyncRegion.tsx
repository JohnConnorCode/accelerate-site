"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { adminEase } from "@/lib/admin/motion";

interface AdminAsyncRegionProps {
  loading: boolean;
  hasData: boolean;
  loadingFallback: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  label?: string;
  delayMs?: number;
}

/** Fast reads never flash a skeleton; slower reads crossfade locally. */
export function AdminAsyncRegion({ loading, hasData, loadingFallback, children, className, label = "Loading content", delayMs = 120 }: AdminAsyncRegionProps) {
  const reducedMotion = useReducedMotion();

  return (
    <div className={className} aria-busy={loading && !hasData} aria-live="polite">
      <AnimatePresence initial={false} mode="wait">
        {hasData ? (
          <motion.div key="ready" data-admin-async-state={loading ? "refreshing" : "ready"} initial={reducedMotion ? false : { opacity: 0, y: 8, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={reducedMotion ? undefined : { opacity: 0 }} transition={reducedMotion ? { duration: 0 } : { duration: 0.34, ease: adminEase }}>
            {children}
          </motion.div>
        ) : loading ? (
          <motion.div key="loading" data-admin-async-state="loading" role="status" aria-label={label} initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.18, delay: reducedMotion ? 0 : delayMs / 1000 }}>
            {loadingFallback}
          </motion.div>
        ) : <span key="pending" className="sr-only" role="status">{label}</span>}
      </AnimatePresence>
    </div>
  );
}
