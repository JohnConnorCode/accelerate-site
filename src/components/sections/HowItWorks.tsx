"use client";

import { useRef } from "react";
import { MessageSquare, Map, Rocket, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-init";
import { prefersReducedMotion } from "@/lib/utils";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { howItWorksSteps } from "@/content/how-it-works";

const iconMap: Record<string, LucideIcon> = {
  MessageSquare,
  Map,
  Rocket,
  TrendingUp,
};

export function HowItWorks() {
  const stepsRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!stepsRef.current) return;
    if (prefersReducedMotion()) return;

    const cards = stepsRef.current.querySelectorAll("[data-step-card]");

    gsap.fromTo(cards,
      { opacity: 0, y: 24 },
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        stagger: 0.12,
        ease: "power2.out",
        scrollTrigger: {
          trigger: stepsRef.current,
          start: "top 80%",
          toggleActions: "play none none none",
        },
      }
    );

    // Animate the connector line
    const connector = stepsRef.current.querySelector("[data-step-connector]");
    if (connector) {
      gsap.fromTo(connector,
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 1,
          ease: "power2.out",
          scrollTrigger: {
            trigger: stepsRef.current,
            start: "top 80%",
            toggleActions: "play none none none",
          },
        }
      );
    }
  }, { scope: stepsRef });

  return (
    <section id="how-it-works" className="relative py-32 bg-[var(--bg-section-deep)] overflow-hidden">
      <div className="absolute inset-0 grid-overlay-fine pointer-events-none" />
      <div className="orb-gold -bottom-48 -left-48 opacity-60" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal animation="fade-up">
          <SectionHeader
            label="How It Works"
            heading={
              <>
                Live in weeks.{" "}
                <span className="text-gold-gradient">Improving every month.</span>
              </>
            }
            className="mb-20"
          />
        </ScrollReveal>

        <div ref={stepsRef} className="relative">
          {/* Horizontal connector line — desktop */}
          <div
            data-step-connector
            className="hidden md:block absolute top-[44px] left-[5%] right-[5%] h-px origin-left"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.25) 15%, rgba(212,175,55,0.25) 85%, transparent)",
            }}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-6">
            {howItWorksSteps.map((step) => {
              const Icon = iconMap[step.icon];
              if (!Icon) return null;
              return (
                <div key={step.number} data-step-card className="relative">
                  {/* Number node */}
                  <div className="flex items-center gap-4 mb-5">
                    <div className="relative w-[56px] h-[56px] rounded-full flex items-center justify-center shrink-0 border border-[var(--border-gold)] bg-[var(--bg-section-deep)]">
                      <span className="font-display text-lg font-bold text-gold-gradient">
                        {step.number}
                      </span>
                    </div>
                    <div className="md:hidden h-px flex-1 bg-gradient-to-r from-[rgba(212,175,55,0.2)] to-transparent" />
                  </div>

                  {/* Content */}
                  <div className="pl-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-4 h-4 text-[var(--gold-base)]" aria-hidden="true" />
                      <h3 className="text-lg font-semibold text-[var(--heading-color)]">
                        {step.title}
                      </h3>
                    </div>
                    <p className="text-sm text-[var(--white-muted)] leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
