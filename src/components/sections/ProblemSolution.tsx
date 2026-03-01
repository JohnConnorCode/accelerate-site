"use client";

import { PhoneOff, Clock, Cog, EyeOff } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { AnimateOnScroll, StaggerContainer } from "@/components/ui/AnimateOnScroll";
import { fadeUp } from "@/lib/animations";

const problems = [
  {
    icon: PhoneOff,
    title: "Missed Calls",
    description:
      "You are on a job and the phone rings. By the time you call back, they hired someone else. Every missed call is money walking away.",
  },
  {
    icon: Clock,
    title: "Slow Follow-Up",
    description:
      "Leads come in but nobody follows up for days. 80% of deals go to whoever responds first. If that is not you, you lose.",
  },
  {
    icon: Cog,
    title: "Manual Everything",
    description:
      "Copying data between apps. Sending emails one at a time. Doing repetitive work that a machine should handle while you focus on clients.",
  },
  {
    icon: EyeOff,
    title: "Invisible Online",
    description:
      "Your website was built years ago. Nobody can find you on Google. Meanwhile, your competitors are showing up everywhere.",
  },
];

export function ProblemSolution() {
  return (
    <section className="py-24 bg-[var(--bg-elevated)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimateOnScroll className="text-center mb-16">
          <h2
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4"
            style={{ fontFamily: "var(--font-space-grotesk), var(--font-inter), sans-serif" }}
          >
            <span className="text-gold-gradient">The Problems</span>{" "}
            Costing You Money
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            These are the gaps in your business where leads, revenue, and time
            fall through every single day.
          </p>
        </AnimateOnScroll>

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {problems.map((problem) => (
            <AnimateOnScroll key={problem.title} variants={fadeUp}>
              <GlassCard hover="lift" padding="lg" className="h-full">
                <problem.icon className="w-10 h-10 text-[var(--gold-base)] mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">
                  {problem.title}
                </h3>
                <p className="text-white/60 leading-relaxed">
                  {problem.description}
                </p>
              </GlassCard>
            </AnimateOnScroll>
          ))}
        </StaggerContainer>

        <AnimateOnScroll className="text-center">
          <GlassCard variant="gold" padding="lg" className="max-w-3xl mx-auto">
            <h3
              className="text-2xl sm:text-3xl font-bold mb-3"
              style={{ fontFamily: "var(--font-space-grotesk), var(--font-inter), sans-serif" }}
            >
              We Fix All of This.
            </h3>
            <p className="text-white/65 leading-relaxed max-w-xl mx-auto">
              Accelerate builds AI-powered tools that answer your phone, follow up
              with leads instantly, automate your repetitive tasks, and put you at
              the top of Google. You focus on your work. We handle the rest.
            </p>
          </GlassCard>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
