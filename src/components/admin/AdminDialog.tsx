"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { adminDialogTransition } from "@/lib/admin/motion";

interface AdminDialogProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title: string;
  labelledBy?: string;
  ariaLabel?: string;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl";
  align?: "center" | "top" | "right";
}

const widths = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

let openDialogCount = 0;

/**
 * The single admin overlay primitive. Portalling to document.body keeps every
 * dialog above route animation and overflow contexts; the shared motion,
 * backdrop, scroll lock and Escape behavior keep interactions predictable.
 */
export function AdminDialog({
  open,
  onClose,
  children,
  title,
  labelledBy,
  ariaLabel,
  className,
  maxWidth = "md",
  align = "center",
}: AdminDialogProps) {
  // A centered dialog remains a dialog at every width. Side editors and the
  // command palette opt into their own deliberate layouts below; ordinary
  // confirmations do not pretend to be draggable bottom sheets on phones.
  const mobileDialog = align === "center";
  useEffect(() => {
    if (!open) return;
    openDialogCount += 1;
    document.body.classList.add("admin-dialog-open");
    return () => {
      openDialogCount = Math.max(0, openDialogCount - 1);
      if (openDialogCount === 0) document.body.classList.remove("admin-dialog-open");
    };
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <AnimatePresence mode="sync">
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="admin-overlay-backdrop fixed inset-0 z-[200]"
                data-admin-overlay="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={adminDialogTransition}
              />
            </Dialog.Overlay>
            <div
              className={cn(
                "pointer-events-none fixed inset-0 z-[210] flex overflow-y-auto px-4 py-5 sm:px-6",
                align === "right"
                  ? "items-stretch justify-end p-0 sm:p-0"
                  : align === "top"
                    ? "items-start justify-center pt-[10vh]"
                    : "items-center justify-center",
              )}
            >
              <Dialog.Content asChild forceMount aria-describedby={undefined}>
                <motion.div
                  aria-labelledby={labelledBy}
                  aria-label={ariaLabel}
                  className={cn(
                    "pointer-events-auto relative w-full",
                    widths[maxWidth],
                    mobileDialog && "max-h-[calc(100dvh-2rem)] overflow-y-auto",
                    className,
                  )}
                  data-admin-overlay="dialog"
                  data-admin-overlay-align={align}
                  initial={align === "right" ? { opacity: 0, x: 32 } : { opacity: 0, y: 18, scale: 0.975 }}
                  animate={align === "right" ? { opacity: 1, x: 0 } : { opacity: 1, y: 0, scale: 1 }}
                  exit={align === "right" ? { opacity: 0, x: 20 } : { opacity: 0, y: 10, scale: 0.985 }}
                  transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Dialog.Title asChild>
                    <span className="sr-only">{title}</span>
                  </Dialog.Title>
                  {children}
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
