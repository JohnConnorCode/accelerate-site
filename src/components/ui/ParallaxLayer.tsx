"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-init";
import { prefersReducedMotion } from "@/lib/utils";

interface ParallaxLayerProps {
  /** Parallax speed: negative = moves opposite to scroll, positive = moves with scroll. Range -1 to 1. */
  speed?: number;
  className?: string;
  children: React.ReactNode;
}

export function ParallaxLayer({
  speed = 0.3,
  className,
  children,
}: ParallaxLayerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!ref.current || prefersReducedMotion()) return;

    const distance = 80 * speed;

    gsap.fromTo(
      ref.current,
      { y: distance },
      {
        y: -distance,
        ease: "none",
        scrollTrigger: {
          trigger: ref.current,
          start: "top bottom",
          end: "bottom top",
          scrub: 1,
        },
      }
    );
  }, { scope: ref });

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
