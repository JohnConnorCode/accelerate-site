"use client";

import type { ReactNode } from "react";
import { Reveal } from "@/components/home/reveal";

export function WorkReveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <Reveal
      rv
      className={className}
      data-work-reveal="true"
      delay={delay}
      threshold={0.02}
      rootMargin="0px 0px 40px 0px"
    >
      {children}
    </Reveal>
  );
}

export function WorkMediaReveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <Reveal
      rv
      className={className}
      data-work-media-reveal="true"
      delay={delay}
      threshold={0.02}
      rootMargin="0px 0px 40px 0px"
    >
      {children}
    </Reveal>
  );
}
