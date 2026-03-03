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
import { GlassCard } from "@/components/ui/GlassCard";
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
  const gridRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!gridRef.current) return;
    if (prefersReducedMotion()) return;

    const cards = gridRef.current.querySelectorAll("[data-service-card]");

    gsap.fromTo(cards,
      { opacity: 0, y: 24 },
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        stagger: 0.1,
        ease: "power2.out",
        scrollTrigger: {
          trigger: gridRef.current,
          start: "top 80%",
          toggleActions: "play none none none",
        },
      }
    );
  }, { scope: gridRef });

  return (
    <section className="relative py-32 bg-[var(--bg-base)] overflow-hidden">
      <div className="absolute inset-0 grid-diamond pointer-events-none" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimateOnScroll className="mb-16">
          <SectionHeader
            label="What We Do"
            heading={
              <>
                AI That Actually{" "}
                <span className="text-gold-gradient">Moves the Needle</span>
              </>
            }
            description="We find the highest-impact opportunities in your business, then build the systems that capture them. Every solution is scoped to your operations, your tools, and your goals."
          />
        </AnimateOnScroll>

        <div
          ref={gridRef}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {serviceOverviewItems.map((service) => {
            const Icon = iconMap[service.icon];
            if (!Icon) return null;
            return (
              <GlassCard
                key={service.name}
                data-service-card
                hover="shine"
                padding="lg"
                className="h-full overflow-hidden flex flex-col"
              >
                <div className="w-12 h-12 rounded-lg bg-[var(--glow-soft)] flex items-center justify-center mb-5">
                  <Icon className="w-6 h-6 text-[var(--gold-base)]" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--heading-color)] mb-3">
                  {service.name}
                </h3>
                <p className="text-sm text-[var(--white-muted)] leading-relaxed flex-1">
                  {service.description}
                </p>
              </GlassCard>
            );
          })}
        </div>

        <AnimateOnScroll variants={fadeUp} className="text-center mt-12">
          <Link href="/contact">
            <Button variant="primary" size="lg">
              Book a Free Discovery Call
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
