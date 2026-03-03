"use client";

import { useRef } from "react";
import {
  Hammer,
  Layers,
  Wrench,
  Zap,
  MessageSquareText,
  ShieldOff,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-init";
import { prefersReducedMotion } from "@/lib/utils";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { differentiators } from "@/content/why-accelerate";

const iconMap: Record<string, LucideIcon> = {
  Hammer,
  Layers,
  Wrench,
  Zap,
  MessageSquareText,
  ShieldOff,
};

export function WhyAccelerate() {
  const gridRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!gridRef.current) return;
    if (prefersReducedMotion()) return;

    const cards = gridRef.current.querySelectorAll("[data-why-card]");

    gsap.fromTo(cards,
      { opacity: 0, y: 24 },
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        stagger: 0.1,
        ease: "power2.out",
        scrollTrigger: {
          trigger: gridRef.current,
          start: "top 80%",
          toggleActions: "play none none none",
        },
      }
    );
  }, { scope: gridRef });

  // Split: first 2 items are "hero" cards, rest are smaller
  const heroItems = differentiators.slice(0, 2);
  const restItems = differentiators.slice(2);

  return (
    <section className="relative py-32 bg-[var(--bg-base)] overflow-hidden">
      <div className="absolute inset-0 dot-grid pointer-events-none" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimateOnScroll className="mb-16">
          <SectionHeader
            label="Why Us"
            heading={
              <>
                Strategy, Systems, and Management —{" "}
                <span className="text-gold-gradient">One Team</span>
              </>
            }
            description="We build and run AI systems for your business. Strategy, implementation, and ongoing management — all from one team that actually understands your operations."
          />
        </AnimateOnScroll>

        {/* Bento grid: 2 large + 4 small */}
        <div ref={gridRef} className="space-y-4">
          {/* Top row: 2 hero cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {heroItems.map((item) => {
              const Icon = iconMap[item.icon];
              if (!Icon) return null;
              return (
                <GlassCard
                  key={item.title}
                  data-why-card
                  hover="lift"
                  padding="none"
                  className="overflow-hidden"
                >
                  <div className="p-6 sm:p-8 md:p-10 flex flex-col h-full min-h-[160px] sm:min-h-[200px]">
                    <div className="flex items-center gap-4 mb-5">
                      <div className="w-14 h-14 rounded-xl bg-[var(--glow-soft)] flex items-center justify-center shrink-0">
                        <Icon className="w-7 h-7 text-[var(--gold-base)]" aria-hidden="true" />
                      </div>
                      <h3 className="text-xl font-semibold text-[var(--heading-color)]">
                        {item.title}
                      </h3>
                    </div>
                    <p className="text-[var(--white-secondary)] leading-relaxed flex-1">
                      {item.description}
                    </p>
                  </div>
                </GlassCard>
              );
            })}
          </div>

          {/* Bottom row: 4 compact cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {restItems.map((item) => {
              const Icon = iconMap[item.icon];
              if (!Icon) return null;
              return (
                <GlassCard
                  key={item.title}
                  data-why-card
                  hover="lift"
                  padding="lg"
                  className="overflow-hidden"
                >
                  <Icon className="w-6 h-6 text-[var(--gold-base)] mb-4" aria-hidden="true" />
                  <h3 className="text-base font-semibold text-[var(--heading-color)] mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-[var(--white-muted)] leading-relaxed">
                    {item.description}
                  </p>
                </GlassCard>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
