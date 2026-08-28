"use client";

import { useEffect, useRef } from "react";

/** The single owner for committed admin-route motion. */
export function AdminRouteStage({ routeKey, children }: { routeKey: string; children: React.ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const runSequence = () => {
      if (reducedMotion) return;
      const sections = Array.from(node.querySelectorAll<HTMLElement>(":scope > * > *")).slice(0, 8);
      sections.forEach((section, index) => section.animate(
        [
          { opacity: 0, transform: "translateY(8px)", filter: "blur(4px)" },
          { opacity: 1, transform: "translateY(0)", filter: "blur(0px)" },
        ],
        { duration: 360, delay: index * 48, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" },
      ));
    };
    if (!reducedMotion) {
      node.animate(
        [
          { opacity: 0, transform: "translateY(10px)", filter: "blur(5px)" },
          { opacity: 1, transform: "translateY(0)", filter: "blur(0px)" },
        ],
        { duration: 360, easing: "cubic-bezier(.16,1,.3,1)" },
      );
    }
    let hadLoadingTree = Boolean(node.querySelector("[data-admin-route-loading]"));
    const frame = window.requestAnimationFrame(() => {
      if (!hadLoadingTree) runSequence();
    });
    const observer = new MutationObserver(() => {
      const hasLoadingTree = Boolean(node.querySelector("[data-admin-route-loading]"));
      if (!reducedMotion && hadLoadingTree && !hasLoadingTree) {
        node.animate(
          [
            { opacity: 0, transform: "translateY(8px)", filter: "blur(4px)" },
            { opacity: 1, transform: "translateY(0)", filter: "blur(0px)" },
          ],
          { duration: 340, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" },
        );
        runSequence();
      }
      hadLoadingTree = hasLoadingTree;
    });
    observer.observe(node, { childList: true, subtree: true });
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [routeKey]);
  return (
    <div
      ref={stageRef}
      key={routeKey}
      data-admin-route-stage
    >
      {children}
    </div>
  );
}
