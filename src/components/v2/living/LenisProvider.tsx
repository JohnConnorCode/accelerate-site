"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "@/lib/gsap-init";
import { prefersReducedMotion } from "@/lib/utils";

/**
 * Smooth-scroll for the Living Grid experience, scoped to this subtree.
 * Driven from the GSAP ticker (single loop) and synced to ScrollTrigger.
 * Bypassed under reduced-motion and on touch/narrow viewports.
 */
export function LenisProvider() {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (!window.matchMedia("(min-width: 1024px)").matches) return;

    const lenis = new Lenis({ duration: 1.15, smoothWheel: true });

    const onScroll = () => ScrollTrigger.update();
    lenis.on("scroll", onScroll);

    const raf = (time: number) => lenis.raf(time * 1000); // ticker time is seconds
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    ScrollTrigger.refresh();

    return () => {
      lenis.off("scroll", onScroll);
      gsap.ticker.remove(raf);
      gsap.ticker.lagSmoothing(500, 33); // restore GSAP default
      lenis.destroy();
    };
  }, []);

  return null;
}
