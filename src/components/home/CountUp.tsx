"use client";

import { useLayoutEffect, useRef } from "react";

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
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Keep the real server-rendered figure through history restoration. The
    // finite text animation owns this span without rerendering React per frame.
    el.textContent = target;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (
      reduced.matches ||
      document.documentElement.dataset.navigationKind === "restore" ||
      !("IntersectionObserver" in window)
    ) {
      return;
    }
    const { prefix, value, suffix } = parseTarget(target);
    let frame = 0;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        observer.disconnect();

        if (reduced.matches) {
          el.textContent = target;
          return;
        }

        el.textContent = `${prefix}0${suffix}`;
        const duration = 1400;
        const start = performance.now();
        const isInt = Number.isInteger(value);

        function tick(now: number) {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          const current = value * eased;
          el.textContent = `${prefix}${isInt ? Math.round(current) : current.toFixed(1)}${suffix}`;
          if (t < 1) frame = requestAnimationFrame(tick);
        }
        frame = requestAnimationFrame(tick);
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.3 },
    );
    const onPreference = () => {
      if (!reduced.matches) return;
      observer.disconnect();
      cancelAnimationFrame(frame);
      el.textContent = target;
    };
    reduced.addEventListener("change", onPreference);
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      reduced.removeEventListener("change", onPreference);
    };
  }, [target]);

  return (
    <span ref={ref} className={className}>
      {target}
    </span>
  );
}
