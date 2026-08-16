"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const routeEase = [0.16, 1, 0.3, 1] as const;

/**
 * A deliberate client-side route boundary. A keyed CSS class can be retained
 * by the App Router during navigation, so it occasionally skips the entry
 * sequence. AnimatePresence owns the mount/unmount lifecycle directly. This
 * wrapper intentionally animates opacity only: transforms and filters would
 * capture fixed children such as page-scoped mobile navigation.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduced = useReducedMotion();

  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        key={pathname}
        className="route-entry"
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduced ? undefined : { opacity: 0 }}
        transition={{ duration: reduced ? 0 : 0.34, ease: routeEase }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
