"use client";

import { useCallback, useState } from "react";

/**
 * A URL-backed value that changes at once while the navigation recording it is
 * in flight. Once the URL commits any change the request is settled and the URL
 * wins again, so a later return to the old value (Back) never replays it.
 */
export function usePendingParam<T>(committed: T) {
  const [pending, setPending] = useState<{ from: T; to: T } | null>(null);
  if (pending && !Object.is(pending.from, committed)) setPending(null);
  const value = pending && Object.is(pending.from, committed) ? pending.to : committed;
  const request = useCallback((to: T) => setPending({ from: committed, to }), [committed]);
  return [value, request] as const;
}
