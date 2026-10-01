"use client";

import { createContext, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export const RevealOwnerContext = createContext(false);

// One fallback clock for every pending entrance. Read geometry together before
// revealing anything, rather than interleaving layout reads/writes per listener.
const pending = new Map<HTMLElement, { ratio: number; reveal: () => void }>();
let frame = 0;
function checkEntrances() {
  frame = 0;
  const atEnd = scrollY > 0 && scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
  const entered = [...pending].filter(
    ([element, entry]) => atEnd || element.getBoundingClientRect().top <= innerHeight * entry.ratio,
  );
  entered.forEach(([, entry]) => entry.reveal());
}
function scheduleEntrances() {
  if (!frame) frame = requestAnimationFrame(checkEntrances);
}
function removePending(element: HTMLElement) {
  pending.delete(element);
  if (pending.size) return;
  cancelAnimationFrame(frame);
  frame = 0;
  window.removeEventListener("scroll", scheduleEntrances);
  window.removeEventListener("resize", scheduleEntrances);
}

export interface RevealLifecycleOptions {
  threshold?: number;
  rootMargin?: string;
  initialViewport?: "immediate" | "animate";
  triggerRatio?: number;
  restoreHistory?: boolean;
}

export function useRevealLifecycle<T extends HTMLElement>({
  threshold = 0.02,
  rootMargin = "0px 0px -22% 0px",
  initialViewport = "animate",
  triggerRatio = 0.78,
  restoreHistory = true,
}: RevealLifecycleOptions = {}) {
  const ref = useRef<T>(null);
  const pathname = usePathname();

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    // A cached route may retain its DOM while React disconnects its effects.
    // Re-arm this owner before paint; a previous history visit must not leave
    // `reveal-immediate` on a later fresh navigation.
    element.classList.remove("in", "reveal-immediate");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const restore = restoreHistory && document.documentElement.dataset.navigationKind === "restore";
    const initialRect = initialViewport === "immediate" ? element.getBoundingClientRect() : null;
    if (
      reduced.matches ||
      !document.documentElement.classList.contains("motion-ready") ||
      !("IntersectionObserver" in window) ||
      (initialRect && initialRect.top < window.innerHeight + 40 && initialRect.bottom > -40)
    ) {
      element.classList.add("in", "reveal-immediate");
      element.dataset.revealState = "visible";
      return;
    }

    let revealed = false;
    // Parent navigation restores scroll in its layout effect. The shared next
    // frame reads the settled position before deciding which owners to finish.
    let restoring = restore;
    const reveal = (immediate = restoring) => {
      if (immediate) element.classList.add("reveal-immediate");
      if (revealed && !immediate) return;
      revealed = true;
      element.classList.add("in");
      element.dataset.revealState = "visible";
      observer.disconnect();
      removePending(element);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) reveal();
      },
      { rootMargin, threshold },
    );

    element.dataset.revealState = "pending";
    observer.observe(element);
    if (!pending.size) {
      window.addEventListener("scroll", scheduleEntrances, { passive: true });
      window.addEventListener("resize", scheduleEntrances);
    }
    pending.set(element, { ratio: triggerRatio, reveal });
    scheduleEntrances();
    const restoreFrame = requestAnimationFrame(() => {
      restoring = false;
    });
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted && element.getBoundingClientRect().top < innerHeight) reveal(true);
    };
    const onPreference = () => {
      if (reduced.matches) reveal(true);
    };
    window.addEventListener("pageshow", onPageShow);
    reduced.addEventListener("change", onPreference);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(restoreFrame);
      removePending(element);
      window.removeEventListener("pageshow", onPageShow);
      reduced.removeEventListener("change", onPreference);
    };
  }, [initialViewport, rootMargin, threshold, triggerRatio, restoreHistory, pathname]);

  return ref;
}
