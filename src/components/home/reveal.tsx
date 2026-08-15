"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, ElementType, ReactNode } from "react";

/**
 * Toggles an `in` class on the ref'd element when it enters the viewport —
 * pairs with the `.rv`/`.ev`/`.oc`/`.appr`/`.steps`/`.plan-list`/`.cred`
 * reveal primitives in globals.css (ported from the reference mockup, which
 * drives the same classes off a single IntersectionObserver).
 */
export function useRv<T extends HTMLElement = HTMLElement>(
  threshold = 0.1,
  rootMargin = "0px 0px -8% 0px"
) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduced) {
      el.classList.add("in");
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          el.classList.add("in");
          observer.disconnect();
        }
      },
      { rootMargin, threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);
  return ref;
}

/** Sets the `--d` stagger-delay custom property consumed by the reveal CSS. */
export function delayStyle(delaySeconds: number): CSSProperties {
  return { "--d": `${delaySeconds}s` } as CSSProperties;
}

/**
 * `<Reveal rv as="h2" className="h2">…</Reveal>` fades the element itself in
 * on intersect. `<Reveal as="div" className="ev">…</Reveal>` (rv omitted)
 * toggles `.in` on a container so its own CSS (dividers, per-child stagger)
 * can react, without applying the `.rv` opacity/blur transition to the
 * container itself.
 */
export function Reveal({
  as,
  className = "",
  rv = false,
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
  delay?: number;
  threshold?: number;
  rootMargin?: string;
  style?: CSSProperties;
  children?: ReactNode;
} & Record<string, unknown>) {
  const Tag = (as ?? "div") as ElementType;
  const ref = useRv<HTMLElement>(threshold, rootMargin);
  const cls = [rv ? "rv" : "", className].filter(Boolean).join(" ");
  const mergedStyle = { ...(delay != null ? delayStyle(delay) : null), ...style };
  return (
    <Tag ref={ref} className={cls} style={mergedStyle} {...rest}>
      {children}
    </Tag>
  );
}
