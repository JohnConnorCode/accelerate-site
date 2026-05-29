"use client";

import { useRef } from "react";
import Link from "next/link";
import {
  Compass,
  Workflow,
  TrendingUp,
  MessageCircle,
  PenTool,
  BarChart3,
  ArrowRight,
  ArrowUpRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-init";
import { prefersReducedMotion } from "@/lib/utils";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { Button } from "@/components/ui/Button";
import { SectionMarker } from "@/components/v2/SectionMarker";
import { BlueprintGrid } from "@/components/v2/BlueprintGrid";
import { fadeUp } from "@/lib/animations";
import { serviceOverviewItems } from "@/content/services-overview";

const iconMap: Record<string, LucideIcon> = {
  Compass,
  Workflow,
  TrendingUp,
  MessageCircle,
  PenTool,
  BarChart3,
};

// Asymmetric bento spans (lg+, 6-col grid). Featured cards span wider.
const bentoSpan = [
  "lg:col-span-4",
  "lg:col-span-2",
  "lg:col-span-2",
  "lg:col-span-4",
  "lg:col-span-3",
  "lg:col-span-3",
];

export function ServicesOverview() {
  const gridRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!gridRef.current) return;
    if (prefersReducedMotion()) return;

    const cards = gridRef.current.querySelectorAll("[data-service-card]");
    gsap.fromTo(
      cards,
      { opacity: 0, y: 28 },
      {
        opacity: 1,
        y: 0,
        duration: 0.55,
        stagger: 0.08,
        ease: "power3.out",
        scrollTrigger: {
          trigger: gridRef.current,
          start: "top 82%",
          toggleActions: "play none none none",
        },
      }
    );
  }, { scope: gridRef });

  return (
    <section className="relative py-24 sm:py-28 bg-bg-base overflow-hidden">
      <BlueprintGrid fade="top" />
      <div className="ambient-glow-right" />

      <div className="page-shell relative">
        {/* Left-aligned header — breaks the centered rhythm */}
        <AnimateOnScroll className="mb-12 max-w-2xl">
          <SectionMarker n="02" label="Services" className="mb-5" />
          <h2 className="section-heading">
            Six systems that run your business
          </h2>
          <p className="section-description">
            We find the highest-impact opportunities in your operations, then
            build the systems that capture them, scoped to your tools, your
            team, and your goals.
          </p>
        </AnimateOnScroll>

        {/* Bento grid */}
        <div
          ref={gridRef}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 sm:gap-5"
        >
          {serviceOverviewItems.map((service, idx) => {
            const Icon = iconMap[service.icon];
            if (!Icon) return null;
            const featured = bentoSpan[idx]?.includes("col-span-4");
            return (
              <div
                key={service.name}
                data-service-card
                className={`${bentoSpan[idx] ?? "lg:col-span-2"} group relative flex flex-col overflow-hidden rounded-2xl border border-border-glass bg-[var(--glass-default-bg)] p-7 sm:p-8 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[var(--border-gold-hover)] hover:bg-[var(--glass-gold-bg)]`}
              >
                {/* top hairline that lights up on hover */}
                <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--gold-base)] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-60" />

                <div className="mb-5 flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border-gold bg-[var(--glow-soft)] transition-colors group-hover:bg-[var(--glow-medium)]">
                    <Icon className="h-6 w-6 text-gold" aria-hidden="true" />
                  </div>
                  <span className="font-display text-2xl font-bold leading-none text-gold opacity-15 transition-opacity group-hover:opacity-35">
                    0{idx + 1}
                  </span>
                </div>

                <h3
                  className={`mb-2 font-semibold text-heading transition-colors group-hover:text-gold-light ${
                    featured ? "text-xl sm:text-2xl" : "text-lg sm:text-xl"
                  }`}
                >
                  {service.name}
                </h3>
                <p className="text-sm sm:text-[0.95rem] leading-relaxed text-white-muted max-w-prose">
                  {service.description}
                </p>

                <ArrowUpRight className="mt-auto ml-auto h-5 w-5 translate-y-1 text-gold opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100" />
              </div>
            );
          })}
        </div>

        <AnimateOnScroll variants={fadeUp} delay={0.15} className="mt-12 flex flex-wrap items-center gap-4">
          <Link href="/contact">
            <Button variant="primary" size="lg">
              Book a Free Discovery Call
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <Link href="/services">
            <Button variant="secondary" size="lg">
              View All Services
            </Button>
          </Link>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
