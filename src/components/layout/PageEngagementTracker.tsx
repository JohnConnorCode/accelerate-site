"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics";

const SCROLL_THRESHOLDS = [25, 50, 75, 100];
const TIME_THRESHOLDS = [15, 30, 60];

export function PageEngagementTracker() {
  const firedScrollRef = useRef<Set<number>>(new Set());
  const firedTimeRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const page = window.location.pathname;
    firedScrollRef.current.clear();
    firedTimeRef.current.clear();

    // Scroll depth tracking
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) return;
      const depth = Math.round((window.scrollY / scrollHeight) * 100);

      for (const threshold of SCROLL_THRESHOLDS) {
        if (depth >= threshold && !firedScrollRef.current.has(threshold)) {
          firedScrollRef.current.add(threshold);
          trackEvent("Scroll Depth", { depth: threshold, page });
        }
      }
    };

    // Time on page tracking
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const seconds of TIME_THRESHOLDS) {
      const timer = setTimeout(() => {
        if (!firedTimeRef.current.has(seconds)) {
          firedTimeRef.current.add(seconds);
          trackEvent("Time on Page", { seconds, page });
        }
      }, seconds * 1000);
      timers.push(timer);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      timers.forEach(clearTimeout);
    };
  }, []);

  return null;
}
