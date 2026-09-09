import type { Metadata } from "next";
import Link from "next/link";
import { DocsFigure } from "@/components/docs/DocsFigure";
import { ArrowRight, Database, Sparkles, CheckCircle2 } from "lucide-react";
import { docsManifest, docsTracks } from "@/content/docs/manifest";
import { seoMetadata } from "@/lib/og";
import { DocsSectionIcon } from "@/components/docs/docs-section-icon";

export const metadata: Metadata = seoMetadata({
  title: "Documentation",
  description:
    "Explore an open-source AI command center you own. Connect business context, review actions and build your own capabilities.",
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
        Your business. Connected, understood, and ready to act.
      </h1>
      <p className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-white-secondary">
        Command Center is an open-source AI workspace for your business. Bring customer records,
        conversations and work into shared context, ask AI for help, and turn supported requests
        into reviewed actions. Host it with your own database and build the capabilities your
        business needs.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/docs/start/daily-path"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--fg)] px-5 py-3 text-sm font-semibold text-[var(--bg)]"
        >
          Try your first workflow <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link
          href="/docs/plugins"
          className="inline-flex min-h-11 items-center rounded-xl border border-[var(--rule)] px-5 py-3 text-sm font-medium"
        >
          Explore plugin examples
        </Link>
        <Link
          href="/docs/start/how-it-works"
          className="inline-flex min-h-11 items-center rounded-xl border border-[var(--rule)] px-5 py-3 text-sm font-medium"
        >
          See how it works
        </Link>
      </div>
      <DocsFigure
        src="/images/open-source/slide-today-paper.png"
        alt="Today in the fictional Northline Roofing workspace, showing priorities and actions awaiting review."
        caption="See the workspace before you set anything up. The fictional demo uses the real interface; no business accounts or provider keys are needed."
      />
      <section aria-labelledby="connected-work-heading" className="mt-12">
        <h2
          id="connected-work-heading"
          className="text-balance font-display text-2xl font-medium tracking-[-0.025em] text-heading"
        >
          Give AI the context to help with real work
        </h2>
        <p className="mt-3 max-w-2xl text-pretty leading-relaxed text-white-secondary">
          A customer question can involve a conversation, a proposal and a promised next step.
          Connected records let you work with that history. Registered tools let AI help you read it
          and prepare a supported action.
        </p>
        <ol
          aria-label="From business context to a reviewed result"
          className="mt-6 grid gap-4 md:grid-cols-3"
        >
          {[
            {
              icon: Database,
              title: "Connect the context",
              text: "Bring records together through supported connections and imports. Add an adapter for another service.",
              href: "/docs/workspace/integrations",
            },
            {
              icon: Sparkles,
              title: "Ask and understand",
              text: "Ask about the business, inspect the source records, and see which tools your assistant can use.",
              href: "/docs/intelligence",
            },
            {
              icon: CheckCircle2,
              title: "Review and act",
              text: "Review the exact proposed change, then inspect its recorded result after execution.",
              href: "/docs/command-center/approvals",
            },
          ].map((step, index) => (
            <li
              key={step.title}
              className="min-w-0 rounded-2xl bg-[var(--bg-muted)] p-5 ring-1 ring-inset ring-[var(--rule)]"
            >
              <div className="flex items-center justify-between text-white-muted">
                <step.icon className="h-5 w-5" aria-hidden="true" />
                <span className="font-mono text-xs">0{index + 1}</span>
              </div>
              <h3 className="mt-4 font-semibold text-heading">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white-secondary">{step.text}</p>
              <Link
                href={step.href}
                className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-medium underline underline-offset-4"
              >
                Read the guide <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ol>
      </section>
      <section
        aria-labelledby="build-on-heading"
        className="mt-12 rounded-2xl border border-[var(--rule)] p-6 sm:p-8"
      >
        <p className="text-sm font-medium text-white-muted">
          Open source · Your database · Your extensions
        </p>
        <h2
          id="build-on-heading"
          className="mt-3 text-balance font-display text-2xl font-medium tracking-[-0.025em] text-heading"
        >
          Build beyond the starting feature set
        </h2>
        <p className="mt-3 max-w-2xl text-pretty leading-relaxed text-white-secondary">
          Turn a won deal into an onboarding checklist. Bring invoice evidence into a Collections
          workspace. Adapt a report for your team’s review process. The bundled plugins show how to
          add business-specific behavior while reusing the same customers, permissions and action
          services.
        </p>
        <Link
          href="/docs/plugins"
          className="mt-4 inline-flex min-h-11 items-center gap-2 font-medium underline underline-offset-4"
        >
          Explore all ten plugin examples <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <p className="mt-3 text-sm leading-relaxed text-white-secondary">
          Use the MIT-licensed source with a developer or coding assistant to build your next
          capability. New integrations still need implementation, and each guide makes current
          availability clear.
        </p>
      </section>
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

      {docsTracks.map((track) => (
        <div key={track.id}>
          <h2 className="mt-14 font-display text-lg font-semibold tracking-[-0.02em] text-heading">
            {track.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white-secondary">
            {track.description}
          </p>
          <ul className="mt-4 divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
            {docsManifest
              .filter((section) => section.track === track.id)
              .map((section) => (
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
                      <span className="block text-sm font-semibold text-heading">
                        {section.title}
                      </span>
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
        </div>
      ))}
    </>
  );
}
