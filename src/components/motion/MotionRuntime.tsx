"use client";

import { MotionConfig } from "framer-motion";
import { useEffect, type ReactNode } from "react";

/**
 * Confirms that the public motion runtime hydrated successfully. The tiny
 * bootstrap in the root layout arms reveals before first paint, then fails
 * open if hydration never completes. This component closes that safety loop.
 *
 * It also owns the single public reduced-motion decision. AdminShell scopes its
 * own MotionConfig; without this, the public chrome and sections animated
 * regardless of the visitor's preference — the chat widget, search dialog,
 * resource gate, plan view, learn hub and roofing qualifier all ran their
 * framer transitions with `reducedMotion` unset. One owner here fixes every one
 * of them instead of a local patch per component.
 */
export function MotionRuntime({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.dataset.motionHydrated = "true";
  }, []);

  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
