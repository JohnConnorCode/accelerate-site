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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-init";
import { prefersReducedMotion } from "@/lib/utils";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";
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

export function ServicesOverview() {
  const listRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!listRef.current) return;
    if (prefersReducedMotion()) return;

    const rows = listRef.current.querySelectorAll("[data-service-row]");

    gsap.fromTo(rows,
      { opacity: 0, x: -24 },
      {
        opacity: 1,
        x: 0,
        duration: 0.5,
        delay: 0.3,
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
    <section className="relative py-24 bg-[var(--bg-base)] overflow-hidden">
      <div className="absolute inset-0 grid-diamond pointer-events-none" />
      <div className="ambient-glow-right" />

      {/* SYSTEMS watermark */}
      <div
        className="watermark-text top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[15vw]"
        aria-hidden="true"
      >
        SYSTEMS
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <AnimateOnScroll className="mb-16">
          <SectionHeader
            label="What We Do"
            heading={
              <>
                <span className="text-gold-gradient font-editorial">Six Systems</span> That
                Run Your Business
              </>
            }
            description="We find the highest-impact opportunities in your business, then build the systems that capture them. Every solution is scoped to your operations, your tools, and your goals."
          />
        </AnimateOnScroll>

        {/* Editorial numbered list */}
        <div ref={listRef} className="divide-y divide-[var(--border-glass)]">
          {serviceOverviewItems.map((service, idx) => {
            const Icon = iconMap[service.icon];
            if (!Icon) return null;
            return (
              <div
                key={service.name}
                data-service-row
                className="group py-6 sm:py-8 flex items-start gap-5 sm:gap-8 transition-colors duration-300 hover:bg-[rgba(var(--accent-rgb),0.02)]"
              >
                {/* Large faded index number */}
                <span className="text-gold-gradient font-display text-4xl sm:text-5xl font-bold leading-none opacity-25 group-hover:opacity-50 transition-opacity w-16 sm:w-20 shrink-0 text-right pt-1">
                  0{idx + 1}
                </span>

                {/* Icon */}
                <div className="w-10 h-10 rounded-lg border border-[var(--border-gold)] flex items-center justify-center shrink-0 mt-1 group-hover:bg-[var(--glow-soft)] transition-colors">
                  <Icon className="w-5 h-5 text-[var(--gold-base)]" aria-hidden="true" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg sm:text-xl font-semibold text-[var(--heading-color)] mb-1.5 group-hover:text-[var(--gold-light)] transition-colors">
                    {service.name}
                  </h3>
                  <p className="text-sm sm:text-base text-[var(--white-muted)] leading-relaxed">
                    {service.description}
                  </p>
                </div>

                {/* Hover arrow */}
                <div className="hidden sm:flex items-center justify-center w-10 h-10 mt-1 shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-[-8px] group-hover:translate-x-0">
                  <ArrowRight className="w-5 h-5 text-[var(--gold-base)]" />
                </div>
              </div>
            );
          })}
        </div>

        <AnimateOnScroll variants={fadeUp} delay={0.2} className="flex items-center justify-center gap-4 flex-wrap mt-12">
          <Link href="/contact">
            <Button variant="primary" size="lg">
              Book a Free Discovery Call
              <ArrowRight className="w-5 h-5 ml-2" />
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
