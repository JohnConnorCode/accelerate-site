"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-init";
import { prefersReducedMotion } from "@/lib/utils";

type AnimationType = "fade-up" | "slide-left" | "slide-right" | "scale" | "clip-reveal";

interface ScrollRevealProps {
  children: React.ReactNode;
  animation?: AnimationType;
  scrub?: boolean;
  start?: string;
  end?: string;
  delay?: number;
  className?: string;
  as?: "div" | "section";
}

const animationConfigs: Record<AnimationType, gsap.TweenVars> = {
  "fade-up": { opacity: 0, y: 60 },
  "slide-left": { opacity: 0, x: -80 },
  "slide-right": { opacity: 0, x: 80 },
  "scale": { opacity: 0, scale: 0.85 },
  "clip-reveal": { opacity: 0, clipPath: "inset(100% 0 0 0)" },
};

const animationTargets: Record<AnimationType, gsap.TweenVars> = {
  "fade-up": { opacity: 1, y: 0 },
  "slide-left": { opacity: 1, x: 0 },
  "slide-right": { opacity: 1, x: 0 },
  "scale": { opacity: 1, scale: 1 },
  "clip-reveal": { opacity: 1, clipPath: "inset(0% 0 0 0)" },
};

export function ScrollReveal({
  children,
  animation = "fade-up",
  scrub = false,
  start = "top 85%",
  end = "top 20%",
  delay = 0,
  className,
  as: Tag = "div",
}: ScrollRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!containerRef.current) return;

    // Respect prefers-reduced-motion
    if (prefersReducedMotion()) return;

    const from = animationConfigs[animation];
    const to = {
      ...animationTargets[animation],
      duration: scrub ? undefined : 0.8,
      delay,
      ease: scrub ? "none" : "power2.out",
      scrollTrigger: {
        trigger: containerRef.current,
        start,
        end,
        scrub: scrub ? 1 : false,
        toggleActions: scrub ? undefined : "play none none none",
      },
    };

    gsap.fromTo(containerRef.current, from, to);
  }, { scope: containerRef });

  return (
    <Tag ref={containerRef as React.Ref<HTMLDivElement>} className={className}>
      {children}
    </Tag>
  );
}
