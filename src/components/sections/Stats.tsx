"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-init";
import { prefersReducedMotion } from "@/lib/utils";
import { CountUp } from "@/components/ui/CountUp";
import { stats } from "@/content/stats";

export function Stats() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(() => {
    if (!sectionRef.current) return;
    if (prefersReducedMotion()) return;

    const items = sectionRef.current.querySelectorAll("[data-stat]");
    items.forEach((item, i) => {
      gsap.fromTo(
        item,
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          delay: i * 0.1,
          ease: "power2.out",
          scrollTrigger: {
            trigger: item,
            start: "top 88%",
            toggleActions: "play none none none",
          },
        }
      );
    });
  }, { scope: sectionRef });

  return (
    <section ref={sectionRef} className="py-24 bg-[var(--bg-base)] relative">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12 md:gap-16">
          {stats.map((stat) => (
            <div
              key={stat.label}
              data-stat
              className="text-center relative"
            >
              {/* Top rule */}
              <div className="h-px w-full bg-[rgba(var(--accent-rgb),0.15)] mb-8" />

              <p
                className="font-display text-5xl sm:text-6xl md:text-7xl font-bold text-gold-gradient mb-3"
              >
                <CountUp
                  end={stat.numericValue}
                  suffix={stat.suffix}
                />
              </p>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--white-muted)] font-medium mb-2">
                {stat.label}
              </p>
              {stat.detail && (
                <p className="text-xs text-[var(--white-muted)]">
                  {stat.detail}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
