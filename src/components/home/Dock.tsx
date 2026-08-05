"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { trackConversion } from "@/lib/analytics";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Floating "book a call" dock — shows on desktop and mobile alike once the
 * visitor scrolls past the hero. Hidden near the page bottom (the footer CTA
 * covers that) and on routes where it's redundant (contact) or wrong (admin).
 *
 * Coordinates with the chat bubble via `document.body[data-mcta]` — a CSS rule
 * in globals.css lifts the bubble above the dock on mobile while it's showing.
 */
export function Dock() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  const hiddenRoute =
    pathname.startsWith("/admin") || pathname.startsWith("/contact");

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
          transition={{ type: "spring", damping: 26, stiffness: 260, mass: 0.7 }}
          className="fixed inset-x-3.5 bottom-5 z-[950] flex items-center gap-3 border border-white/[0.16] py-2.5 pl-4 pr-2.5 shadow-[0_20px_60px_rgba(0,0,0,0.34)] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:gap-4.5 sm:pl-5.5"
          style={{
            paddingBottom: "max(10px, env(safe-area-inset-bottom))",
            backgroundColor: "rgba(14,14,13,0.62)",
            backdropFilter: "blur(20px) saturate(1.7)",
            WebkitBackdropFilter: "blur(20px) saturate(1.7)",
          }}
        >
          <div className="flex flex-col gap-0.5 leading-tight">
            <b className="font-display text-[13.5px] font-medium tracking-[-0.01em] text-[var(--paper)]">
              Free 30-minute call
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
            Book <span className="arw">→</span>
          </Link>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
