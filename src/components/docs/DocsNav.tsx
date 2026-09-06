import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { flattenDocsPages } from "@/content/docs/manifest";

export function DocsBreadcrumbs({ items }: { items: Array<{ title: string; href: string }> }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-8 flex min-h-8 flex-wrap items-center gap-1.5 font-mono text-[0.64rem] uppercase tracking-[0.12em] text-white-muted"
    >
      {items.map((item, index) => (
        <span key={item.href} className="flex items-center gap-1.5">
          {index > 0 && <ChevronRight className="h-3 w-3" aria-hidden="true" />}
          {index === items.length - 1 ? (
            <span aria-current="page" className="text-white-secondary">
              {item.title}
            </span>
          ) : (
            <Link href={item.href} className="transition-colors hover:text-white-secondary">
              {item.title}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

export function DocsPager({ slug }: { slug: string[] }) {
  const pages = flattenDocsPages();
  const index = pages.findIndex(
    (page) => page.slug.length === slug.length && page.slug.every((part, i) => part === slug[i]),
  );
  if (index === -1) return null;
  const prev = index > 0 ? pages[index - 1] : null;
  const next = index < pages.length - 1 ? pages[index + 1] : null;
  if (!prev && !next) return null;
  return (
    <nav
      aria-label="Docs pages"
      className="mt-16 grid gap-3 border-t border-[var(--rule)] pt-8 sm:grid-cols-2"
    >
      {prev ? (
        <Link
          href={`/docs/${prev.slug.join("/")}`}
          rel="prev"
          className="group flex items-center gap-2 rounded-xl border border-[var(--rule)] px-4 py-3 transition-colors hover:border-[var(--fg)]"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="block font-mono text-[0.62rem] uppercase tracking-[0.14em] text-white-muted">
              Previous
            </span>
            <span className="block text-sm font-medium">{prev.title}</span>
          </span>
        </Link>
      ) : (
        <span className="hidden sm:block" />
      )}
      {next && (
        <Link
          href={`/docs/${next.slug.join("/")}`}
          rel="next"
          className="group flex items-center justify-end gap-2 rounded-xl border border-[var(--rule)] px-4 py-3 text-right transition-colors hover:border-[var(--fg)] sm:col-start-2"
        >
          <span>
            <span className="block font-mono text-[0.62rem] uppercase tracking-[0.14em] text-white-muted">
              Next
            </span>
            <span className="block text-sm font-medium">{next.title}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        </Link>
      )}
    </nav>
  );
}
