"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

export function AdminQueryProvider({
  scope,
  children,
}: {
  scope: string;
  children: React.ReactNode;
}) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: { retry: 0 },
        },
      }),
  );
  const previousScope = useRef(scope);

  useEffect(() => {
    if (previousScope.current === scope) return;
    client.clear();
    previousScope.current = scope;
  }, [client, scope]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
