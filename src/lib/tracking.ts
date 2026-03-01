// ========================================
// TRACKING & CONVERSION EVENTS
// ========================================

import type { CookiePreferences } from "@/lib/types";

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
// Conversion Events
// ========================================

type ConversionEvent =
  | "plan_generated"
  | "consultation_booked"
  | "resource_downloaded"
  | "website_graded"
  | "roi_calculated"
  | "partner_applied"
  | "contact_form_submitted"
  | "package_selected";

interface ConversionData {
  value?: number;
  currency?: string;
  label?: string;
  [key: string]: string | number | undefined;
}

export function trackConversion(event: ConversionEvent, data?: ConversionData): void {
  if (typeof window === "undefined") return;

  // Google Tag (gtag)
  if (hasAnalyticsConsent() && typeof window.gtag === "function") {
    window.gtag("event", event, {
      event_category: "conversion",
      event_label: data?.label,
      value: data?.value,
      currency: data?.currency || "USD",
    });
  }

  // Meta Pixel (fbq)
  if (hasMarketingConsent() && typeof window.fbq === "function") {
    const metaEventMap: Record<ConversionEvent, string> = {
      plan_generated: "Lead",
      consultation_booked: "Schedule",
      resource_downloaded: "Lead",
      website_graded: "ViewContent",
      roi_calculated: "ViewContent",
      partner_applied: "Lead",
      contact_form_submitted: "Contact",
      package_selected: "InitiateCheckout",
    };
    window.fbq("track", metaEventMap[event], {
      value: data?.value,
      currency: data?.currency || "USD",
    });
  }
}

// ========================================
// Global type augmentation for tracking SDKs
// ========================================

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}
