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
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2"
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
              initial={{ opacity: 0, x: 24, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className={cn(
                "pointer-events-auto flex items-start gap-3 rounded-lg border border-l-2 border-border-glass bg-bg-elevated px-3 py-2.5 shadow-xl",
                styles.bar,
              )}
              role={t.kind === "error" ? "alert" : "status"}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-white-secondary" />
              <p className="flex-1 text-sm text-white-primary">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                className="text-white-muted transition-colors hover:text-white-primary cursor-pointer"
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
