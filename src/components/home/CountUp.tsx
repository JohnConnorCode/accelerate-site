"use client";

import { useEffect, useRef, useState } from "react";

/** Parses "95" -> {value:95, prefix:"", suffix:"%"}, "2×" -> {value:2, suffix:"×"} */
function parseTarget(raw: string) {
  const match = raw.match(/^([^\d]*)([\d.]+)(.*)$/);
  if (!match) return { prefix: "", value: 0, suffix: raw };
  const prefix = match[1] ?? "";
  const num = match[2] ?? "0";
  const suffix = match[3] ?? "";
  return { prefix, value: parseFloat(num), suffix };
}

/** Counts up from 0 to the numeric part of `target` once scrolled into view. */
export function CountUp({ target, className }: { target: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState<string>(() => {
    const { prefix, suffix } = parseTarget(target);
    return `${prefix}0${suffix}`;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { prefix, value, suffix } = parseTarget(target);

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        observer.disconnect();

        const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
        if (reduced) {
          setDisplay(target);
          return;
        }

        const duration = 1400;
        const start = performance.now();
        const isInt = Number.isInteger(value);

        function tick(now: number) {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          const current = value * eased;
          setDisplay(`${prefix}${isInt ? Math.round(current) : current.toFixed(1)}${suffix}`);
          if (t < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}
