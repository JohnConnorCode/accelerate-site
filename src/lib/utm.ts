// ========================================
// UTM ATTRIBUTION TRACKING
// ========================================

const UTM_KEY = "accelerate_utm";

const UTM_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

export interface UTMData {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  referrer?: string;
  landing_page?: string;
  captured_at?: string;
}

export function captureUTMParams(): void {
  if (typeof window === "undefined") return;

  // Don't overwrite if already captured this session
  const existing = localStorage.getItem(UTM_KEY);
  if (existing) return;

  const params = new URLSearchParams(window.location.search);
  const data: UTMData = {};
  let hasUTM = false;

  for (const key of UTM_PARAMS) {
    const val = params.get(key);
    if (val) {
      data[key] = val;
      hasUTM = true;
    }
  }

  // Always capture referrer and landing page if we have UTM params
  // or if there's an external referrer
  const referrer = document.referrer;
  const isExternalReferrer = referrer && !referrer.includes(window.location.hostname);

  if (hasUTM || isExternalReferrer) {
    if (isExternalReferrer) data.referrer = referrer;
    data.landing_page = window.location.pathname;
    data.captured_at = new Date().toISOString();
    localStorage.setItem(UTM_KEY, JSON.stringify(data));
  }
}

export function getUTMParams(): UTMData | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(UTM_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as UTMData;
  } catch {
    return null;
  }
}

export function clearUTMParams(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(UTM_KEY);
}
