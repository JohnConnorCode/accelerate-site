export interface PageBrief {
  serviceName: string;
  audience: string;
  outcome: string;
  extra?: string;
}

export function buildPageUserPrompt(brief: PageBrief): string {
  return [
    `Service: ${brief.serviceName}`,
    `Audience: ${brief.audience}`,
    `Outcome: ${brief.outcome}`,
    brief.extra?.trim() ? `Additional direction: ${brief.extra.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
