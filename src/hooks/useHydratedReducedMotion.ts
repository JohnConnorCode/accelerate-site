"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Reduced-motion preference with an SSR-stable first render. Framer cannot
 * know the media query on the server; exposing it during hydration changes
 * inline motion styles and creates a mismatch. The preference takes effect
 * immediately after hydration, before any recurring or interactive motion.
 */
export function useHydratedReducedMotion() {
  const preference = useReducedMotion();
  const [hydrated, setHydrated] = useState(false);
  // The client-only preference intentionally follows the SSR-safe first paint.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setHydrated(true), []);
  return hydrated && Boolean(preference);
}
