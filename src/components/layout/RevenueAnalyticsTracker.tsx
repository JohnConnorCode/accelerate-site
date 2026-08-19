"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/analytics";

/** Records one privacy-minimised first-party page view for each client route. */
export function RevenueAnalyticsTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin") || navigator.webdriver) return;
    trackEvent("page_view", { page: pathname });
  }, [pathname]);
  return null;
}
