"use client";

import { MessageSquare, Hammer, Rocket } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { AnimateOnScroll, StaggerContainer } from "@/components/ui/AnimateOnScroll";
import { fadeUp } from "@/lib/animations";

const steps = [
  {
    number: "01",
    icon: MessageSquare,
    title: "Free Consultation",
    description:
      "We learn your business, your bottlenecks, and your goals. 15 minutes, no commitment. You will walk away with a clear picture of what is possible.",
  },
  {
    number: "02",
    icon: Hammer,
    title: "Custom Build",
    description:
      "We design and build your AI-powered solution in 2 to 4 weeks. You review and approve everything along the way. No surprises.",
  },
  {
    number: "03",
    icon: Rocket,
    title: "Launch & Grow",
    description:
      "Your new system goes live and starts capturing leads while you focus on what you do best. We monitor performance and optimize continuously.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-[var(--bg-elevated)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimateOnScroll className="text-center mb-16">
          <h2
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4"
            style={{ fontFamily: "var(--font-space-grotesk), var(--font-inter), sans-serif" }}
          >
            Three Steps to{" "}
            <span className="text-gold-gradient">More Leads, Less Work</span>
          </h2>
        </AnimateOnScroll>

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connector line (desktop only) */}
          <div className="hidden md:block absolute top-1/2 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-[rgba(212,175,55,0.2)] to-transparent -translate-y-1/2 z-0" />

          {steps.map((step) => (
            <AnimateOnScroll key={step.number} variants={fadeUp}>
              <GlassCard
                hover="glow"
                padding="lg"
                className="relative z-10 text-center h-full"
              >
                <span
                  className="text-5xl font-bold text-gold-gradient block mb-5"
                  style={{ fontFamily: "var(--font-space-grotesk), var(--font-inter), sans-serif" }}
                >
                  {step.number}
                </span>
                <step.icon className="w-8 h-8 text-[var(--gold-base)] mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-3">
                  {step.title}
                </h3>
                <p className="text-white/60 leading-relaxed">
                  {step.description}
                </p>
              </GlassCard>
            </AnimateOnScroll>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
