"use client";

import Link from "next/link";
import { Clock, PhoneMissed, RotateCcw, MousePointerClick, FileWarning, Database, ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { SectionMarker } from "@/components/v2/SectionMarker";
import { BlueprintGrid } from "@/components/v2/BlueprintGrid";

const stuckPoints: { icon: LucideIcon; title: string; detail: string }[] = [
  { icon: Clock, title: "New inquiries wait too long", detail: "By the time someone replies, the prospect already called a competitor." },
  { icon: PhoneMissed, title: "Missed calls become missed jobs", detail: "Nights, weekends, and busy days quietly leak revenue out the back door." },
  { icon: RotateCcw, title: "Follow-up depends on memory", detail: "Leads go cold because nobody had time to chase them a third time." },
  { icon: MousePointerClick, title: "Traffic doesn't convert", detail: "The website gets visits but doesn't turn them into booked calls." },
  { icon: FileWarning, title: "Owners drown in admin", detail: "Intake, scheduling, invoicing, and data entry eat the hours that should grow the business." },
  { icon: Database, title: "Your CRM is a graveyard", detail: "Stale, half-filled records you can't actually run a follow-up campaign on." },
];

export function V2Problem() {
  return (
    <section className="relative overflow-hidden bg-bg-base py-24 sm:py-28">
      <BlueprintGrid fade="center" />
      <div className="ambient-glow-left" />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 relative">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          {/* Left: sticky header */}
          <AnimateOnScroll className="lg:sticky lg:top-28 lg:self-start">
            <SectionMarker n="03" label="The Bottleneck" className="mb-5" />
            <h2 className="section-heading">
              Growth doesn&apos;t stall from lack of demand.
              <span className="text-white-muted"> It stalls in the gaps.</span>
            </h2>
            <p className="section-description !mx-0">
              The leads are coming in. They&apos;re falling through the cracks between your phone, your inbox, your website, and your team. That&apos;s what we close.
            </p>
            <Link
              href="/contact"
              className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-gold-light transition-colors hover:text-gold"
            >
              See where you&apos;re leaking revenue
              <ArrowRight className="h-4 w-4" />
            </Link>
          </AnimateOnScroll>

          {/* Right: pain list */}
          <div className="flex flex-col">
            {stuckPoints.map((p, i) => {
              const Icon = p.icon;
              return (
                <AnimateOnScroll
                  key={p.title}
                  delay={i * 0.06}
                  className="group flex items-start gap-5 border-b border-border-glass py-6 first:border-t"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border-glass bg-[var(--glass-default-bg)] text-gold transition-colors group-hover:border-[var(--border-gold-hover)]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-heading sm:text-lg">
                      {p.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-white-muted">
                      {p.detail}
                    </p>
                  </div>
                </AnimateOnScroll>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
