"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { docsManifest, docsTracks } from "@/content/docs/manifest";
import { cn } from "@/lib/utils";
import { DocsSectionIcon } from "./docs-section-icon";

/** Persistent docs navigation: current page highlighted, that section expanded.
 *  Sections are grouped under their track with a static (non-collapsible)
 *  heading, so every section link stays reachable without an extra click. */
export function DocsSidebar() {
  const pathname = usePathname();
  const current = pathname.replace(/^\/docs\/?/, "");

  return (
    <nav aria-label="Documentation sections" className="flex flex-col gap-7">
      {docsTracks.map((track) => (
        <div key={track.id} className="flex flex-col gap-5">
          <p className="font-mono text-[0.66rem] uppercase tracking-[0.2em] text-white-muted">
            {track.title}
          </p>
          <DocsSidebarSections
            sections={docsManifest.filter((section) => section.track === track.id)}
            current={current}
            pathname={pathname}
          />
        </div>
      ))}
    </nav>
  );
}

function DocsSidebarSections({
  sections,
  current,
  pathname,
}: {
  sections: typeof docsManifest;
  current: string;
  pathname: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      {sections.map((section) => {
        const expanded = current === section.id || current.startsWith(`${section.id}/`);
        return (
          <div key={section.id}>
            <Link
              href={`/docs/${section.id}`}
              className={cn(
                "flex min-h-10 items-center gap-2 text-sm font-semibold transition-colors",
                expanded ? "text-heading" : "text-white-secondary hover:text-heading",
              )}
              aria-current={undefined}
            >
              <DocsSectionIcon sectionId={section.id} className="h-4 w-4 shrink-0" />
              {section.title}
            </Link>
            {expanded && (
              <ul className="ml-6 mt-2 flex flex-col border-l border-[var(--rule)]">
                {section.pages.map((page) => {
                  const href = `/docs/${page.slug.join("/")}`;
                  const active =
                    pathname === href ||
                    (page.slug[page.slug.length - 1] === "overview" &&
                      pathname === `/docs/${section.id}`);
                  return (
                    <li key={page.slug.join("/")}>
                      <Link
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "-ml-px flex min-h-10 items-center border-l py-2 pl-3 text-sm transition-colors",
                          active
                            ? "border-[var(--fg)] font-medium text-heading"
                            : "border-transparent text-white-secondary hover:text-heading",
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
    </div>
  );
}
