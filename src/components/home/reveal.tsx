"use client";

import { usePathname } from "next/navigation";

import type { CSSProperties, ElementType, ReactNode } from "react";
import { useRevealLifecycle } from "@/components/motion/useReveal";

/**
 * Toggles an `in` class on the ref'd element when it enters the viewport —
 * pairs with the `.rv`/`.ev`/`.oc`/`.appr`/`.steps`/`.plan-list`/`.cred`
 * reveal primitives in globals.css (ported from the reference mockup, which
 * drives the same classes off a single IntersectionObserver).
 */
export function useRv<T extends HTMLElement = HTMLElement>(
  threshold = 0.02,
  rootMargin = "0px 0px -22% 0px",
) {
  return useRevealLifecycle<T>({ threshold, rootMargin, triggerRatio: 0.78 });
}

/** Sets the `--d` stagger-delay custom property consumed by the reveal CSS. */
export function delayStyle(delaySeconds: number): CSSProperties {
  return { "--d": `${delaySeconds}s` } as CSSProperties;
}

/**
 * `<Reveal rv as="h2" className="h2">…</Reveal>` fades the element itself in
 * on intersect. `<Reveal as="div" className="ev">…</Reveal>` (rv omitted)
 * toggles `.in` on a container so its own CSS (dividers, per-child stagger)
 * can react, without applying the `.rv` opacity/translate entrance to the
 * container itself.
 * `sequence` gives the group's `data-home-step` children one shared clock.
 * Use separate owners for rows that can enter the viewport independently.
 */
export function Reveal({
  as,
  className = "",
  rv = false,
  sequence = false,
  delay,
  threshold,
  rootMargin,
  style,
  children,
  ...rest
}: {
  as?: ElementType;
  className?: string;
  rv?: boolean;
  sequence?: boolean;
  delay?: number;
  threshold?: number;
  rootMargin?: string;
  style?: CSSProperties;
  children?: ReactNode;
} & Record<string, unknown>) {
  const pathname = usePathname();
  const Tag = (as ?? "div") as ElementType;
  const ref = useRv<HTMLElement>(threshold, rootMargin);
  const cls = [sequence ? "home-sequence" : rv ? "rv" : "", className].filter(Boolean).join(" ");
  const mergedStyle = { ...(delay != null ? delayStyle(delay) : null), ...style };
  return (
    <Tag
      key={pathname}
      ref={ref}
      className={cls}
      style={mergedStyle}
      data-motion-role={sequence ? "home-sequence" : rv ? "group" : undefined}
      data-reveal-state="pending"
      {...rest}
    >
      {children}
    </Tag>
  );
}
