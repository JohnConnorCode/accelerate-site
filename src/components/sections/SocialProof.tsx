"use client";

import { useRef } from "react";
import { Star } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-init";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
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
    <div className="glass rounded-xl p-8 w-[340px] shrink-0 flex flex-col">
      {/* Stars */}
      <div className="flex gap-1 mb-4">
        {Array.from({ length: rating }).map((_, i) => (
          <Star
            key={i}
            className="w-4 h-4 fill-[var(--gold-base)] text-[var(--gold-base)]"
          />
        ))}
      </div>

      {/* Quote */}
      <blockquote className="text-[var(--text-nav)] leading-relaxed mb-6 flex-1 text-sm">
        &ldquo;{quote}&rdquo;
      </blockquote>

      {/* Attribution */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] flex items-center justify-center text-xs font-semibold text-[var(--gold-light)]">
          {initials}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{name}</p>
          <p className="text-xs text-[var(--white-muted)]">
            {title}, {businessType}
          </p>
        </div>
      </div>
    </div>
  );
}

export function SocialProof() {
  const doubled = [...testimonials, ...testimonials];
  const featured = testimonials[1] ?? testimonials[0];
  const marqueeRef = useRef<HTMLDivElement>(null);
  const pullQuoteRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    // Adjust marquee speed based on scroll velocity
    if (marqueeRef.current) {
      const track = marqueeRef.current.querySelector(".marquee-track") as HTMLElement;
      if (track) {
        gsap.to(track, {
          scrollTrigger: {
            trigger: marqueeRef.current,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
            onUpdate: (self) => {
              const velocity = Math.abs(self.getVelocity() / 1000);
              const speedMultiplier = Math.min(3, 1 + velocity * 0.3);
              track.style.animationDuration = `${30 / speedMultiplier}s`;
            },
          },
        });
      }
    }

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
    <section className="py-24 bg-[var(--bg-elevated)] overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimateOnScroll className="text-center mb-12">
          <h2 className="section-heading">
            Don&apos;t take our word for it.
          </h2>
        </AnimateOnScroll>

        {/* Featured pull-quote with clip-reveal */}
        <div ref={pullQuoteRef} className="mb-16 max-w-3xl mx-auto">
          <blockquote className="border-l-2 border-[var(--gold-base)] pl-8 text-3xl sm:text-4xl font-light italic text-[var(--text-nav)] leading-relaxed mb-6">
            &ldquo;Our revenue jumped 35% in the first quarter. Accelerate built our
            systems and runs them — it&apos;s like having a whole ops team we never had to hire.&rdquo;
          </blockquote>
          {featured && (
            <p className="text-sm text-[var(--gold-light)] text-right">
              {featured.name}, {featured.title} &mdash; {featured.businessType}
            </p>
          )}
        </div>
      </div>

      {/* Marquee with GSAP velocity control */}
      <div ref={marqueeRef} className="relative">
        {/* Edge fades */}
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[var(--bg-elevated)] to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[var(--bg-elevated)] to-transparent z-10 pointer-events-none" />

        <div className="marquee-track">
          {doubled.map((t, i) => (
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
