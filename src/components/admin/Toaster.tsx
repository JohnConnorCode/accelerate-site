"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { useToasts, dismiss, type ToastKind } from "@/lib/admin/useToast";
import { cn } from "@/lib/utils";

const KIND_STYLES: Record<ToastKind, { bar: string; icon: typeof CheckCircle2 }> = {
  success: { bar: "border-l-green-500", icon: CheckCircle2 },
  error: { bar: "border-l-red-500", icon: AlertCircle },
  warning: { bar: "border-l-yellow-500", icon: AlertTriangle },
  info: { bar: "border-l-blue-500", icon: Info },
};

export function Toaster() {
  const toasts = useToasts();

  return (
    <div
      className="admin-toast-region pointer-events-none fixed inset-x-4 z-[300] flex w-auto max-w-sm flex-col gap-2 sm:left-auto sm:w-full"
      aria-live="polite"
      aria-atomic="false"
    >
      <AnimatePresence>
        {toasts.map((t) => {
          const styles = KIND_STYLES[t.kind];
          const Icon = styles.icon;
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 10, scale: 0.985, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 8, scale: 0.985, filter: "blur(3px)" }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "admin-toast pointer-events-auto flex items-start gap-3 rounded-[var(--admin-control-radius)] border border-l-2 px-3 py-2.5",
                styles.bar,
              )}
              role={t.kind === "error" ? "alert" : "status"}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-muted)]" />
              <p className="flex-1 text-sm text-[var(--admin-ink)]">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                className="cursor-pointer text-[var(--admin-muted)] transition-colors hover:text-[var(--admin-ink)]"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
