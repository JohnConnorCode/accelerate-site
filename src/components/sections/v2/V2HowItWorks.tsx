"use client";

import { MessageSquare, Map, Rocket, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { SectionMarker } from "@/components/v2/SectionMarker";
import { howItWorksSteps } from "@/content/how-it-works";

const iconMap: Record<string, LucideIcon> = {
  MessageSquare,
  Map,
  Rocket,
  TrendingUp,
};

export function V2HowItWorks() {
  return (
    <section className="relative overflow-hidden bg-[var(--bg-section-deep)] py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <AnimateOnScroll className="mb-14 max-w-2xl">
          <SectionMarker n="05" label="Process" className="mb-5" />
          <h2 className="section-heading">
            From first call to live systems in weeks
          </h2>
          <p className="section-description !mx-0">
            No six-month engagements. No 60-page decks. We assess, build, launch, and keep improving — alongside your team.
          </p>
        </AnimateOnScroll>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {howItWorksSteps.map((step, i) => {
            const Icon = iconMap[step.icon] ?? MessageSquare;
            return (
              <AnimateOnScroll
                key={step.number}
                delay={i * 0.1}
                className="group relative flex h-full flex-col rounded-2xl border border-border-glass bg-[var(--glass-default-bg)] p-7 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[var(--border-gold-hover)]"
              >
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border-gold bg-[var(--glow-soft)] text-gold">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <span className="font-display text-3xl font-bold leading-none text-gold opacity-20">
                    {step.number}
                  </span>
                </div>
                <h3 className="mb-2 text-lg font-semibold text-heading">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-white-muted">
                  {step.description}
                </p>
                {i < howItWorksSteps.length - 1 && (
                  <span className="absolute right-0 top-1/2 hidden h-px w-5 -translate-y-1/2 translate-x-full bg-[var(--border-gold)] lg:block" />
                )}
              </AnimateOnScroll>
            );
          })}
        </div>
      </div>
    </section>
  );
}
