import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { docsTrackForSlug, docsTracks, flattenDocsPages } from "@/content/docs/manifest";

export function DocsPager({ slug }: { slug: string[] }) {
  const pages = flattenDocsPages();
  const index = pages.findIndex(
    (page) => page.slug.length === slug.length && page.slug.every((part, i) => part === slug[i]),
  );
  if (index === -1) return null;
  const prev = index > 0 ? pages[index - 1] : null;
  const next = index < pages.length - 1 ? pages[index + 1] : null;
  if (!prev && !next) return null;

  const currentTrack = docsTrackForSlug(slug);
  const prevTrack = prev ? docsTrackForSlug(prev.slug) : null;
  const nextTrack = next ? docsTrackForSlug(next.slug) : null;
  const prevLabel =
    prevTrack && currentTrack && prevTrack !== currentTrack
      ? `Previous track · ${docsTracks.find((t) => t.id === prevTrack)?.title ?? "Previous"}`
      : "Previous";
  const nextLabel =
    nextTrack && currentTrack && nextTrack !== currentTrack
      ? `Next track · ${docsTracks.find((t) => t.id === nextTrack)?.title ?? "Next"}`
      : "Next";
  return (
    <nav
      aria-label="Docs pages"
      className="mt-16 grid gap-3 border-t border-[var(--rule)] pt-8 sm:grid-cols-2"
    >
      {prev ? (
        <Link
          href={`/docs/${prev.slug.join("/")}`}
          rel="prev"
          className="docs-pager-link group flex items-center gap-2 rounded-xl border border-[var(--rule)] px-4 py-3 hover:border-[var(--fg)]"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="block font-mono text-[0.62rem] uppercase tracking-[0.14em] text-white-muted">
              {prevLabel}
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
          className="docs-pager-link group flex items-center justify-end gap-2 rounded-xl border border-[var(--rule)] px-4 py-3 text-right hover:border-[var(--fg)] sm:col-start-2"
        >
          <span>
            <span className="block font-mono text-[0.62rem] uppercase tracking-[0.14em] text-white-muted">
              {nextLabel}
            </span>
            <span className="block text-sm font-medium">{next.title}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        </Link>
      )}
    </nav>
  );
}
