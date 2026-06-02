"use client";

import { useState } from "react";
import { Download, ArrowUpRight, ClipboardCheck, Zap, BarChart3 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { Section, Container, Eyebrow, Heading, BookCallButton } from "@/components/v2/studio/primitives";
import { RevealHeading } from "@/components/v2/studio/RevealHeading";
import { HERO_HEADING } from "@/lib/type-recipes";
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
      {/* hero — statement left, the featured resource (lead with your best) right */}
      <section className="relative overflow-hidden pt-32 pb-24">
        <Container width="wide">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div className="min-w-0">
            <AnimateOnScroll><Eyebrow className="mb-7">free resources</Eyebrow></AnimateOnScroll>
            <RevealHeading
              as="h1"
              className={HERO_HEADING}
              lead="Tools you can use"
              accent="today."
              delay={0.1}
            />
            <AnimateOnScroll delay={0.3}>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-white-secondary">
                Checklists, guides, and head-to-head comparisons, built for
                owners making real decisions about AI and automation.
              </p>
            </AnimateOnScroll>
          </div>

          {featured && (() => {
            const FeaturedIcon = iconMap[featured.icon] || Download;
            return (
              <AnimateOnScroll
                as="div"
                className="relative overflow-hidden rounded-3xl border border-border-gold/50 bg-[color-mix(in_srgb,var(--gold-base)_5%,var(--bg-elevated))] p-7 backdrop-blur-md sm:p-8"
              >
                <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent opacity-70" />
                <div className="mb-5 flex items-center gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] text-gold">
                    <FeaturedIcon className="h-6 w-6" strokeWidth={1.75} />
                  </span>
                  <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-gold">
                    Featured · {categoryLabels[featured.category]}
                  </span>
                </div>
                <h2 className="font-display text-2xl font-bold tracking-[-0.02em] text-heading">
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
              </AnimateOnScroll>
            );
          })()}
        </div>
        </Container>
      </section>

      {/* the rest of the library */}
      <Section width="wide" divide>
        <Eyebrow className="mb-8">more free resources</Eyebrow>
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
            <Heading size={1} as="h2">
              Want a plan built around you?
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
