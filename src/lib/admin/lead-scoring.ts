interface LeadData {
  contact_phone?: string;
  contact_email: string;
  industry: string;
  ai_plan?: unknown;
  intake_data?: Record<string, unknown>;
  view_count?: number;
}

const HIGH_VALUE_INDUSTRIES = ["law_firm", "real_estate", "professional_services"];
const BUSINESS_EMAIL_DOMAINS = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com"];

export function calculateLeadScore(lead: LeadData): number {
  let score = 0;

  // +20 phone provided
  if (lead.contact_phone) score += 20;

  // +15 plan viewed (has AI plan)
  if (lead.ai_plan) score += 15;

  // +10 business email domain (not free email)
  const emailDomain = lead.contact_email.split("@")[1]?.toLowerCase() || "";
  if (!BUSINESS_EMAIL_DOMAINS.includes(emailDomain)) score += 10;

  // +20 high-value industry
  if (HIGH_VALUE_INDUSTRIES.includes(lead.industry)) score += 20;

  // +15 detailed intake responses (has 5+ filled fields)
  if (lead.intake_data) {
    const filledFields = Object.values(lead.intake_data).filter(
      (v) => v !== undefined && v !== null && v !== "",
    ).length;
    if (filledFields >= 5) score += 15;
  }

  // +20 revisited plan (view_count > 1)
  if (lead.view_count && lead.view_count > 1) score += 20;

  return Math.min(score, 100);
}

export function getScoreColor(score: number): string {
  if (score >= 70) return "text-emerald-400 bg-emerald-500/20";
  if (score >= 40) return "text-yellow-400 bg-yellow-500/20";
  return "text-red-400 bg-red-500/20";
}

export function getScoreLabel(score: number): string {
  if (score >= 70) return "Hot";
  if (score >= 40) return "Warm";
  return "Cold";
}
