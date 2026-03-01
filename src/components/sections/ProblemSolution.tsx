"use client";

import { useState } from "react";
import { PhoneOff, Clock, Cog, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { slideFromLeft, slideFromRight } from "@/lib/animations";

const problems = [
  {
    icon: PhoneOff,
    title: "The Phone Rang. You Were on a Job.",
    description:
      "By the time you called back, they'd already hired someone else.",
  },
  {
    icon: Clock,
    title: "You Worked 10 Hours. Only 4 Were Billable.",
    description:
      "Scheduling, follow-ups, invoicing — eating the hours you should be spending on clients.",
  },
  {
    icon: Cog,
    title: "Your CRM Doesn't Talk to Your Calendar",
    description:
      "And neither talks to your inbox, your phone system, or your follow-up process.",
  },
  {
    icon: EyeOff,
    title: "Your Competitor Answers Calls at Midnight",
    description:
      "They're automating intake, follow-up, and booking. You're still doing it manually.",
  },
];

const impactMetrics = [
  { label: "Response time", value: "< 60s", detail: "Down from 4+ hours" },
  { label: "Revenue lift", value: "+40%", detail: "Average after 90 days" },
  { label: "Hours saved", value: "10+/wk", detail: "On admin and follow-up" },
];

const solutionPoints = [
  "Websites that convert visitors into booked consultations",
  "Automations connecting your CRM, calendar, email, and SMS",
  "AI agents answering calls, qualifying inquiries, and booking 24/7",
  "Knowledge bases, dashboards, and tools — all managed for you",
];

export function ProblemSolution() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <section className="relative py-32 bg-[var(--bg-section-warm)] overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 grid-overlay-fine pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Left-aligned heading */}
        <AnimateOnScroll variants={slideFromLeft} className="mb-16">
          <p className="section-label">
            Sound Familiar?
          </p>
          <h2 className="section-heading">
            The gaps between you and the revenue you should be earning.
          </h2>
        </AnimateOnScroll>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Left: Numbered vertical list */}
          <AnimateOnScroll variants={slideFromLeft}>
            <div className="space-y-0">
              {problems.map((problem, i) => (
                <motion.div
                  key={problem.title}
                  className="group flex items-start gap-5 py-6 border-b border-white/[0.06] cursor-default"
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <span
                    className={`font-display text-3xl font-bold tabular-nums transition-colors duration-300 ${
                      hoveredIndex === i
                        ? "text-[var(--gold-base)]"
                        : "text-white/15"
                    }`}
                  >
                    0{i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5">
                      <problem.icon
                        className={`w-5 h-5 transition-colors duration-300 ${
                          hoveredIndex === i
                            ? "text-[var(--gold-base)]"
                            : "text-[var(--white-muted)]"
                        }`}
                      />
                      <h3 className="text-lg font-semibold text-white">
                        {problem.title}
                      </h3>
                    </div>
                    <p className="text-[var(--white-muted)] leading-relaxed text-sm">
                      {problem.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimateOnScroll>

          {/* Right: Sticky solution panel */}
          <AnimateOnScroll variants={slideFromRight}>
            <SolutionPanel />
          </AnimateOnScroll>
        </div>
      </div>
    </section>
  );
}

function SolutionPanel() {
  return (
    <div className="lg:sticky lg:top-32">
      <div className="glass-gold border border-[var(--border-light)] rounded-2xl p-8 sm:p-10 space-y-6">
        <div className="space-y-3">
          <p className="section-label">
            How we fix it
          </p>
          <h3 className="font-display text-2xl sm:text-3xl font-bold">
            One team running your entire digital operation.
          </h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {impactMetrics.map((metric) => (
            <div key={metric.label} className="rounded-xl border border-[var(--border-light)] bg-black/20 p-4">
              <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--white-muted)]">
                {metric.label}
              </p>
              <p className="text-2xl font-semibold text-white">
                {metric.value}
              </p>
              <p className="text-xs text-[var(--white-muted)]">{metric.detail}</p>
            </div>
          ))}
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--white-muted)] mb-3">
            What we implement
          </p>
          <ul className="space-y-2 text-sm text-[var(--white-secondary)]">
            {solutionPoints.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[var(--gold-base)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
