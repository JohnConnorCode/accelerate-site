"use client";

import { Hammer, Layers, Wrench, Zap, MessageSquareText, ShieldOff } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { SectionMarker } from "@/components/v2/SectionMarker";
import { differentiators } from "@/content/why-accelerate";

const iconMap: Record<string, LucideIcon> = {
  Hammer,
  Layers,
  Wrench,
  Zap,
  MessageSquareText,
  ShieldOff,
};

export function V2Why() {
  return (
    <section className="relative overflow-hidden bg-bg-base py-24 sm:py-28">
      <div className="ambient-glow-right" />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <AnimateOnScroll className="mx-auto mb-16 max-w-3xl text-center">
          <SectionMarker n="06" label="Why Accelerate" className="mb-5 justify-center" />
          <h2 className="section-heading">
            Not an agency. Not software.{" "}
            <span className="text-shimmer font-editorial">Your operations team.</span>
          </h2>
          <p className="section-description">
            Agencies hand you a strategy and walk away. Platforms hand you tools and wish you luck. We advise, build, and run the systems with you — one team, full accountability.
          </p>
        </AnimateOnScroll>

        <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {differentiators.map((d) => {
            const Icon = iconMap[d.icon] ?? Zap;
            return (
              <AnimateOnScroll key={d.title} className="border-l-2 border-border-gold pl-5">
                <Icon className="mb-3 h-6 w-6 text-gold" aria-hidden="true" />
                <h3 className="mb-2 text-lg font-semibold text-heading">
                  {d.title}
                </h3>
                <p className="text-sm leading-relaxed text-white-muted">
                  {d.description}
                </p>
              </AnimateOnScroll>
            );
          })}
        </div>
      </div>
    </section>
  );
}
