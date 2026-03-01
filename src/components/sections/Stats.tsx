"use client";

import { CountUp } from "@/components/ui/CountUp";
import { AnimateOnScroll, StaggerContainer } from "@/components/ui/AnimateOnScroll";
import { fadeUp } from "@/lib/animations";
import { stats } from "@/content/stats";

export function Stats() {
  return (
    <section className="py-20 bg-[var(--bg-base)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
          {stats.map((stat) => (
            <AnimateOnScroll
              key={stat.label}
              variants={fadeUp}
              className="text-center"
            >
              <p
                className="text-3xl sm:text-4xl md:text-5xl font-bold text-gold-gradient mb-2"
                style={{ fontFamily: "var(--font-space-grotesk), var(--font-inter), sans-serif" }}
              >
                {stat.value.startsWith("$") ? "$" : ""}
                <CountUp
                  end={stat.numericValue}
                  suffix={stat.suffix}
                />
              </p>
              <p className="text-sm text-white/50">{stat.label}</p>
            </AnimateOnScroll>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
