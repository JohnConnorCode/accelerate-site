"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-init";
import { prefersReducedMotion } from "@/lib/utils";

// Module-level: delays all ScrollTrigger registration on initial page load
// so hero animations (Framer Motion) complete before below-fold content reveals.
let pageReady = false;
const readyCallbacks: (() => void)[] = [];

if (typeof window !== "undefined") {
  setTimeout(() => {
    pageReady = true;
    readyCallbacks.forEach((cb) => cb());
    readyCallbacks.length = 0;
  }, 1200);
}

function onPageReady(cb: () => void) {
  if (pageReady) {
    cb();
    return;
  }
  readyCallbacks.push(cb);
}

type AnimationType = "fade-up" | "slide-left" | "slide-right" | "scale" | "clip-reveal" | "blur-up" | "clip-left";

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
  "blur-up": { opacity: 0, y: 40, filter: "blur(10px)" },
  "clip-left": { opacity: 0, clipPath: "inset(0 100% 0 0)" },
};

const animationTargets: Record<AnimationType, gsap.TweenVars> = {
  "fade-up": { opacity: 1, y: 0 },
  "slide-left": { opacity: 1, x: 0 },
  "slide-right": { opacity: 1, x: 0 },
  "scale": { opacity: 1, scale: 1 },
  "clip-reveal": { opacity: 1, clipPath: "inset(0% 0 0 0)" },
  "blur-up": { opacity: 1, y: 0, filter: "blur(0px)" },
  "clip-left": { opacity: 1, clipPath: "inset(0 0% 0 0)" },
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
    if (prefersReducedMotion()) return;

    const el = containerRef.current;

    // If the element is already in view on mount, do NOT animate it — otherwise
    // the SSR-visible content would flash to its hidden state before playing
    // back. This was the "content shows then disappears" bug.
    const rect = el.getBoundingClientRect();
    const alreadyInView = rect.top < window.innerHeight * 0.85 && rect.bottom > 0;
    if (alreadyInView) return;

    // For off-screen elements: hide immediately so there's no flash later, then
    // let the ScrollTrigger reveal them as the user scrolls down to them.
    gsap.set(el, animationConfigs[animation]);

    onPageReady(() => {
      if (!el) return;

      const from = animationConfigs[animation];
      const to = {
        ...animationTargets[animation],
        duration: scrub ? undefined : 0.8,
        delay,
        ease: scrub ? "none" : "power2.out",
        scrollTrigger: {
          trigger: el,
          start,
          end,
          scrub: scrub ? 1 : false,
          toggleActions: scrub ? undefined : "play none none none",
        },
      };

      gsap.fromTo(el, from, to);
    });
  }, { scope: containerRef });

  return (
    <Tag ref={containerRef as React.Ref<HTMLDivElement>} className={className}>
      {children}
    </Tag>
  );
}
