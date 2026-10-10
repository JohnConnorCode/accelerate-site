"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react";
import {
  useToasts,
  dismiss,
  pauseToasts,
  resumeToasts,
  type ToastKind,
} from "@/lib/admin/useToast";
import { cn } from "@/lib/utils";

const KIND_STYLES: Record<ToastKind, { bar: string; icon: typeof CheckCircle2 }> = {
  success: { bar: "border-l-green-500", icon: CheckCircle2 },
  error: { bar: "border-l-red-500", icon: AlertCircle },
  warning: { bar: "border-l-yellow-500", icon: AlertTriangle },
  info: { bar: "border-l-blue-500", icon: Info },
};

export function Toaster() {
  const toasts = useToasts();
  const reducedMotion = useReducedMotion();
  const regionRef = useRef<HTMLDivElement>(null);
  useEffect(() => () => resumeToasts(), []);
  useEffect(() => {
    if (toasts.length === 0) {
      resumeToasts();
      return;
    }
    // Removing a focused toast can lose its blur/leave events. Reconcile the
    // real interaction state when attention moves elsewhere or feedback changes.
    const resumeIfOutside = () => {
      const region = regionRef.current;
      if (region && !region.contains(document.activeElement) && !region.matches(":hover"))
        resumeToasts();
    };
    document.addEventListener("focusin", resumeIfOutside);
    document.addEventListener("pointermove", resumeIfOutside, { passive: true });
    resumeIfOutside();
    return () => {
      document.removeEventListener("focusin", resumeIfOutside);
      document.removeEventListener("pointermove", resumeIfOutside);
    };
  }, [toasts.length]);

  return (
    <div
      ref={regionRef}
      className="admin-toast-region pointer-events-none fixed inset-x-4 z-[300] flex w-auto max-w-sm flex-col gap-2 sm:left-auto sm:w-full"
      aria-live="polite"
      aria-atomic="false"
      onPointerEnter={pauseToasts}
      onPointerLeave={(event) => {
        if (!event.currentTarget.contains(document.activeElement)) resumeToasts();
      }}
      onFocus={pauseToasts}
      onBlur={(event) => {
        if (
          !event.currentTarget.contains(event.relatedTarget) &&
          !event.currentTarget.matches(":hover")
        )
          resumeToasts();
      }}
    >
      <AnimatePresence
        initial={false}
        onExitComplete={() => {
          // Removing a focused control need not emit blur in every browser.
          const region = regionRef.current;
          if (
            region &&
            (toasts.length === 0 ||
              (!region.contains(document.activeElement) && !region.matches(":hover")))
          )
            resumeToasts();
        }}
      >
        {toasts.map((t) => {
          const styles = KIND_STYLES[t.kind];
          const Icon = styles.icon;
          return (
            <motion.div
              key={t.id}
              layout={reducedMotion ? false : "position"}
              initial={
                reducedMotion ? false : { opacity: 0, y: 8, scale: 0.985, filter: "blur(4px)" }
              }
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={
                reducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 4, scale: 0.99, filter: "blur(3px)" }
              }
              transition={{ duration: reducedMotion ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "admin-toast pointer-events-auto flex items-start gap-3 rounded-[var(--admin-control-radius)] border border-l-2 px-3 py-3",
                styles.bar,
              )}
              role={t.kind === "error" ? "alert" : "status"}
            >
              <Icon
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-muted)]"
              />
              <p className="min-w-0 flex-1 text-pretty text-sm text-[var(--admin-ink)]">
                {t.message}
              </p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="admin-toast-dismiss"
                aria-label={`Dismiss: ${t.message}`}
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
