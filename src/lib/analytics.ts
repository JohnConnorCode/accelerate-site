// ========================================
// ANALYTICS & CONVERSION TRACKING
// Merged from tracking.ts + analytics.ts
// ========================================

import type { CookiePreferences } from "@/lib/types";
import { getUTMParams } from "@/lib/utm";

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
  roofing_audit_cta: "ViewContent",
  qualifier_started: "ViewContent",
  qualifier_completed: "Lead",
  calendar_viewed: "Schedule",
  call_booked: "Schedule",
};

// ========================================
// Global type augmentation
// ========================================

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

// ========================================
// Event Tracking
// ========================================

export function trackEvent(name: string, props?: Record<string, string | number>) {
  sendFirstPartyEvent(name, props);
}

function visitorId(): string {
  const key = "accelerate_analytics_visitor";
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const value = crypto.randomUUID();
    sessionStorage.setItem(key, value);
    return value;
  } catch {
    return crypto.randomUUID();
  }
}

function safeEventName(name: string) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "event"
  );
}

function sendFirstPartyEvent(name: string, props?: Record<string, string | number>) {
  if (typeof window === "undefined" || window.location.pathname.startsWith("/admin")) return;
  const attribution = getUTMParams() || undefined;
  const referrerHost = (() => {
    try {
      return document.referrer ? new URL(document.referrer).host : undefined;
    } catch {
      return undefined;
    }
  })();
  const properties = Object.fromEntries(
    Object.entries(props || {})
      .filter(([key, value]) => key !== "page" && typeof value !== "undefined")
      .slice(0, 12),
  );
  const payload = {
    eventId: crypto.randomUUID(),
    visitorId: visitorId(),
    name: safeEventName(name),
    path: window.location.pathname,
    referrerHost,
    attribution,
    properties,
  };
  void fetch("/api/analytics/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
    credentials: "same-origin",
  }).catch(() => undefined);
}

export function trackConversion(name: string, props?: Record<string, string | number>) {
  if (typeof window === "undefined") return;

  const page = window.location.pathname;
  const allProps: Record<string, string | number> = { ...props, page };

  const attribution = getUTMParams();
  if (attribution)
    Object.assign(
      allProps,
      Object.fromEntries(
        Object.entries(attribution).filter(([, value]) => typeof value === "string"),
      ),
    );

  // First-party Revenue OS collection is always attempted; it is non-blocking.
  trackEvent(name, allProps);

  // Google Analytics
  if (typeof window.gtag === "function") {
    window.gtag("event", name, {
      event_category: "conversion",
      ...props,
    });
  }

  // Meta Pixel
  if (typeof window.fbq === "function") {
    const metaEvent = metaEventMap[name] || "Lead";
    window.fbq("track", metaEvent, props);
  }
}
