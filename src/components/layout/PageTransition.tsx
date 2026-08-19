"use client";

import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

const routeEase = [0.16, 1, 0.3, 1] as const;

/**
 * The single, public route-entry contract. A route must never wait for its
 * predecessor to disappear: during an App Router update that can leave the
 * only mounted tree at opacity zero. Keying the incoming route gives every
 * navigation a fresh, compositor-only entry while the previous tree is
 * replaced normally by React. This is deliberately opacity-only: transforms
 * and filters would capture fixed children such as mobile navigation.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduced = useReducedMotion();

  // The Admin layout is its own persistent application shell. Keying this
  // root-level transition by pathname would remount that shell on every admin
  // navigation, restarting sidebar entrance animations and visibly flashing
  // the navigation. Admin owns the content-only transition in its layout.
  if (pathname.startsWith("/admin")) return <>{children}</>;

  return (
    <motion.div
      key={pathname}
      className="route-entry"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0 : 0.34, ease: routeEase }}
    >
      {children}
    </motion.div>
  );
}
