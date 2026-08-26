"use client";

import { motion, useScroll, useSpring } from "framer-motion";
import { usePathname } from "next/navigation";

/**
 * Slim page-reading progress bar — ties the whole page together as one guided
 * story. Springs for a smooth, premium feel. Decorative only.
 */
export function ScrollProgress() {
  const pathname = usePathname();
  const { scrollYProgress } = useScroll();
  const x = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });
  if (pathname.startsWith("/admin") || pathname.startsWith("/demo/command-center")) return null;
  return (
    <motion.div
      aria-hidden
      style={{ scaleX: x, top: "var(--safe-top)" }}
      className="fixed inset-x-0 z-[9997] h-px origin-left bg-[var(--fg)]"
    />
  );
}
