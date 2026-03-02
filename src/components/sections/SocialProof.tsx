"use client";

import { useRef } from "react";
import { Star } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-init";
import { prefersReducedMotion } from "@/lib/utils";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { testimonials } from "@/content/testimonials";

function TestimonialCard({
  quote,
  name,
  title,
  businessType,
  rating,
}: {
  quote: string;
  name: string;
  title: string;
  businessType: string;
  rating: number;
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("");

  return (
    <div className="glass rounded-xl p-5 sm:p-6 md:p-8 w-[240px] sm:w-[280px] md:w-[340px] shrink-0 flex flex-col">
      {/* Stars */}
      <div className="flex gap-1 mb-4">
        {Array.from({ length: rating }).map((_, i) => (
          <Star
            key={i}
            className="w-4 h-4 fill-[var(--gold-base)] text-[var(--gold-base)]"
            aria-hidden="true"
          />
        ))}
      </div>

      {/* Quote */}
      <blockquote className="text-[var(--white-secondary)] leading-relaxed mb-6 flex-1 text-sm">
        &ldquo;{quote}&rdquo;
      </blockquote>

      {/* Attribution */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] flex items-center justify-center text-xs font-semibold text-[var(--gold-light)]">
          {initials}
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--white-primary)]">{name}</p>
          <p className="text-xs text-[var(--white-muted)]">
            {title}, {businessType}
          </p>
        </div>
      </div>
    </div>
  );
}

export function SocialProof() {
  // Triple the array for seamless looping regardless of count
  const tripled = [...testimonials, ...testimonials, ...testimonials];
  const featured = testimonials[1] ?? testimonials[0];
  const pullQuoteRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (prefersReducedMotion()) return;

    // Clip-reveal on pull-quote
    if (pullQuoteRef.current) {
      gsap.fromTo(pullQuoteRef.current,
        { clipPath: "inset(100% 0 0 0)", opacity: 0 },
        {
          clipPath: "inset(0% 0 0 0)",
          opacity: 1,
          duration: 0.8,
          ease: "power2.out",
          scrollTrigger: {
            trigger: pullQuoteRef.current,
            start: "top 80%",
            toggleActions: "play none none none",
          },
        }
      );
    }
  });

  return (
    <section className="relative py-24 bg-[var(--bg-elevated)] overflow-hidden">
      <div className="absolute inset-0 grid-overlay-fine pointer-events-none opacity-50" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal animation="fade-up">
          <SectionHeader
            heading="Don&apos;t take our word for it."
            className="mb-12"
          />
        </ScrollReveal>

        {/* Full-bleed featured pull-quote — large, dramatic */}
        {featured && (
          <div ref={pullQuoteRef} className="mb-16">
            <div className="glass-gold rounded-2xl p-6 sm:p-10 md:p-16 max-w-4xl mx-auto relative">
              {/* Large decorative quote mark */}
              <span
                className="absolute top-4 left-6 sm:top-6 sm:left-10 font-display text-[8rem] leading-none text-[rgba(212,175,55,0.08)] select-none pointer-events-none"
                aria-hidden="true"
              >
                &ldquo;
              </span>
              <blockquote className="relative z-10 font-display text-xl sm:text-2xl md:text-4xl font-light italic text-[var(--white-primary)] leading-snug mb-6 sm:mb-8">
                {featured.quote}
              </blockquote>
              <div className="relative z-10 flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] flex items-center justify-center text-sm font-semibold text-[var(--gold-light)]">
                  {featured.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--white-primary)]">
                    {featured.name}
                  </p>
                  <p className="text-xs text-[var(--white-muted)]">
                    {featured.title}, {featured.businessType}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Accessible summary for screen readers */}
      <div className="sr-only" role="region" aria-label="Client testimonials">
        <h3>What our clients say</h3>
        <ul>
          {testimonials.map((t) => (
            <li key={t.id}>
              &ldquo;{t.quote}&rdquo; — {t.name}, {t.title} at {t.businessType}
            </li>
          ))}
        </ul>
      </div>

      {/* Marquee — pure CSS infinite scroll */}
      <div className="relative">
        {/* Edge fades */}
        <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-24 md:w-32 bg-gradient-to-r from-[var(--bg-elevated)] to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-24 md:w-32 bg-gradient-to-l from-[var(--bg-elevated)] to-transparent z-10 pointer-events-none" />

        <div className="marquee-track" aria-hidden="true">
          {tripled.map((t, i) => (
            <TestimonialCard
              key={`${t.id}-${i}`}
              quote={t.quote}
              name={t.name}
              title={t.title}
              businessType={t.businessType}
              rating={t.rating}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
