import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { docsManifest } from "@/content/docs/manifest";
import { seoMetadata } from "@/lib/og";

export const metadata: Metadata = seoMetadata({
  title: "Documentation",
  description:
    "Guides for working with Accelerate and running the Command Center: start with your business, then run follow-up that never loses an inquiry.",
});

export default function DocsLandingPage() {
  return (
    <>
      <p className="mb-4 font-mono text-[0.66rem] uppercase tracking-[0.2em] text-white-muted">
        Documentation
      </p>
      <h1 className="max-w-[20ch] text-balance font-display text-[clamp(2.2rem,5vw,3.75rem)] font-medium leading-[1.02] tracking-[-0.04em] text-heading">
        Run your business on rails
      </h1>
      <p className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-white-secondary">
        Practical guides, not marketing. Start with your business, use the Command Center where it
        earns its place, and follow up every inquiry.
      </p>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {docsManifest.map((section) => (
          <Link
            key={section.id}
            href={`/docs/${section.id}`}
            className="group flex flex-col gap-2 rounded-2xl border border-[var(--rule)] p-6 transition-colors hover:border-[var(--fg)]"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-heading">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              {section.title}
            </span>
            <span className="text-sm leading-relaxed text-white-secondary">
              {section.description}
            </span>
            <span className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-medium text-heading">
              Read the guide
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
