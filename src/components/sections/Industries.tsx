"use client";

import { useRef } from "react";
import Link from "next/link";
import { Wrench, Scale, Briefcase, Building2, ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-init";
import { prefersReducedMotion } from "@/lib/utils";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { GridPattern } from "@/components/ui/Illustrations";

const iconMap: Record<string, LucideIcon> = {
  Wrench,
  Scale,
  Briefcase,
  Building2,
};

const industries = [
  {
    name: "Home Services",
    icon: "Wrench",
    description:
      "Roofing, HVAC, plumbing, electrical. Answer every call and book more jobs — even from the job site.",
    href: "/industries/home-services",
  },
  {
    name: "Law Firms",
    icon: "Scale",
    description:
      "Solo practitioners and small firms. Faster intake, more signed retainers, less admin.",
    href: "/industries/law-firms",
  },
  {
    name: "Professional Services",
    icon: "Briefcase",
    description:
      "Accountants, advisors, consultants. Grow beyond referrals with systems that fill your calendar.",
    href: "/industries/professional-services",
  },
  {
    name: "Real Estate",
    icon: "Building2",
    description:
      "Agents and brokerages. Respond in seconds, nurture for months, close more deals.",
    href: "/industries/real-estate",
  },
];

export function Industries() {
  const gridRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!gridRef.current) return;
    if (prefersReducedMotion()) return;

    const cards = gridRef.current.querySelectorAll("[data-industry-card]");

    gsap.fromTo(cards,
      { opacity: 0, y: 24 },
      {
        opacity: 1,
        y: 0,
        duration: 0.6,
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
      <GridPattern className="absolute inset-0 opacity-[0.08] pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimateOnScroll className="mb-16">
          <SectionHeader
            heading={
              <>
                Built for How{" "}
                <span className="text-gold-gradient">Your Industry</span> Actually Works
              </>
            }
            description="Generic tools waste your money. We build systems around the way your customers find, choose, and hire you."
          />
        </AnimateOnScroll>

        <div
          ref={gridRef}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {industries.map((industry, i) => {
            const Icon = iconMap[industry.icon];
            if (!Icon) return null;
            const isOffset = i % 2 === 1;

            return (
              <div
                key={industry.name}
                data-industry-card
                className={isOffset ? "lg:mt-8" : ""}
              >
                <Link href={industry.href} className="block h-full group">
                  <div className="relative glass rounded-xl p-8 h-full flex flex-col items-start card-hover-shine hover:border-gold-glow transition-all duration-300 overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-px bg-gold-gradient scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                    <div className="w-12 h-12 rounded-lg bg-[rgba(var(--accent-rgb),0.08)] flex items-center justify-center mb-5">
                      <Icon className="w-6 h-6 text-[var(--gold-base)]" />
                    </div>
                    <h3 className="text-lg font-semibold text-[var(--heading-color)] mb-2">
                      {industry.name}
                    </h3>
                    <p className="text-sm text-[var(--white-muted)] leading-relaxed mb-4 flex-1">
                      {industry.description}
                    </p>
                    <span className="inline-flex items-center gap-1 text-sm text-[var(--white-muted)] group-hover:text-[var(--gold-light)] transition-colors">
                      Learn More
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
