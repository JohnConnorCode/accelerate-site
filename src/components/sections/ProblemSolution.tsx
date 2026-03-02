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
    label: "Response Time",
    before: "Inquiries sit for hours. They move on.",
    after: "Every inquiry answered in minutes. Qualified, routed, followed up.",
    metric: "< 2 min",
    metricLabel: "avg response",
  },
  {
    label: "Content",
    before: "A post here, an email there. No rhythm.",
    after: "Blog, social, email — every week, in your voice, on schedule.",
    metric: "4x",
    metricLabel: "output volume",
  },
  {
    label: "Visibility",
    before: "Five tools. Half the data is stale.",
    after: "One weekly digest. Pipeline, revenue, reviews — all in one place.",
    metric: "1",
    metricLabel: "dashboard",
  },
  {
    label: "Onboarding",
    before: "Days of back-and-forth emails.",
    after: "Client signs → welcome → intake → appointment. Automatic.",
    metric: "90%",
    metricLabel: "less manual work",
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
          delay: i * 0.12,
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
    <section className="relative py-32 bg-[var(--bg-section-warm)] overflow-hidden">
      <div className="absolute inset-0 grid-overlay-fine pointer-events-none" />
      <div className="orb-gold -top-32 -right-32 opacity-60" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimateOnScroll className="mb-16">
          <SectionHeader
            label="What Changes"
            heading={
              <>
                Real results.{" "}
                <span className="text-gold-gradient">Not recommendations.</span>
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
          <div className="w-[100px]" />
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
                <div className="w-[100px] flex flex-col items-center justify-center border-l border-[var(--border-glass)] bg-[rgba(212,175,55,0.03)]">
                  <span className="text-xl font-bold text-[var(--gold-light)] leading-none">
                    {item.metric}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-[var(--white-muted)] mt-1 text-center px-2">
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
                <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(212,175,55,0.2)] to-transparent mb-2" />
                <p className="text-sm text-[var(--white-primary)] leading-relaxed font-medium">
                  {item.after}
                </p>
              </div>
            </div>
          ))}
        </div>

        <AnimateOnScroll variants={fadeUp} className="text-center mt-12">
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
