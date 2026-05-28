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
      { opacity: 0, x: 40 },
      {
        opacity: 1,
        x: 0,
        duration: 0.5,
        delay: 0.25,
        stagger: 0.07,
        ease: "power3.out",
        scrollTrigger: {
          trigger: listRef.current,
          start: "top 80%",
          toggleActions: "play none none none",
        },
      }
    );
  }, { scope: listRef });

  return (
    <section className="relative py-24 bg-[var(--bg-section-warm)] overflow-hidden">
      <div className="absolute inset-0 grid-overlay-fine pointer-events-none" />
      <div className="ambient-glow-left" />
      <div className="page-shell">
        <ScrollReveal animation="slide-left">
          <SectionHeader
            label="Who This Is For"
            heading={
              <>
                You&apos;re Doing <span className="text-gold-gradient">$200K–$10M</span>.
                Now What?
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
                className="group flex items-center gap-4 glass rounded-xl px-5 py-4 border-l-2 border-l-[rgba(var(--accent-rgb),0.2)] hover:border-l-[var(--gold-base)] hover:border-gold-glow transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-lg bg-transparent border border-border-glass flex items-center justify-center shrink-0 group-hover:border-border-gold group-hover:bg-[var(--glow-soft)] transition-all">
                  <Icon className="w-5 h-5 text-gold" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold text-heading leading-tight">
                    {audience.name}
                  </h3>
                  <p className="text-xs text-white-muted leading-relaxed mt-0.5 line-clamp-2 sm:line-clamp-1">
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
