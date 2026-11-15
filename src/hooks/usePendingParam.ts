"use client";

import { useCallback, useState } from "react";

/**
 * A URL-backed value that changes at once while the navigation recording it is
 * in flight. Once the URL moves on (or the user goes Back), the URL wins again.
 */
export function usePendingParam<T>(committed: T) {
  const [pending, setPending] = useState<{ from: T; to: T } | null>(null);
  const value = pending && Object.is(pending.from, committed) ? pending.to : committed;
  const request = useCallback((to: T) => setPending({ from: committed, to }), [committed]);
  return [value, request] as const;
}
