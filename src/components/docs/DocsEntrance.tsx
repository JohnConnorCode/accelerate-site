"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/** The committed route owns the entrance. Search state and hash navigation
 * preserve the reading surface; a new docs pathname restarts its sequence. */
export function DocsEntrance({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="docs-entrance">
      {children}
    </div>
  );
}
