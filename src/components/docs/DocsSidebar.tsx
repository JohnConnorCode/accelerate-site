"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen } from "lucide-react";
import { docsManifest } from "@/content/docs/manifest";
import { cn } from "@/lib/utils";

/** Persistent docs navigation: current page highlighted, ancestors expanded. */
export function DocsSidebar() {
  const pathname = usePathname();
  const current = pathname.replace(/^\/docs\/?/, "");

  return (
    <nav aria-label="Documentation sections" className="flex flex-col gap-6">
      {docsManifest.map((section) => {
        const expanded =
          current === "" || current === section.id || current.startsWith(`${section.id}/`);
        return (
          <div key={section.id}>
            <Link
              href={`/docs/${section.id}`}
              className={cn(
                "flex items-center gap-2 text-sm font-semibold transition-colors",
                expanded ? "text-heading" : "text-white-muted hover:text-white-secondary",
              )}
              aria-current={current === section.id ? "page" : undefined}
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              {section.title}
            </Link>
            {expanded && (
              <ul className="ml-6 mt-2 flex flex-col gap-1 border-l border-[var(--rule)] pl-3">
                {section.pages.map((page) => {
                  const href = `/docs/${page.slug.join("/")}`;
                  const active =
                    pathname === href || (page.slug[page.slug.length - 1] === "overview" && pathname === `/docs/${section.id}`);
                  return (
                    <li key={page.slug.join("/")}>
                      <Link
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "block py-1 text-sm transition-colors",
                          active
                            ? "font-medium text-heading"
                            : "text-white-muted hover:text-white-secondary",
                        )}
                      >
                        {page.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}
