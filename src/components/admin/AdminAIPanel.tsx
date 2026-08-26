"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, ExternalLink, X } from "lucide-react";
import { AdminAIChat } from "./AdminAIChat";
import { useAdminAI } from "./AdminAIProvider";

export function AdminAIPanel() {
  const ai = useAdminAI();
  const { open, setOpen } = ai;
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => panelRef.current?.querySelector("textarea")?.focus(), 120);
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", close);
    return () => { window.clearTimeout(timer); window.removeEventListener("keydown", close); document.body.style.overflow = previousOverflow; returnFocusRef.current?.focus(); };
  }, [open, setOpen]);

  return <AnimatePresence initial={false}>{ai.open && <>
    <motion.button type="button" aria-label="Close AI command panel" onClick={() => ai.setOpen(false)} className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-[4px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} />
    <motion.div ref={panelRef} role="dialog" aria-label="Ask AI" aria-modal="true" className="fixed inset-0 z-[71] flex min-h-0 flex-col bg-[var(--admin-canvas)] pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] shadow-[-24px_0_70px_rgba(0,0,0,0.22)] sm:inset-y-0 sm:left-auto sm:w-[min(480px,100vw)] sm:py-0" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}>
      <header className="flex min-h-16 items-center justify-between gap-3 border-b border-[var(--admin-border)] px-4">
        <div className="flex min-w-0 items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[var(--admin-ink)] text-[var(--admin-surface)]"><Bot className="size-4" /></span><div className="min-w-0"><p className="text-sm font-semibold text-[var(--admin-ink)]">Ask AI</p><p className="truncate text-[10px] text-[var(--admin-muted)]">Live records · staged actions · visible evidence</p></div></div>
        <div className="flex items-center gap-1"><Link href="/admin/ai" onClick={() => ai.setOpen(false)} className="admin-icon-button" aria-label="Open full AI workspace" title="Open full workspace"><ExternalLink className="size-4" /></Link><button type="button" onClick={() => ai.setOpen(false)} className="admin-icon-button" aria-label="Close AI panel"><X className="size-4" /></button></div>
      </header>
      <div className="min-h-0 flex-1"><AdminAIChat mode="panel" /></div>
    </motion.div>
  </>}</AnimatePresence>;
}
