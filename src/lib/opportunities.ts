import type { UTMData } from "@/lib/utm";

export const OPPORTUNITY_STAGES = [
  "nurture",
  "qualified",
  "calendar_viewed",
  "booked",
  "showed",
  "no_show",
  "proposal",
  "won",
  "lost",
] as const;

export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

export const QUALIFYING_ROLES = new Set([
  "owner",
  "founder",
  "president",
  "general_manager",
  "operations",
  "marketing",
]);

export const QUALIFYING_REVENUE_BANDS = new Set([
  "1m_3m",
  "3m_10m",
  "10m_plus",
]);

export interface RoofingQualifierInput {
  email: string;
  companyWebsite: string;
  role: string;
  revenueBand: string;
  primaryLeak: string;
  messageVariant?: string;
  utm?: UTMData | null;
  website?: string;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeWebsite(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;

  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!url.hostname.includes(".")) return null;
    return `${url.protocol}//${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return null;
  }
}

export function isValidWorkEmail(value: string): boolean {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return false;
  const domain = value.split("@")[1]?.toLowerCase();
  return Boolean(domain && !new Set(["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com"]).has(domain));
}

export function qualifyRoofingOpportunity(role: string, revenueBand: string) {
  const roleQualified = QUALIFYING_ROLES.has(role);
  const revenueQualified = QUALIFYING_REVENUE_BANDS.has(revenueBand);
  const qualified = roleQualified && revenueQualified;

  return {
    qualified,
    reason: qualified
      ? "Decision-maker at a $1M+ roofing or exterior company"
      : !roleQualified
        ? "Role is not currently a buying decision-maker"
        : "Company is below the current managed-service fit threshold",
  };
}

export function safeAttribution(utm?: UTMData | null) {
  const clean = (value?: string, max = 255) => value?.trim().slice(0, max) || null;
  return {
    utm_source: clean(utm?.utm_source, 120),
    utm_medium: clean(utm?.utm_medium, 120),
    utm_campaign: clean(utm?.utm_campaign, 160),
    utm_term: clean(utm?.utm_term, 160),
    utm_content: clean(utm?.utm_content, 160),
    referrer: clean(utm?.referrer, 500),
    landing_page: clean(utm?.landing_page, 300) || "/roofing",
  };
}
