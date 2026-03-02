"use client";

import { useRef } from "react";
import {
  Wrench,
  Briefcase,
  HeartPulse,
  Store,
  Rocket,
  GraduationCap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-init";
import { prefersReducedMotion } from "@/lib/utils";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { audiences } from "@/content/who-this-is-for";

const iconMap: Record<string, LucideIcon> = {
  Wrench,
  Briefcase,
  HeartPulse,
  Store,
  Rocket,
  GraduationCap,
};

export function WhoThisIsFor() {
  const listRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!listRef.current) return;
    if (prefersReducedMotion()) return;

    const items = listRef.current.querySelectorAll("[data-audience-card]");

    gsap.fromTo(items,
      { opacity: 0, y: 24 },
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        stagger: 0.1,
        ease: "power2.out",
        scrollTrigger: {
          trigger: listRef.current,
          start: "top 80%",
          toggleActions: "play none none none",
        },
      }
    );
  }, { scope: listRef });

  return (
    <section className="relative py-32 bg-[var(--bg-section-warm)] overflow-hidden">
      <div className="absolute inset-0 grid-overlay-fine pointer-events-none" />
      <div className="orb-gold top-1/2 -left-48 -translate-y-1/2 opacity-50" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal animation="fade-up">
          <SectionHeader
            label="Who This Is For"
            heading={
              <>
                Built for businesses doing{" "}
                <span className="text-gold-gradient">$200K to $10M</span>
              </>
            }
            description="You have real revenue and real customers. You just don&apos;t have the time, team, or tech to run everything the way you know it should run."
            className="mb-16"
          />
        </ScrollReveal>

        <div
          ref={listRef}
          className="grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          {audiences.map((audience) => {
            const Icon = iconMap[audience.icon];
            if (!Icon) return null;
            return (
              <div
                key={audience.name}
                data-audience-card
                className="group flex items-center gap-4 glass rounded-xl px-5 py-4 hover:border-gold-glow transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-lg bg-[rgba(212,175,55,0.08)] flex items-center justify-center shrink-0 group-hover:bg-[rgba(212,175,55,0.15)] transition-colors">
                  <Icon className="w-5 h-5 text-[var(--gold-base)]" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold text-[var(--heading-color)] leading-tight">
                    {audience.name}
                  </h3>
                  <p className="text-xs text-[var(--white-muted)] leading-relaxed mt-0.5 line-clamp-2 sm:line-clamp-1">
                    {audience.examples}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
