"use client";

import Link from "next/link";
import { Globe, Zap, Bot, ArrowRight } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { AnimateOnScroll, StaggerContainer } from "@/components/ui/AnimateOnScroll";
import { fadeUp } from "@/lib/animations";

const iconMap: Record<string, React.ElementType> = { Globe, Zap, Bot };

const services = [
  {
    icon: "Globe",
    name: "AI-Powered Websites",
    description:
      "Fast, SEO-optimized, conversion-focused websites that actually generate leads. Built to load fast, rank high, and turn visitors into customers.",
    price: "From $2,500",
    href: "/services#websites",
  },
  {
    icon: "Zap",
    name: "Automations & Workflows",
    description:
      "Lead nurture sequences, CRM integration, and task automation that saves 10+ hours per week. Connect your tools and let them work together.",
    price: "From $1,500 + $300/mo",
    href: "/services#automations",
  },
  {
    icon: "Bot",
    name: "AI Agents",
    description:
      "Phone answering, chat support, and appointment booking that works 24/7. Never miss another lead, even at 2 AM on a Saturday.",
    price: "From $1,500 + $300/mo",
    href: "/services#agents",
  },
];

export function ServicesOverview() {
  return (
    <section className="py-24 bg-[var(--bg-base)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimateOnScroll className="text-center mb-16">
          <h2
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4"
            style={{ fontFamily: "var(--font-space-grotesk), var(--font-inter), sans-serif" }}
          >
            What We Build
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Three solutions. One goal: more leads, less manual work, faster growth.
          </p>
        </AnimateOnScroll>

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {services.map((service) => {
            const Icon = iconMap[service.icon];
            if (!Icon) return null;
            return (
              <AnimateOnScroll key={service.name} variants={fadeUp}>
                <GlassCard hover="lift" padding="lg" className="h-full flex flex-col">
                  <Icon className="w-10 h-10 text-[var(--gold-base)] mb-5" />
                  <h3 className="text-xl font-semibold text-white mb-3">
                    {service.name}
                  </h3>
                  <p className="text-white/60 leading-relaxed mb-4 flex-1">
                    {service.description}
                  </p>
                  <p className="text-sm text-[var(--gold-light)] font-medium mb-4">
                    {service.price}
                  </p>
                  <Link
                    href={service.href}
                    className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white link-gold-underline transition-colors"
                  >
                    Learn More
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </GlassCard>
              </AnimateOnScroll>
            );
          })}
        </StaggerContainer>
      </div>
    </section>
  );
}
