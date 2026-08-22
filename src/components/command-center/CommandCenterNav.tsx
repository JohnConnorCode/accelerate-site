"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { trackConversion } from "@/lib/analytics";
import { AnimatePresence, motion } from "framer-motion";

const SECTIONS = [
  { id: "built", label: "Built for you" },
  { id: "demo", label: "Demo" },
  { id: "how", label: "How it works" },
  { id: "autonomy", label: "Autonomy" },
  { id: "capabilities", label: "Capabilities" },
  { id: "proof", label: "Proof" },
  { id: "who", label: "Who it's for" },
  { id: "faq", label: "FAQ" },
];

/**
 * Page-scoped bottom nav for /command-center — same fixed-pill visual
 * language as the global Dock (home/Dock.tsx), but this page is long enough
 * to need real in-page navigation, so it replaces the Dock here rather than
 * floating a second bar alongside it (Dock hides itself on this route).
 *
 * Section pills scroll (`scroll-behavior: smooth` is already global) and the
 * active one is tracked with an IntersectionObserver so a visitor scrolling
 * past a section on their own sees the nav follow along, not just on click.
 */
export function CommandCenterNav() {
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState<string>(SECTIONS[0]!.id);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      // This is the page's primary utility navigation, not a promotional
      // dock. Keep it available throughout the long page once the hero has
      // started to clear instead of withdrawing it near the footer.
      setVisible((current) => {
        const next = y > 48;
        return current === next ? current : next;
      });
    };
    const raf = requestAnimationFrame(onScroll);
    // Hash navigation can settle after the first animation frame without
    // dispatching another scroll event. Recheck once so the utility bar does
    // not remain hidden when someone lands directly on a deep section.
    const settleTimer = window.setTimeout(onScroll, 500);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(settleTimer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    if (visible) document.body.setAttribute("data-mcta", "on");
    else document.body.removeAttribute("data-mcta");
    return () => document.body.removeAttribute("data-mcta");
  }, [visible]);

  // Scrollspy: a section is "active" once it has crossed the vertical
  // center of the viewport, so the highlighted pill matches what's actually
  // being read rather than what's merely visible somewhere on screen.
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => el !== null
    );
    if (els.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries.filter((e) => e.isIntersecting);
        if (visibleEntries.length === 0) return;
        const topMost = visibleEntries.reduce((a, b) =>
          a.boundingClientRect.top < b.boundingClientRect.top ? a : b
        );
        setActive(topMost.target.id);
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: 0 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Keep the active pill centered inside the horizontal rail. Do not use
  // scrollIntoView here: on mobile it is allowed to move the page viewport as
  // well as the rail, so scrollspy could fight the reader's vertical scroll.
  useEffect(() => {
    const rail = railRef.current;
    const activeEl = rail?.querySelector<HTMLElement>(`[data-id="${active}"]`);
    if (!rail || !activeEl) return;
    const left = activeEl.offsetLeft - (rail.clientWidth - activeEl.offsetWidth) / 2;
    // Keep scrollspy passive: moving a horizontal rail should never queue an
    // animation while the reader is vertically scrolling the page.
    rail.scrollTo({ left: Math.max(0, left), behavior: "auto" });
  }, [active]);

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.nav
          initial={{ y: "150%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "150%", opacity: 0 }}
          transition={{ type: "spring", damping: 26, stiffness: 260, mass: 0.7 }}
          data-dock
          aria-label="Command Center sections"
          className="fixed inset-x-0 bottom-0 z-[950] flex items-center gap-1 border-t border-white/10 py-2 pl-2 pr-2 sm:inset-x-auto sm:bottom-5 sm:left-1/2 sm:max-w-[calc(100vw-28px)] sm:-translate-x-1/2 sm:border sm:border-white/[0.16] sm:shadow-[0_20px_60px_rgba(0,0,0,0.34)]"
          style={{
            paddingBottom: "max(8px, env(safe-area-inset-bottom))",
            backgroundColor: "rgba(14,14,13,0.62)",
            backdropFilter: "blur(20px) saturate(1.7)",
            WebkitBackdropFilter: "blur(20px) saturate(1.7)",
          }}
        >
          <div
            ref={railRef}
            className="flex min-w-0 items-center gap-0.5 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                data-id={s.id}
                className={`flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-full px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${
                  active === s.id
                    ? "bg-white/[0.14] text-[var(--paper)]"
                    : "text-[rgba(251,251,250,0.5)] hover:text-[var(--paper)]"
                }`}
              >
                {s.label}
              </a>
            ))}
          </div>
          <Link
            href="/contact"
            onClick={() => trackConversion("Strategy Call CTA Clicked", { location: "command_center_nav" })}
            className="btn btn-inv ml-1 shrink-0 whitespace-nowrap !px-4 !py-2.5 !text-[10px] sm:!px-5 sm:!py-3"
          >
            <span>Book</span> <span className="arw hidden sm:inline-block" aria-hidden="true">→</span>
          </Link>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
