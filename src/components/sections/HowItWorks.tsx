"use client";

import { MessageSquare, Hammer, Rocket } from "lucide-react";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { slideFromLeft, slideFromRight } from "@/lib/animations";

const steps = [
  {
    number: "01",
    icon: MessageSquare,
    title: "We Learn Your Business",
    description:
      "A free strategy session where we audit your operations and build a prioritized roadmap.",
  },
  {
    number: "02",
    icon: Hammer,
    title: "We Build Your Systems",
    description:
      "Your dedicated team designs, builds, and tests every integration before it goes live.",
  },
  {
    number: "03",
    icon: Rocket,
    title: "We Run It With You",
    description:
      "We don't hand off and disappear. We operate, monitor, and optimize alongside you — every month.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-32 bg-[var(--bg-section-deep)]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimateOnScroll className="text-center mb-20">
          <h2 className="section-heading">
            Live in weeks.{" "}
            <span className="text-gold-gradient">Improving every month.</span>
          </h2>
        </AnimateOnScroll>

        <div className="relative space-y-20">
          {/* Vertical connector line (desktop) */}
          <div
            className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2"
            style={{
              background:
                "linear-gradient(to bottom, transparent, rgba(212,175,55,0.15) 20%, rgba(212,175,55,0.15) 80%, transparent)",
            }}
          />

          {steps.map((step, i) => {
            const isEven = i % 2 === 0;
            return (
              <div
                key={step.number}
                className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-8 lg:gap-12 items-center"
              >
                {/* Content — alternates sides */}
                <AnimateOnScroll
                  variants={isEven ? slideFromLeft : slideFromRight}
                  className={`${isEven ? "lg:order-1" : "lg:order-3 lg:text-left"}`}
                >
                  <div className={isEven ? "lg:text-right" : ""}>
                    <step.icon className="w-6 h-6 text-[var(--gold-base)] mb-3 lg:hidden" />
                    <h3 className="text-xl font-semibold text-white mb-2">
                      {step.title}
                    </h3>
                    <p className="text-lg text-[var(--white-muted)] leading-relaxed max-w-md">
                      {step.description}
                    </p>
                  </div>
                </AnimateOnScroll>

                {/* Center number node */}
                <div className="hidden lg:flex order-2 flex-col items-center">
                  <div
                    className="relative w-[136px] h-[136px] rounded-full flex items-center justify-center"
                    style={{
                      background:
                        "radial-gradient(circle, rgba(212,175,55,0.08) 0%, transparent 70%)",
                    }}
                  >
                    <div className="absolute inset-0 rounded-full border border-white/[0.06]" />
                    <span className="font-display text-4xl font-bold text-gold-gradient">
                      {step.number}
                    </span>
                  </div>
                </div>

                {/* Empty space for alternation */}
                <div
                  className={`hidden lg:flex ${isEven ? "order-3" : "order-1"} items-center ${isEven ? "justify-start" : "justify-end"}`}
                >
                  <step.icon className="w-10 h-10 text-[var(--gold-base)] opacity-40" />
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
