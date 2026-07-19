"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { trackConversion } from "@/lib/analytics";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Sticky bottom "Book a call" bar — mobile only. Slides up once the visitor
 * scrolls past the hero, giving a persistent, thumb-reach conversion path on
 * phones. Hidden near the page bottom (the footer has its own CTA) and on
 * routes where it's redundant (contact) or wrong (admin).
 *
 * Coordinates with the chat bubble via `document.body[data-mcta]` — a CSS rule
 * in globals.css lifts the bubble above the bar on mobile while it's showing.
 */
export function MobileCTABar() {
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
      // show after roughly the hero, hide back at the very top and near footer
      setVisible(y > window.innerHeight * 0.7 && !nearBottom);
    };
    // defer the initial read out of the effect body (no sync setState in effect)
    const raf = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [hiddenRoute, pathname]);

  // sync the body flag (external system) so the chat bubble lifts above the bar
  useEffect(() => {
    if (visible && !hiddenRoute) document.body.setAttribute("data-mcta", "on");
    else document.body.removeAttribute("data-mcta");
    return () => document.body.removeAttribute("data-mcta");
  }, [visible, hiddenRoute]);

  if (hiddenRoute) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: "120%" }}
          animate={{ y: 0 }}
          exit={{ y: "120%" }}
          transition={{ type: "spring", damping: 30, stiffness: 320, mass: 0.7 }}
          className="fixed inset-x-0 bottom-0 z-[70] lg:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div
            className="border-t border-[var(--border-glass)] px-4 pt-3 pb-3"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--bg-base) 88%, transparent)",
              backdropFilter: "blur(20px) saturate(160%)",
              WebkitBackdropFilter: "blur(20px) saturate(160%)",
            }}
          >
            <Link
              href="/contact"
              onClick={() => trackConversion("Strategy Call CTA Clicked", { location: "mobile_sticky_bar" })}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-gold px-6 py-3.5 text-sm font-semibold text-btn-text"
            >
              Book a free strategy call
              <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="mt-1.5 text-center font-mono text-[0.62rem] uppercase tracking-[0.16em] text-[var(--white-muted)]">
              Free 30-min call · roadmap yours to keep
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
