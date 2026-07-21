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
  const timelineRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!timelineRef.current) return;
    if (prefersReducedMotion()) return;

    // Animate the vertical rail line
    const rail = timelineRef.current.querySelector("[data-timeline-rail]");
    if (rail) {
      gsap.fromTo(rail,
        { scaleY: 0 },
        {
          scaleY: 1,
          duration: 1.2,
          delay: 0.2,
          ease: "power2.out",
          scrollTrigger: {
            trigger: timelineRef.current,
            start: "top 80%",
            toggleActions: "play none none none",
          },
        }
      );
    }

    // Animate each step
    const steps = timelineRef.current.querySelectorAll("[data-timeline-step]");
    gsap.fromTo(steps,
      { opacity: 0, x: 40 },
      {
        opacity: 1,
        x: 0,
        duration: 0.6,
        delay: 0.4,
        stagger: 0.2,
        ease: "power2.out",
        scrollTrigger: {
          trigger: timelineRef.current,
          start: "top 80%",
          toggleActions: "play none none none",
        },
      }
    );

    // Animate dot nodes
    const dots = timelineRef.current.querySelectorAll("[data-timeline-dot]");
    gsap.fromTo(dots,
      { scale: 0 },
      {
        scale: 1,
        duration: 0.4,
        delay: 0.5,
        stagger: 0.2,
        ease: "back.out(2)",
        scrollTrigger: {
          trigger: timelineRef.current,
          start: "top 80%",
          toggleActions: "play none none none",
        },
      }
    );
  }, { scope: timelineRef });

  return (
    <section id="how-it-works" className="relative py-24 bg-[var(--bg-section-deep)] overflow-hidden">
      <div className="absolute inset-0 grid-overlay-fine pointer-events-none" />
      <div className="ambient-glow-left" />

      {/* PROCESS watermark */}
      <div
        className="watermark-text top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[15vw]"
        aria-hidden="true"
      >
        PROCESS
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <ScrollReveal animation="blur-up">
          <SectionHeader
            label="How It Works"
            heading={
              <>
                From Strategy Call to{" "}
                <span className="text-gold">Live Systems</span>, Fast
              </>
            }
            className="mb-20"
          />
        </ScrollReveal>

        {/* Vertical timeline */}
        <div ref={timelineRef} className="relative">
          {/* Gold left rail line */}
          <div
            data-timeline-rail
            className="absolute left-6 sm:left-8 top-0 bottom-0 w-px origin-top"
            style={{
              background: "linear-gradient(to bottom, var(--gold-base), rgba(var(--accent-rgb), 0.15))",
            }}
          />

          <div className="space-y-12 sm:space-y-16">
            {howItWorksSteps.map((step) => {
              const Icon = iconMap[step.icon];
              if (!Icon) return null;
              return (
                <div key={step.number} data-timeline-step className="relative pl-14 sm:pl-20">
                  {/* Dot node on the rail */}
                  <div
                    data-timeline-dot
                    className="absolute left-[14px] sm:left-[22px] top-2 w-6 h-6 rounded-full border-2 border-gold bg-[var(--bg-section-deep)] flex items-center justify-center"
                  >
                    <div className="w-2 h-2 rounded-full bg-[var(--gold-light)]" />
                  </div>

                  {/* Large faded step number */}
                  <span
                    className="absolute left-14 sm:left-20 -top-4 text-gold-gradient font-display text-5xl sm:text-7xl font-bold leading-none opacity-[0.07] pointer-events-none select-none"
                    aria-hidden="true"
                  >
                    {step.number}
                  </span>

                  {/* Content */}
                  <div className="relative">
                    <div className="flex items-center gap-2.5 mb-2">
                      <Icon className="w-4 h-4 text-gold" aria-hidden="true" />
                      <h3 className="text-xl font-semibold text-heading">
                        {step.title}
                      </h3>
                    </div>
                    <p className="text-white-muted leading-relaxed max-w-lg">
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
