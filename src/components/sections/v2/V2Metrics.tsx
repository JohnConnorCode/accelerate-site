"use client";

import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { stats } from "@/content/stats";

export function V2Metrics() {
  return (
    <section className="relative bg-bg-base py-12 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <AnimateOnScroll className="relative overflow-hidden rounded-3xl border border-border-gold px-6 py-12 sm:px-12 sm:py-14">
          {/* gold-tinted panel background */}
          <div
            className="absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(120% 140% at 50% -20%, rgba(var(--accent-rgb),0.14) 0%, rgba(var(--accent-rgb),0.03) 40%, transparent 70%), var(--bg-elevated)",
            }}
          />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--gold-base)] to-transparent opacity-50" />

          <p className="mb-10 text-center text-xs font-medium uppercase tracking-[0.25em] text-gold-light">
            What that looks like in the numbers
          </p>

          <div className="grid grid-cols-2 gap-y-10 gap-x-6 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="font-display text-5xl font-bold leading-none tracking-tight text-heading sm:text-6xl">
                  <span className="text-shimmer">
                    {s.value}
                    {s.suffix}
                  </span>
                </div>
                <p className="mx-auto mt-3 max-w-[14ch] text-sm font-semibold text-white-secondary">
                  {s.label}
                </p>
                {s.detail && (
                  <p className="mx-auto mt-1 max-w-[18ch] text-xs text-white-muted">
                    {s.detail}
                  </p>
                )}
              </div>
            ))}
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
