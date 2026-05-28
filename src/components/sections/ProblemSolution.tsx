"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowRight, ArrowDown } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-init";
import { prefersReducedMotion } from "@/lib/utils";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { Button } from "@/components/ui/Button";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { fadeUp } from "@/lib/animations";

const comparisons = [
  {
    label: "Your Time",
    before: "You're the bottleneck. Every decision, every follow-up, every fire runs through you.",
    after: "AI handles the repetitive work — you focus on the decisions only you can make.",
    metric: "20+",
    metricLabel: "hours back per week",
  },
  {
    label: "Your Revenue",
    before: "Inquiries slip through the cracks. Follow-ups get missed. You're losing jobs every week.",
    after: "Every inquiry answered in minutes. Every follow-up automatic. Revenue captured, not lost.",
    metric: "38%",
    metricLabel: "more jobs booked",
  },
  {
    label: "Your Team",
    before: "You need a marketer, a receptionist, and an ops manager — but can't justify three salaries.",
    after: "AI agents handle intake, follow-ups, content, and scheduling. A full team without the payroll.",
    metric: "3",
    metricLabel: "roles, one system",
  },
  {
    label: "Your Growth",
    before: "More clients means more chaos. Revenue goes up, your life gets worse.",
    after: "Systems that scale with you. Twice the volume without twice the work.",
    metric: "1–2 wks",
    metricLabel: "to go live",
  },
];

export function ProblemSolution() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(() => {
    if (!sectionRef.current) return;
    if (prefersReducedMotion()) return;

    const leftPanel = sectionRef.current.querySelector("[data-panel-left]");
    const rightPanel = sectionRef.current.querySelector("[data-panel-right]");

    if (leftPanel) {
      gsap.fromTo(leftPanel,
        { opacity: 0, x: -60 },
        {
          opacity: 1,
          x: 0,
          duration: 0.8,
          delay: 0.2,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 75%",
            toggleActions: "play none none none",
          },
        }
      );
    }

    if (rightPanel) {
      gsap.fromTo(rightPanel,
        { opacity: 0, x: 60 },
        {
          opacity: 1,
          x: 0,
          duration: 0.8,
          delay: 0.35,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 75%",
            toggleActions: "play none none none",
          },
        }
      );
    }
  }, { scope: sectionRef });

  return (
    <section ref={sectionRef} className="relative py-20 bg-bg-base overflow-hidden">
      <div className="page-shell">
        <AnimateOnScroll className="mb-16">
          <SectionHeader
            align="left"
            label="Before & After"
            heading={
              <>
                Stop Losing Revenue to{" "}
                <span className="text-gold-gradient font-editorial">Broken Processes</span>
              </>
            }
          />
        </AnimateOnScroll>
      </div>

      {/* Full-width split screen */}
      <div className="grid grid-cols-1 md:grid-cols-2">
        {/* Problem side — dark */}
        <div
          data-panel-left
          className="bg-[var(--bg-section-deep)] py-12 sm:py-16 px-6 sm:px-10 lg:px-16"
        >
          <div className="max-w-lg ml-auto">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--error)] mb-8 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--error)]" />
              The Problem
            </p>
            <div className="space-y-8">
              {comparisons.map((item, i) => (
                <div key={i}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white-muted mb-2">
                    {item.label}
                  </p>
                  <p className="text-white-muted leading-relaxed text-sm sm:text-base">
                    {item.before}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Solution side — slightly lighter + gold accent */}
        <div
          data-panel-right
          className="relative bg-bg-elevated py-12 sm:py-16 px-6 sm:px-10 lg:px-16"
        >
          {/* Gold arrow divider — between panels on desktop */}
          <div className="hidden md:flex absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-bg-base border border-border-gold items-center justify-center z-10">
            <ArrowRight className="w-4 h-4 text-gold" />
          </div>

          {/* Mobile arrow divider */}
          <div className="md:hidden flex justify-center -mt-6 mb-6">
            <div className="w-10 h-10 rounded-full bg-bg-base border border-border-gold flex items-center justify-center">
              <ArrowDown className="w-4 h-4 text-gold" />
            </div>
          </div>

          <div className="max-w-lg mr-auto">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold mb-8 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-gold" />
              After Accelerate
            </p>
            <div className="space-y-8">
              {comparisons.map((item, i) => (
                <div key={i}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white-muted mb-2">
                    {item.label}
                  </p>
                  <div className="flex items-baseline gap-1.5 mb-2">
                    <span className="text-xl sm:text-2xl font-bold text-gold-light leading-none">
                      {item.metric}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-white-muted">
                      {item.metricLabel}
                    </span>
                  </div>
                  <p className="text-white-primary leading-relaxed font-medium text-sm sm:text-base">
                    {item.after}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="page-shell">
        <AnimateOnScroll variants={fadeUp} delay={0.2} className="text-center mt-12">
          <MagneticButton>
            <Link href="/contact">
              <Button variant="primary" size="lg" className="group/cta">
                Book a Free Discovery Call
                <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover/cta:translate-x-0.5" />
              </Button>
            </Link>
          </MagneticButton>
          <p className="text-sm text-white-muted mt-4 italic">
            You built the business. Let us build the engine.
          </p>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
