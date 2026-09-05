"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { docsManifest } from "@/content/docs/manifest";
import { DocsSidebar } from "./DocsSidebar";

/** Collapsible guide index for small screens. Closes after a navigation. */
export function DocsMobileNav() {
  const pathname = usePathname();
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const node = detailsRef.current;
    if (node) node.open = false;
  }, [pathname]);

  const section = docsManifest.find(
    (entry) => pathname === `/docs/${entry.id}` || pathname.startsWith(`/docs/${entry.id}/`),
  );

  return (
    <details
      ref={detailsRef}
      className="mb-8 rounded-xl border border-[var(--rule)] px-4 py-3 lg:hidden"
    >
      <summary className="cursor-pointer text-sm font-semibold text-heading">
        {section ? `${section.title} guides` : "All guides"}
      </summary>
      <div className="mt-4 max-h-[min(70vh,32rem)] overflow-y-auto pr-1">
        <DocsSidebar />
      </div>
    </details>
  );
}
