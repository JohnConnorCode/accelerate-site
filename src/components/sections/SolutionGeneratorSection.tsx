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
      className="py-32 bg-[var(--bg-base)] relative overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 grid-overlay-fine opacity-20" />
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full"
          style={{
            background: "radial-gradient(ellipse, rgba(212,175,55,0.08) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <AnimateOnScroll className="text-center mb-12">
          <p className="section-label">
            AI-Powered Strategy
          </p>
          <h2
            className="section-heading mb-4"
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
