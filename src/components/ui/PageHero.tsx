"use client";

import type { ReactNode } from "react";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { cn } from "@/lib/utils";

interface PageHeroProps {
  label: string;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function PageHero({
  label,
  title,
  description,
  children,
  className,
}: PageHeroProps) {
  return (
    <section
      className={cn("relative py-24 sm:py-32 overflow-hidden", className)}
    >
      {/* Atmospheric background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 gradient-mesh opacity-40" />
        <div className="absolute inset-0 grid-overlay opacity-20" />
        <div className="hero-glow-orb hero-glow-orb-gold absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <AnimateOnScroll>
          <p className="section-label">{label}</p>
          <h1 className="page-heading leading-[1.1] mb-6">{title}</h1>
          {description && (
            <p className="text-lg sm:text-xl text-white/65 max-w-2xl mx-auto leading-relaxed">
              {description}
            </p>
          )}
          {children}
        </AnimateOnScroll>
      </div>
    </section>
  );
}
