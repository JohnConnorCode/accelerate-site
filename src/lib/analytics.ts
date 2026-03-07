// ========================================
// ANALYTICS & CONVERSION TRACKING
// Merged from tracking.ts + analytics.ts
// ========================================

import type { CookiePreferences } from "@/lib/types";

// ========================================
// Cookie Consent Helpers
// ========================================

const COOKIE_KEY = "accelerate_cookie_consent";

export function getCookiePreferences(): CookiePreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(COOKIE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as CookiePreferences;
  } catch {
    return null;
  }
}

export function setCookiePreferences(prefs: CookiePreferences): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(COOKIE_KEY, JSON.stringify(prefs));
}

export function hasConsented(): boolean {
  return getCookiePreferences() !== null;
}

export function hasMarketingConsent(): boolean {
  const prefs = getCookiePreferences();
  return prefs?.marketing ?? false;
}

export function hasAnalyticsConsent(): boolean {
  const prefs = getCookiePreferences();
  return prefs?.analytics ?? false;
}

// ========================================
// Meta Pixel Event Mapping
// ========================================

const metaEventMap: Record<string, string> = {
  "Plan Builder Started": "Lead",
  "Plan Builder Step": "ViewContent",
  "Plan Generated": "Lead",
  "Contact Form Submitted": "Contact",
  "Website Graded": "ViewContent",
  "Website Grade Email Captured": "Lead",
  "Resource Downloaded": "Lead",
  "Newsletter Subscribed": "Lead",
  "ROI Calculated": "ViewContent",
  "ROI Email Captured": "Lead",
  "Partner Applied": "Lead",
  "Chat Lead Captured": "Lead",
  "Package Selected": "InitiateCheckout",
  "CTA Click": "ViewContent",
};

// ========================================
// Global type augmentation
// ========================================

declare global {
  interface Window {
    plausible?: (
      event: string,
      options?: { props?: Record<string, string | number> }
    ) => void;
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

// ========================================
// Event Tracking
// ========================================

export function trackEvent(
  name: string,
  props?: Record<string, string | number>
) {
  if (typeof window !== "undefined" && window.plausible) {
    window.plausible(name, props ? { props } : undefined);
  }
}

export function trackConversion(
  name: string,
  props?: Record<string, string | number>
) {
  if (typeof window === "undefined") return;

  const page = window.location.pathname;
  const allProps: Record<string, string | number> = { ...props, page };

  // Auto-attach UTM params to Plausible events
  try {
    const stored = localStorage.getItem("accelerate_utm");
    if (stored) {
      const utm = JSON.parse(stored);
      if (utm.utm_source) allProps.utm_source = utm.utm_source;
      if (utm.utm_medium) allProps.utm_medium = utm.utm_medium;
    }
  } catch {
    // ignore parse errors
  }

  // Plausible — always fires (first-party, no consent needed)
  trackEvent(name, allProps);

  // Google Analytics — requires analytics consent
  if (hasAnalyticsConsent() && typeof window.gtag === "function") {
    window.gtag("event", name, {
      event_category: "conversion",
      ...props,
    });
  }

  // Meta Pixel — requires marketing consent
  if (hasMarketingConsent() && typeof window.fbq === "function") {
    const metaEvent = metaEventMap[name] || "Lead";
    window.fbq("track", metaEvent, props);
  }
}
