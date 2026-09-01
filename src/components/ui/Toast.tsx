"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

const icons = {
  success: Check,
  error: AlertCircle,
  info: AlertCircle,
};

export function Toast({
  message,
  type = "success",
  isVisible,
  onClose,
  duration = 3000,
}: ToastProps) {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  const Icon = icons[type];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-6 right-6 z-[100]"
        >
          <div
            role="status"
            aria-live="polite"
            className={cn(
              "glass-prominent rounded-lg px-4 py-3 flex items-center gap-3 shadow-xl",
              "min-w-[280px] max-w-[400px]",
            )}
          >
            <Icon
              className={cn(
                "w-5 h-5 shrink-0",
                type === "success" && "text-[var(--success)]",
                type === "error" && "text-[var(--error)]",
                type === "info" && "text-gold-light",
              )}
            />
            <p className="text-sm text-white-primary flex-1">{message}</p>
            <button
              onClick={onClose}
              className="shrink-0 text-white-muted hover:text-white-primary transition-colors cursor-pointer"
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
