"use client";

import type { CSSProperties, ReactNode } from "react";
import { useRevealLifecycle } from "@/components/motion/useReveal";

type WorkMotionRole = "group" | "heading" | "copy" | "card" | "proof" | "cta" | "media";

function WorkMotion({ children, className = "", delay = 0, role, media = false }: { children: ReactNode; className?: string; delay?: number; role: WorkMotionRole; media?: boolean }) {
  const ref = useRevealLifecycle<HTMLDivElement>({
    threshold: 0.04,
    rootMargin: "0px 0px -10% 0px",
    readyClass: "work-reveal-ready",
    initialViewport: "animate",
    triggerRatio: 0.9,
  });
  return (
    <div
      ref={ref}
      className={`rv work-reveal ${className}`}
      style={{ "--work-delay": `${delay}s` } as CSSProperties}
      data-work-reveal={media ? undefined : "true"}
      data-work-media-reveal={media ? "true" : undefined}
      data-motion-role={role}
    >
      {children}
    </div>
  );
}

export function WorkReveal({
  children,
  className = "",
  delay = 0,
  role = "group",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  role?: Exclude<WorkMotionRole, "media">;
}) {
  return <WorkMotion className={className} delay={delay} role={role}>{children}</WorkMotion>;
}

export function WorkMediaReveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return <WorkMotion className={className} delay={delay} role="media" media>{children}</WorkMotion>;
}
