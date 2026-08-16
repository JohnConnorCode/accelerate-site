"use client";

import { usePathname } from "next/navigation";

/**
 * A quiet route-level crossfade that guarantees every public page has a
 * deliberate first paint. Detailed section motion still happens lower in the
 * tree; this layer only prevents raw route swaps from flashing into place.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="route-entry">
      {children}
    </div>
  );
}
