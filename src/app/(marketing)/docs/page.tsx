import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { docsManifest } from "@/content/docs/manifest";
import { seoMetadata } from "@/lib/og";
import { DocsSectionIcon } from "@/components/docs/docs-section-icon";

export const metadata: Metadata = seoMetadata({
  title: "Documentation",
  description:
    "Learn Command Center, work your daily queue, connect your tools, and extend the runtime.",
});

const AUDIENCE_PATHS = [
  {
    id: "business-owners",
    title: "For business owners",
    description: "Choose a first workflow, understand the costs, and measure whether it helps.",
    href: "/docs/start/business-owners",
    sectionId: "command-center",
    action: "Plan your first week",
  },
  {
    id: "agencies",
    title: "For agencies",
    description: "Onboard client workspaces, verify access, and prepare a clear handoff.",
    href: "/docs/start/agencies",
    sectionId: "workspace",
    action: "Set up a client pilot",
  },
  {
    id: "developers",
    title: "For developers",
    description: "Run the demo, find your way around the code, and make your first change.",
    href: "/docs/extend/first-change",
    sectionId: "extend",
    action: "Make your first change",
  },
] as const;

export default function DocsLandingPage() {
  return (
    <>
      <p className="mb-4 font-mono text-[0.66rem] uppercase tracking-[0.2em] text-white-muted">
        Documentation
      </p>
      <h1 className="max-w-[20ch] text-balance font-display text-[clamp(2.2rem,5vw,3.75rem)] font-medium leading-[1.02] tracking-[-0.04em] text-heading">
        Know what needs you. Keep work moving.
      </h1>
      <p className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-white-secondary">
        Command Center connects your conversations, customer records, and next actions. Learn the
        daily workflow, see what needs approval, and find the guide for your next task.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/docs/start/daily-path"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--fg)] px-5 py-3 text-sm font-semibold text-[var(--bg)]"
        >
          Try your first workflow <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link
          href="/docs/workspace/setup"
          className="inline-flex min-h-11 items-center rounded-xl border border-[var(--rule)] px-5 py-3 text-sm font-medium"
        >
          Set up your workspace
        </Link>
      </div>
      <h2 className="mt-12 font-display text-lg font-semibold tracking-[-0.02em] text-heading">
        Start with what you need
      </h2>
      <ul aria-label="Choose your docs path" className="mt-4 grid gap-4 sm:grid-cols-3">
        {AUDIENCE_PATHS.map((path) => (
          <li key={path.id}>
            <Link
              href={path.href}
              className="group flex h-full flex-col gap-2 rounded-2xl border border-[var(--rule)] p-6 transition-colors hover:border-[var(--fg)]"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-heading">
                <DocsSectionIcon sectionId={path.sectionId} className="h-4 w-4 shrink-0" />
                {path.title}
              </span>
              <span className="text-sm leading-relaxed text-white-secondary">
                {path.description}
              </span>
              <span className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-medium text-heading">
                {path.action}
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mt-14 font-display text-lg font-semibold tracking-[-0.02em] text-heading">
        Find a guide by area
      </h2>
      <ul className="mt-4 divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
        {docsManifest.map((section) => (
          <li key={section.id}>
            <Link
              href={`/docs/${section.id}`}
              className="group flex items-start gap-3 py-4 transition-colors hover:text-heading"
            >
              <DocsSectionIcon
                sectionId={section.id}
                className="mt-0.5 h-4 w-4 shrink-0 text-white-muted group-hover:text-heading"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-heading">{section.title}</span>
                <span className="mt-0.5 block text-sm leading-relaxed text-white-secondary">
                  {section.description}
                </span>
              </span>
              <span className="shrink-0 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-white-muted">
                {section.pages.length}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
