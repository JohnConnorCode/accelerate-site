"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { adminDialogTransition } from "@/lib/admin/motion";

/** Give each editor opening a fresh form while allowing the previous session to animate out. */
export function useAdminDialogState() {
  const [open, setOpenState] = useState(false);
  const [session, setSession] = useState(0);
  const setOpen = useCallback((next: boolean) => {
    if (next) setSession((value) => value + 1);
    setOpenState(next);
  }, []);
  return { open, setOpen, session };
}

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
  const returnFocus = useRef<HTMLElement | null>(null);
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
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <AnimatePresence mode="sync">
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="admin-overlay-token-scope admin-overlay-backdrop fixed inset-0 z-[200]"
                data-admin-overlay="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={adminDialogTransition}
              />
            </Dialog.Overlay>
            <div
              className={cn(
                "admin-overlay-token-scope pointer-events-none fixed inset-0 z-[210] flex overflow-y-auto px-4 py-5 sm:px-6",
                align === "right"
                  ? "items-stretch justify-end p-0 sm:p-0"
                  : align === "top"
                    ? "items-start justify-center pt-[10vh]"
                    : "items-center justify-center",
              )}
            >
              <Dialog.Content
                asChild
                forceMount
                aria-describedby={undefined}
                onOpenAutoFocus={(event) => {
                  returnFocus.current =
                    document.activeElement instanceof HTMLElement ? document.activeElement : null;
                  const initial =
                    event.target instanceof HTMLElement
                      ? event.target.querySelector<HTMLElement>('[data-admin-autofocus="true"]')
                      : null;
                  if (initial) {
                    event.preventDefault();
                    initial.focus();
                  }
                }}
                onCloseAutoFocus={(event) => {
                  // This shared controlled dialog has no Radix Trigger. Restore the
                  // actual opener, including the previous dialog in a review stack.
                  if (returnFocus.current?.isConnected) {
                    event.preventDefault();
                    returnFocus.current.focus({ preventScroll: true });
                  }
                }}
              >
                <motion.div
                  {...(labelledBy ? { "aria-labelledby": labelledBy } : {})}
                  {...(ariaLabel ? { "aria-label": ariaLabel } : {})}
                  className={cn(
                    "pointer-events-auto relative w-full",
                    widths[maxWidth],
                    mobileDialog && "max-h-[calc(100dvh-2rem)] overflow-y-auto",
                    className,
                  )}
                  data-admin-overlay="dialog"
                  data-admin-overlay-align={align}
                  initial={
                    align === "right" ? { opacity: 0, x: 20 } : { opacity: 0, y: 8, scale: 0.985 }
                  }
                  animate={
                    align === "right" ? { opacity: 1, x: 0 } : { opacity: 1, y: 0, scale: 1 }
                  }
                  exit={
                    align === "right" ? { opacity: 0, x: 12 } : { opacity: 0, y: 4, scale: 0.99 }
                  }
                  transition={adminDialogTransition}
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
