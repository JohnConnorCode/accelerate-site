"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { usePathname } from "next/navigation";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Keep the existing live/public preference. A fictional business must never
  // publish its initial appearance to the storage channel used by live tabs.
  const scenario = pathname.match(/^\/demo\/command-center\/([^/]+)(?:\/|$)/)?.[1];
  const storageKey = scenario ? `accelerate:demo-theme:${scenario}` : "theme";
  return (
    <NextThemesProvider
      key={storageKey}
      storageKey={storageKey}
      attribute="data-theme"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange={true}
    >
      {children}
    </NextThemesProvider>
  );
}
