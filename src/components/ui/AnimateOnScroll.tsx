"use client";

import { usePathname } from "next/navigation";

import { useContext, type CSSProperties, type ReactNode } from "react";
import { RevealOwnerContext, useRevealLifecycle } from "@/components/motion/useReveal";
import { cn } from "@/lib/utils";

type EntranceTag = "div" | "section" | "article" | "ul";

/** Public entrances share one observer and CSS recipe. Server markup is armed
 * before paint; without JavaScript or with reduced motion it stays readable. */
export function AnimateOnScroll({
  children,
  className,
  delay = 0,
  as: Tag = "div",
  stagger = false,
  staggerDelay = 0.08,
  appearance = "rise",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: EntranceTag;
  stagger?: boolean;
  staggerDelay?: number;
  appearance?: "rise" | "fade";
}) {
  const pathname = usePathname();
  const parentOwnsEntrance = useContext(RevealOwnerContext);
  const ref = useRevealLifecycle<HTMLElement>();
  return (
    <Tag
      key={pathname}
      ref={
        parentOwnsEntrance
          ? undefined
          : (ref as React.Ref<HTMLDivElement & HTMLElement & HTMLUListElement>)
      }
      data-reveal-state={parentOwnsEntrance ? undefined : "pending"}
      data-entrance-kind={parentOwnsEntrance ? undefined : stagger ? "stagger" : appearance}
      className={cn("reveal-self", !parentOwnsEntrance && "ui-entrance", className)}
      style={
        { "--entry-delay": `${delay}s`, "--entry-stagger": `${staggerDelay}s` } as CSSProperties
      }
    >
      <RevealOwnerContext.Provider value={true}>{children}</RevealOwnerContext.Provider>
    </Tag>
  );
}

export function StaggerContainer({
  children,
  className,
  as = "div",
  staggerDelay = 0.08,
}: {
  children: ReactNode;
  className?: string;
  as?: EntranceTag;
  staggerDelay?: number;
}) {
  return (
    <AnimateOnScroll stagger staggerDelay={staggerDelay} as={as} className={className}>
      {children}
    </AnimateOnScroll>
  );
}

export function EntranceGroup({
  children,
  className,
  delay = 0.06,
  stagger = 0.08,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  return (
    <AnimateOnScroll stagger delay={delay} staggerDelay={stagger} className={className}>
      {children}
    </AnimateOnScroll>
  );
}

export function EntranceItem({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}
