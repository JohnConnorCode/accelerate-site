"use client";

import { useEffect } from "react";

let openModalCount = 0;

/**
 * Shared modal/overlay behavior: close on Escape and lock body scroll
 * while open. Keeps dialogs across the admin consistent and accessible
 * without each one re-implementing the same listeners.
 */
export function useModalDismiss(isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    openModalCount += 1;
    document.body.style.overflow = "hidden";
    document.body.classList.add("admin-dialog-open");

    const focusTimer = window.setTimeout(() => {
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]:last-of-type');
      dialog?.querySelector<HTMLElement>(
        '[autofocus], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )?.focus();
    }, 40);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKey);
      openModalCount = Math.max(0, openModalCount - 1);
      if (openModalCount === 0) {
        document.body.style.overflow = "";
        document.body.classList.remove("admin-dialog-open");
      }
      previouslyFocused?.focus();
    };
  }, [isOpen, onClose]);
}
