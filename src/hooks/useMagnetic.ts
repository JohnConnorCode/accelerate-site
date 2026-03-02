"use client";

import { useCallback, useRef } from "react";
import { prefersReducedMotion } from "@/lib/utils";

/**
 * Magnetic effect: element subtly follows cursor when hovered.
 * Returns ref + handlers to spread on the element.
 */
export function useMagnetic(strength = 0.3) {
  const ref = useRef<HTMLElement>(null);

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (prefersReducedMotion()) return;
      const el = ref.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const dx = (e.clientX - cx) * strength;
      const dy = (e.clientY - cy) * strength;

      el.style.setProperty("--mag-x", `${dx}px`);
      el.style.setProperty("--mag-y", `${dy}px`);
    },
    [strength]
  );

  const onMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--mag-x", "0px");
    el.style.setProperty("--mag-y", "0px");
  }, []);

  return { ref, onMouseMove, onMouseLeave };
}
