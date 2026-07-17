"use client";

import { useEffect } from "react";

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

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);
}
