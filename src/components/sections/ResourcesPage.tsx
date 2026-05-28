"use client";

import { useState } from "react";
import { Download, ArrowUpRight, ClipboardCheck, Zap, BarChart3 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { Section, Eyebrow, Heading, BookCallButton } from "@/components/v2/studio/primitives";
import { leadMagnets } from "@/content/lead-magnets";
import { ResourceGate } from "@/components/sections/ResourceGate";

const iconMap: Record<string, LucideIcon> = { ClipboardCheck, Zap, BarChart3 };
const categoryLabels: Record<string, string> = {
  checklist: "Checklist",
  guide: "Guide",
  comparison: "Comparison",
};

export function ResourcesPage() {
  const [gatedResource, setGatedResource] = useState<string | null>(null);
  const featured = leadMagnets[0];
  const rest = leadMagnets.slice(1);

  return (
    <>
      {/* hero */}
      <Section width="wide" className="pt-32">
        <div className="max-w-3xl">
          <Eyebrow className="mb-7">free resources</Eyebrow>
          <Heading size={1} as="h1" className="text-[clamp(2.4rem,4.6vw,4.75rem)] leading-[1.02]">
            Resources that actually <Heading.Italic>help.</Heading.Italic>
          </Heading>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-white-secondary">
            No fluff, no filler. Practical guides, checklists, and comparisons
            built for small business owners who want to make smarter decisions
            about AI and automation.
          </p>
        </div>
      </Section>

      {/* featured + grid */}
      <Section width="wide" divide>
        {featured && (() => {
          const FeaturedIcon = iconMap[featured.icon] || Download;
          return (
            <AnimateOnScroll
              as="div"
              className="mb-8 rounded-2xl border border-border-gold/40 bg-[color-mix(in_srgb,var(--gold-base)_4%,var(--bg-elevated))] p-6 backdrop-blur-md sm:p-8"
            >
              <div className="flex flex-col items-start gap-5 sm:flex-row sm:gap-6">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] text-gold">
                  <FeaturedIcon className="h-7 w-7" strokeWidth={1.75} />
                </span>
                <div className="flex-1">
                  <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-gold">
                    {categoryLabels[featured.category]}
                  </span>
                  <h2 className="mt-2 font-display text-2xl font-bold tracking-[-0.02em] text-heading">
                    {featured.title}
                  </h2>
                  <p className="mt-1 text-sm text-gold-light">{featured.subtitle}</p>
                  <p className="mt-4 text-sm leading-relaxed text-white-secondary">
                    {featured.description}
                  </p>
                  <button
                    type="button"
                    data-cursor="link"
                    onClick={() => setGatedResource(featured.id)}
                    className="group mt-6 inline-flex items-center gap-2.5 rounded-full bg-gold px-7 py-3.5 text-sm font-semibold text-btn-text transition-opacity hover:opacity-90"
                  >
                    <Download className="h-4 w-4" />
                    Download free
                  </button>
                </div>
              </div>
            </AnimateOnScroll>
          );
        })()}

        <div className="grid gap-5 sm:grid-cols-2">
          {rest.map((resource, i) => {
            const Icon = iconMap[resource.icon] || Download;
            return (
              <AnimateOnScroll
                key={resource.id}
                delay={i * 0.06}
                as="div"
                className="flex h-full flex-col rounded-2xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] p-6 backdrop-blur-md"
              >
                <div className="mb-4 flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_60%,transparent)] text-gold">
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-white-muted">
                    {categoryLabels[resource.category]}
                  </span>
                </div>
                <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-heading">
                  {resource.title}
                </h2>
                <p className="mt-1 text-sm text-gold-light">{resource.subtitle}</p>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-white-secondary">
                  {resource.description}
                </p>
                <button
                  type="button"
                  data-cursor="link"
                  onClick={() => setGatedResource(resource.id)}
                  className="group mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border-glass px-5 py-3 text-sm font-semibold text-heading transition-colors hover:border-border-gold hover:text-gold"
                >
                  <Download className="h-4 w-4 text-gold" />
                  Download free
                  <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </button>
              </AnimateOnScroll>
            );
          })}
        </div>
      </Section>

      {/* closing — master style */}
      <Section width="wide" divide>
        <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          <div>
            <Eyebrow className="mb-7">start</Eyebrow>
            <Heading size={1} as="h2" className="text-[clamp(2.6rem,5.4vw,5.5rem)] leading-[0.98]">
              Want a plan built <Heading.Italic>around you?</Heading.Italic>
            </Heading>
          </div>
          <div className="flex flex-col gap-7">
            <p className="text-lg leading-relaxed text-white-secondary">
              Book a free 30-minute discovery call and we&apos;ll map out
              exactly where AI and automation can move the needle for your
              business.
            </p>
            <BookCallButton />
            <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-border-glass pt-6 font-mono text-xs uppercase tracking-[0.15em] text-white-muted">
              <span>Free</span><span>·</span>
              <span>30 minutes</span><span>·</span>
              <span>No obligation</span><span>·</span>
              <span>Direct to the founder</span>
            </div>
          </div>
        </div>
      </Section>

      {/* gated download modal */}
      {gatedResource && (
        <ResourceGate
          resourceId={gatedResource}
          onClose={() => setGatedResource(null)}
        />
      )}
    </>
  );
}
