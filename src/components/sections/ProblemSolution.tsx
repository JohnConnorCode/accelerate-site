"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowRight, X, Check } from "lucide-react";
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
  const gridRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!gridRef.current) return;
    if (prefersReducedMotion()) return;

    const rows = gridRef.current.querySelectorAll("[data-comparison-row]");

    rows.forEach((row, i) => {
      gsap.fromTo(
        row,
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          delay: 0.25 + i * 0.12,
          ease: "power2.out",
          scrollTrigger: {
            trigger: gridRef.current,
            start: "top 80%",
            toggleActions: "play none none none",
          },
        }
      );
    });
  }, { scope: gridRef });

  return (
    <section className="relative py-32 bg-[var(--bg-base)] overflow-hidden">
      <div className="absolute inset-0 grid-overlay-fine pointer-events-none" />
      <div className="orb-gold -top-32 -right-32 opacity-60" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimateOnScroll className="mb-16">
          <SectionHeader
            label="Before & After"
            heading={
              <>
                Your Business Today vs.{" "}
                <span className="text-gold-gradient">With Accelerate</span>
              </>
            }
          />
        </AnimateOnScroll>

        {/* Table header — desktop only */}
        <div className="hidden md:grid grid-cols-[1fr_1fr_auto] gap-0 mb-3 px-2">
          <div className="flex items-center gap-2">
            <X className="w-3.5 h-3.5 text-[var(--error)]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--white-muted)]">
              Before
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-[var(--gold-base)]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--white-muted)]">
              After Accelerate
            </span>
          </div>
          <div className="w-[130px]" />
        </div>

        <div ref={gridRef} className="space-y-3">
          {comparisons.map((item, i) => (
            <div
              key={i}
              data-comparison-row
              className="glass rounded-2xl overflow-hidden hover:border-[var(--border-gold-hover)] transition-colors duration-300"
            >
              {/* Desktop layout */}
              <div className="hidden md:grid grid-cols-[1fr_1fr_auto] gap-0 items-stretch">
                {/* Before */}
                <div className="p-6 border-r border-[var(--border-glass)] relative">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--white-muted)] mb-2">
                    {item.label}
                  </p>
                  <p className="text-sm text-[var(--white-muted)] leading-relaxed line-through decoration-[var(--error)]/30">
                    {item.before}
                  </p>
                </div>

                {/* After */}
                <div className="p-6">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gold-base)] mb-2">
                    {item.label}
                  </p>
                  <p className="text-sm text-[var(--white-primary)] leading-relaxed font-medium">
                    {item.after}
                  </p>
                </div>

                {/* Metric */}
                <div className="w-[130px] flex flex-col items-center justify-center border-l border-[var(--border-glass)] bg-[var(--glass-gold-bg)]">
                  <span className="text-2xl sm:text-3xl font-bold text-[var(--gold-light)] leading-none">
                    {item.metric}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-[var(--white-muted)] mt-1.5 text-center px-2 leading-tight">
                    {item.metricLabel}
                  </span>
                </div>
              </div>

              {/* Mobile layout */}
              <div className="md:hidden p-5">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gold-base)]">
                    {item.label}
                  </span>
                  <div className="text-right">
                    <span className="text-lg font-bold text-[var(--gold-light)] leading-none">
                      {item.metric}
                    </span>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--white-muted)] mt-0.5">
                      {item.metricLabel}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-[var(--white-muted)] line-through decoration-[var(--error)]/30 mb-2">
                  {item.before}
                </p>
                <div className="h-px w-full bg-gradient-to-r from-transparent via-[var(--border-gold)] to-transparent mb-2" />
                <p className="text-sm text-[var(--white-primary)] leading-relaxed font-medium">
                  {item.after}
                </p>
              </div>
            </div>
          ))}
        </div>

        <AnimateOnScroll variants={fadeUp} delay={0.2} className="text-center mt-12">
          <MagneticButton>
            <Link href="/plan-builder">
              <Button variant="primary" size="lg" className="group/cta">
                Book a Free Discovery Call
                <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover/cta:translate-x-0.5" />
              </Button>
            </Link>
          </MagneticButton>
          <p className="text-sm text-[var(--white-muted)] mt-4 italic">
            You built the business. Let us build the engine.
          </p>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
