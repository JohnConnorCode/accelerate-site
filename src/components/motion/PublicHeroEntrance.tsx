"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { useRevealLifecycle } from "@/components/motion/useReveal";

/**
 * The only entrance owner for a public-page hero.
 *
 * Hero children opt into the ordered sequence with `data-hero-step`. Keeping
 * the observer on this single root prevents independent viewport observers
 * (and therefore random-looking races) between an eyebrow, heading, copy,
 * CTA, and supporting live panel.
 */
export function PublicHeroEntrance({
  children,
  className = "",
  ...rest
}: { children: ReactNode; className?: string } & HTMLAttributes<HTMLElement>) {
  const ref = useRevealLifecycle<HTMLElement>({
    initialViewport: "animate",
    rootMargin: "0px 0px -12% 0px",
    triggerRatio: 0.9,
  });

  return (
    <section
      ref={ref}
      className={`public-hero-entrance ${className}`}
      data-motion-role="public-hero"
      {...rest}
    >
      {children}
    </section>
  );
}

/** A semantic child slot of PublicHeroEntrance; its number is the sequence. */
export function HeroEntranceItem({
  children,
  step,
  className,
}: {
  children: ReactNode;
  step: 1 | 2 | 3 | 4 | 5;
  className?: string;
}) {
  return <div className={className} data-hero-step={step}>{children}</div>;
}
