"use client";

import Link from "next/link";
import { Star, ArrowRight } from "lucide-react";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { SectionMarker } from "@/components/v2/SectionMarker";
import { testimonials } from "@/content/testimonials";

// Three strongest, most specific quotes
const featured = ["testimonial-1", "testimonial-4", "testimonial-2"]
  .map((id) => testimonials.find((t) => t.id === id))
  .filter(Boolean) as typeof testimonials;

export function V2Proof() {
  return (
    <section className="relative overflow-hidden bg-[var(--bg-section-deep)] py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <AnimateOnScroll className="mb-14 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div className="max-w-xl">
            <SectionMarker n="07" label="Proof" className="mb-5" />
            <h2 className="section-heading">Real businesses. Real numbers.</h2>
          </div>
          <Link
            href="/results"
            className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-gold-light transition-colors hover:text-gold"
          >
            See all case studies
            <ArrowRight className="h-4 w-4" />
          </Link>
        </AnimateOnScroll>

        <div className="grid gap-5 lg:grid-cols-3">
          {featured.map((t, i) => (
            <AnimateOnScroll
              key={t.id}
              delay={i * 0.1}
              className="flex h-full flex-col rounded-2xl border border-border-glass bg-[var(--glass-default-bg)] p-7 backdrop-blur-md transition-colors hover:border-[var(--border-gold-hover)]"
            >
              <div className="mb-4 flex gap-0.5">
                {Array.from({ length: t.rating }).map((_, idx) => (
                  <Star key={idx} className="h-4 w-4 fill-[var(--gold-base)] text-gold" />
                ))}
              </div>
              <blockquote className="flex-1 text-[0.95rem] leading-relaxed text-white-secondary">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <div className="mt-6 border-t border-border-glass pt-4">
                <p className="text-sm font-semibold text-heading">{t.name}</p>
                <p className="text-xs text-white-muted">
                  {t.title}, {t.businessType}
                </p>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
