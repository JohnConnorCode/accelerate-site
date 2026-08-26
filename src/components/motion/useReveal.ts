"use client";

import { useEffect, useRef } from "react";

export interface RevealLifecycleOptions {
  threshold?: number;
  rootMargin?: string;
  initialViewport?: "immediate" | "animate";
  triggerRatio?: number;
}

export function useRevealLifecycle<T extends HTMLElement>({
  threshold = 0.02,
  rootMargin = "0px 0px -22% 0px",
  initialViewport = "animate",
  triggerRatio = 0.78,
}: RevealLifecycleOptions = {}) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.classList.add("in", "reveal-immediate");
      element.dataset.revealState = "visible";
      return;
    }

    const initialRect = element.getBoundingClientRect();
    const initiallyVisible = initialRect.top < window.innerHeight + 40 && initialRect.bottom > -40;
    if (initialViewport === "immediate" && initiallyVisible) {
      element.classList.add("in", "reveal-immediate");
      element.dataset.revealState = "visible";
      return;
    }

    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      element.classList.add("in");
      element.dataset.revealState = "visible";
      observer.disconnect();
      window.removeEventListener("scroll", revealIfEntered);
      window.removeEventListener("resize", revealIfEntered);
    };
    const revealIfEntered = () => {
      const atDocumentEnd = window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      if (element.getBoundingClientRect().top <= window.innerHeight * triggerRatio || atDocumentEnd) reveal();
    };
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) reveal(); },
      { rootMargin, threshold },
    );

    element.dataset.revealState = "pending";
    observer.observe(element);
    window.addEventListener("scroll", revealIfEntered, { passive: true });
    window.addEventListener("resize", revealIfEntered);
    const frame = window.requestAnimationFrame(revealIfEntered);
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) reveal(); };
    window.addEventListener("pageshow", onPageShow);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", revealIfEntered);
      window.removeEventListener("resize", revealIfEntered);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [initialViewport, rootMargin, threshold, triggerRatio]);

  return ref;
}
