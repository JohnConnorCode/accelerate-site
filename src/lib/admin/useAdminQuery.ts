"use client";

import { useQuery, type QueryKey, type UseQueryOptions } from "@tanstack/react-query";
import { fetchJson } from "@/lib/admin/fetchJson";

/** Shared read path for admin data: deduped, cancellable, cached, and retained
 * across route revisits. Mutations still go through their domain endpoints and
 * invalidate or refetch the same key after a truthful receipt. */
export function useAdminQuery<T>(
  queryKey: QueryKey,
  url: string,
  options: Omit<UseQueryOptions<T, Error>, "queryKey" | "queryFn"> = {},
) {
  return useQuery<T, Error>({
    queryKey,
    queryFn: ({ signal }) => fetchJson<T>(url, { signal }),
    placeholderData: (previous) => previous,
    ...options,
  });
}
