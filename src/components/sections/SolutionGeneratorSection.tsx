"use client";

import dynamic from "next/dynamic";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";

const SolutionGenerator = dynamic(
  () =>
    import("@/components/solution-generator/SolutionGenerator").then(
      (mod) => mod.SolutionGenerator
    ),
  { ssr: false }
);

export function SolutionGeneratorSection() {
  return (
    <section
      id="solution-generator"
      className="py-24 bg-[var(--bg-base)] dot-grid"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimateOnScroll className="text-center mb-12">
          <h2
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4"
            style={{
              fontFamily:
                "var(--font-space-grotesk), var(--font-inter), sans-serif",
            }}
          >
            Get Your Custom{" "}
            <span className="text-gold-gradient">Growth Plan</span> in 5
            Minutes
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Answer a few questions about your business and our AI will build a
            personalized strategy with specific recommendations, timelines, and
            pricing.
          </p>
        </AnimateOnScroll>

        <SolutionGenerator />
      </div>
    </section>
  );
}
