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
      const doc = document.documentElement;
      const nearBottom = y + window.innerHeight >= doc.scrollHeight - 220;
      setVisible(y > window.innerHeight * 0.5 && !nearBottom);
    };
    const raf = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
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

  // Keep the active pill scrolled into view within the horizontal rail.
  useEffect(() => {
    const rail = railRef.current;
    const activeEl = rail?.querySelector<HTMLElement>(`[data-id="${active}"]`);
    activeEl?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [active]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.nav
          initial={{ y: "150%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "150%", opacity: 0 }}
          transition={{ type: "spring", damping: 26, stiffness: 260, mass: 0.7 }}
          data-dock
          aria-label="Command Center sections"
          className="fixed inset-x-3.5 bottom-5 z-[950] flex items-center gap-1 border border-white/[0.16] py-2 pl-2 pr-2 shadow-[0_20px_60px_rgba(0,0,0,0.34)] sm:inset-x-auto sm:left-1/2 sm:max-w-[calc(100vw-28px)] sm:-translate-x-1/2"
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
                className={`shrink-0 whitespace-nowrap rounded-full px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${
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
