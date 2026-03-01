"use client";

import { Star } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { AnimateOnScroll, StaggerContainer } from "@/components/ui/AnimateOnScroll";
import { fadeUp } from "@/lib/animations";
import { testimonials } from "@/content/testimonials";

export function SocialProof() {
  return (
    <section className="py-24 bg-[var(--bg-elevated)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimateOnScroll className="text-center mb-16">
          <h2
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4"
            style={{ fontFamily: "var(--font-space-grotesk), var(--font-inter), sans-serif" }}
          >
            What Our Clients Say
          </h2>
        </AnimateOnScroll>

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {testimonials.map((t) => (
            <AnimateOnScroll key={t.id} variants={fadeUp}>
              <GlassCard hover="glow" padding="lg" className="h-full flex flex-col">
                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4 fill-[var(--gold-base)] text-[var(--gold-base)]"
                    />
                  ))}
                </div>

                {/* Quote */}
                <blockquote className="text-white/70 leading-relaxed mb-6 flex-1">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>

                {/* Attribution */}
                <div>
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="text-xs text-white/40">
                    {t.title}, {t.businessType}
                  </p>
                </div>
              </GlassCard>
            </AnimateOnScroll>
          ))}
        </StaggerContainer>

        {/* Trusted By Placeholder */}
        <AnimateOnScroll className="text-center">
          <p className="text-sm text-white/30 uppercase tracking-wide mb-6">
            Trusted By
          </p>
          <div className="flex items-center justify-center gap-10 opacity-30">
            {["Client A", "Client B", "Client C", "Client D"].map((name) => (
              <div
                key={name}
                className="w-24 h-8 bg-white/5 rounded flex items-center justify-center text-xs text-white/30"
              >
                {name}
              </div>
            ))}
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
