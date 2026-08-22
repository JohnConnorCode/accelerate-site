"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { trackConversion } from "@/lib/analytics";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Floating "book a call" dock — shows on desktop and mobile alike once the
 * visitor scrolls past the hero. Hidden near the page bottom (the footer CTA
 * covers that) and on routes where it's redundant (contact), wrong (admin),
 * or replaced by a page-scoped equivalent (command-center has its own bottom
 * nav with the booking button built in — see CommandCenterNav).
 *
 * Coordinates with the chat bubble via `document.body[data-mcta]` — a CSS rule
 * in globals.css lifts the bubble above the dock on mobile while it's showing.
 *
 * Mobile: full-bleed bottom bar (native tab-bar language). Desktop: centered
 * pill so it does not interrupt the editorial layout.
 */
export function Dock() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  const hiddenRoute =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/contact") ||
    pathname.startsWith("/roofing") ||
    pathname.startsWith("/command-center");

  useEffect(() => {
    if (hiddenRoute) return;
    const onScroll = () => {
      const y = window.scrollY;
      const doc = document.documentElement;
      const nearBottom = y + window.innerHeight >= doc.scrollHeight - 220;
      setVisible(y > window.innerHeight * 0.55 && !nearBottom);
    };
    const raf = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [hiddenRoute, pathname]);

  useEffect(() => {
    if (visible && !hiddenRoute) document.body.setAttribute("data-mcta", "on");
    else document.body.removeAttribute("data-mcta");
    return () => document.body.removeAttribute("data-mcta");
  }, [visible, hiddenRoute]);

  if (hiddenRoute) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          initial={{ y: "150%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "150%", opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 280, mass: 0.65 }}
          data-dock
          className="fixed inset-x-0 bottom-0 z-[950] flex items-center gap-3 border-t border-white/10 py-3 pl-5 pr-3 sm:inset-x-auto sm:bottom-5 sm:left-1/2 sm:w-max sm:-translate-x-1/2 sm:gap-4.5 sm:border sm:border-white/[0.16] sm:py-2.5 sm:pl-5.5 sm:pr-2.5 sm:shadow-[0_20px_60px_rgba(0,0,0,0.34)]"
          style={{
            paddingBottom: "max(12px, env(safe-area-inset-bottom))",
            backgroundColor: "rgba(11,11,11,0.94)",
            backdropFilter: "blur(22px) saturate(1.6)",
            WebkitBackdropFilter: "blur(22px) saturate(1.6)",
          }}
        >
          <div className="flex min-w-0 flex-col gap-0.5 leading-tight">
            <b className="font-display text-[13.5px] font-medium tracking-[-0.01em] text-[var(--paper)]">
              Free 30-minute strategy session
            </b>
            <span className="font-mono text-[9.5px] uppercase tracking-[0.13em] text-[rgba(251,251,250,0.5)]">
              You leave with a written plan
            </span>
          </div>
          <Link
            href="/contact"
            onClick={() => trackConversion("Strategy Call CTA Clicked", { location: "dock" })}
            className="btn btn-inv shrink-0 whitespace-nowrap !px-5 !py-3 !text-[10px]"
          >
            Book <span className="arw" aria-hidden="true">→</span>
          </Link>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
