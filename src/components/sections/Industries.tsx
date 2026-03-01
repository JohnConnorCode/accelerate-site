"use client";

import Link from "next/link";
import { Wrench, Scale, Briefcase, Building2, ArrowRight } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { AnimateOnScroll, StaggerContainer } from "@/components/ui/AnimateOnScroll";
import { fadeUp } from "@/lib/animations";

const iconMap: Record<string, React.ElementType> = {
  Wrench,
  Scale,
  Briefcase,
  Building2,
};

const industries = [
  {
    name: "Home Services",
    icon: "Wrench",
    description: "Roofing, HVAC, plumbing, electrical. Capture every call and book more jobs.",
    href: "/industries/home-services",
  },
  {
    name: "Law Firms",
    icon: "Scale",
    description: "Solo practitioners and small firms. Faster intake, more clients.",
    href: "/industries/law-firms",
  },
  {
    name: "Professional Services",
    icon: "Briefcase",
    description: "Accountants, advisors, consultants. Grow beyond referrals.",
    href: "/industries/professional-services",
  },
  {
    name: "Real Estate",
    icon: "Building2",
    description: "Agents and brokerages. Respond instantly, close more deals.",
    href: "/industries/real-estate",
  },
];

export function Industries() {
  return (
    <section className="py-24 bg-[var(--bg-base)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimateOnScroll className="text-center mb-16">
          <h2
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4"
            style={{ fontFamily: "var(--font-space-grotesk), var(--font-inter), sans-serif" }}
          >
            Built For{" "}
            <span className="text-gold-gradient">Your Industry</span>
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            We specialize in the industries we know best. Tailored solutions, not generic templates.
          </p>
        </AnimateOnScroll>

        <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {industries.map((industry) => {
            const Icon = iconMap[industry.icon];
            if (!Icon) return null;
            return (
              <AnimateOnScroll key={industry.name} variants={fadeUp}>
                <Link href={industry.href} className="block h-full">
                  <GlassCard
                    hover="lift"
                    padding="lg"
                    className="h-full flex flex-col items-start group"
                  >
                    <Icon className="w-10 h-10 text-[var(--gold-base)] mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {industry.name}
                    </h3>
                    <p className="text-sm text-white/55 leading-relaxed mb-4 flex-1">
                      {industry.description}
                    </p>
                    <span className="inline-flex items-center gap-1 text-sm text-white/50 group-hover:text-[var(--gold-light)] transition-colors">
                      Learn More
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </GlassCard>
                </Link>
              </AnimateOnScroll>
            );
          })}
        </StaggerContainer>
      </div>
    </section>
  );
}
