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
  threshold = 0.02,
  rootMargin = "0px 0px 40px 0px"
) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduced) {
      el.classList.add("in", "reveal-immediate");
      el.dataset.revealState = "visible";
      return;
    }

    // Fail open above the fold. Prerendered content must never disappear while
    // waiting for hydration; the route/hero entrance owns first-viewport motion.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight + 40 && rect.bottom > -40) {
      el.classList.add("in", "reveal-immediate");
      el.dataset.revealState = "visible";
      return;
    }

    let revealed = false;
    let visibilityTimer: number | null = null;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      el.classList.add("in");
      el.dataset.revealState = "visible";
      observer.disconnect();
      if (visibilityTimer != null) window.clearInterval(visibilityTimer);
      window.removeEventListener("scroll", revealIfPassed);
      window.removeEventListener("scrollend", revealIfPassed);
      window.removeEventListener("resize", revealIfPassed);
      window.removeEventListener("load", revealIfPassed);
    };
    const revealIfPassed = () => {
      if (el.getBoundingClientRect().top < window.innerHeight + 40) reveal();
    };
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) reveal();
      },
      { rootMargin, threshold }
    );
    // Only below-fold content is armed. With no JavaScript, slow JavaScript, or
    // a hydration failure, this attribute is never set and content stays visible.
    el.classList.add("rv-ready");
    el.dataset.revealState = "pending";
    observer.observe(el);
    window.addEventListener("scroll", revealIfPassed, { passive: true });
    window.addEventListener("scrollend", revealIfPassed);
    window.addEventListener("resize", revealIfPassed);
    window.addEventListener("load", revealIfPassed);
    // IntersectionObserver callbacks can be delayed while the browser restores
    // scroll or settles responsive layout. Poll only the current/passed viewport
    // so content cannot remain stranded without consuming later entrances.
    visibilityTimer = window.setInterval(revealIfPassed, 200);
    // Re-check only the visitor's current/passed viewport while fonts, images,
    // and restored scroll positions settle. Unlike the former global timer,
    // this never consumes the entrance of content that is still below-fold.
    const settleTimers = [250, 750, 1500].map((delay) => window.setTimeout(revealIfPassed, delay));
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        el.classList.add("reveal-immediate");
        reveal();
      }
    };
    window.addEventListener("pageshow", onPageShow);

    return () => {
      observer.disconnect();
      if (visibilityTimer != null) window.clearInterval(visibilityTimer);
      settleTimers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("scroll", revealIfPassed);
      window.removeEventListener("scrollend", revealIfPassed);
      window.removeEventListener("resize", revealIfPassed);
      window.removeEventListener("load", revealIfPassed);
      window.removeEventListener("pageshow", onPageShow);
    };
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
    <Tag ref={ref} className={cls} style={mergedStyle} data-motion-role={rv ? "group" : undefined} {...rest}>
      {children}
    </Tag>
  );
}
