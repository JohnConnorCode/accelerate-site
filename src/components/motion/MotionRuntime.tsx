"use client";

import { useEffect } from "react";

/**
 * Confirms that the public motion runtime hydrated successfully. The tiny
 * bootstrap in the root layout arms reveals before first paint, then fails
 * open if hydration never completes. This component closes that safety loop.
 */
export function MotionRuntime() {
  useEffect(() => {
    document.documentElement.dataset.motionHydrated = "true";
  }, []);

  return null;
}
