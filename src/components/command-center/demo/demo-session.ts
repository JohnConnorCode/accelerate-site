"use client";

import { useEffect, useRef, useState } from "react";

const PREFIX = "accelerate:command-center-demo:v1:";
export const DEMO_RESET_EVENT = "command-center-demo:reset";

export function demoStorageKey(key: string) {
  return `${PREFIX}${key}`;
}

export function resetDemoSession() {
  for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = window.sessionStorage.key(index);
    if (key?.startsWith(PREFIX)) window.sessionStorage.removeItem(key);
  }
  window.dispatchEvent(new Event(DEMO_RESET_EVENT));
}

/**
 * Session-scoped state keeps a sales demonstration coherent across workspace
 * views and a refresh, while closing the tab returns the next viewer to a clean
 * scenario. Every consumer also responds to the one global reset event.
 */
export function useDemoSessionState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);
  const initial = useRef(initialValue);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(demoStorageKey(key));
      if (stored !== null) setValue(JSON.parse(stored) as T);
    } catch {
      window.sessionStorage.removeItem(demoStorageKey(key));
    } finally {
      // State updates from this effect are batched. Marking hydration complete
      // alongside the restored value ensures the persistence effect never
      // writes the initial value over a stored demo scenario on refresh.
      setHydrated(true);
    }

    const reset = () => setValue(initial.current);
    window.addEventListener(DEMO_RESET_EVENT, reset);
    return () => window.removeEventListener(DEMO_RESET_EVENT, reset);
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    window.sessionStorage.setItem(demoStorageKey(key), JSON.stringify(value));
  }, [hydrated, key, value]);

  return [value, setValue, hydrated] as const;
}
