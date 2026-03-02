"use client";

import { useCallback, useRef } from "react";
import { prefersReducedMotion } from "@/lib/utils";

/**
 * Adds a 3D tilt effect to a card on mouse move.
 * Returns handlers to attach to the card element.
 * Max tilt: ~6 degrees. Resets smoothly on mouse leave.
 */
export function useCardTilt(maxDeg = 6) {
  const ref = useRef<HTMLDivElement>(null);

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (prefersReducedMotion()) return;
      const el = ref.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      const tiltX = (0.5 - y) * maxDeg;
      const tiltY = (x - 0.5) * maxDeg;

      el.style.setProperty("--tilt-x", `${tiltX}deg`);
      el.style.setProperty("--tilt-y", `${tiltY}deg`);

      // Glow spot position
      el.style.setProperty("--glow-x", `${x * 100}%`);
      el.style.setProperty("--glow-y", `${y * 100}%`);
    },
    [maxDeg]
  );

  const onMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--tilt-x", "0deg");
    el.style.setProperty("--tilt-y", "0deg");
  }, []);

  return { ref, onMouseMove, onMouseLeave };
}
