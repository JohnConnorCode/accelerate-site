import { tenant } from "@/config/tenant";
import { approvedPricingPromptContext, assertApprovedPricingRows } from "@/lib/ai/approved-pricing";

/** Proposal drafting contract, shared by the generate route and the model eval. */
export const PROPOSAL_SYSTEM_PROMPT = `You generate JSON business proposals for ${tenant.ai.businessDescriptor}, which builds and runs custom AI systems for small businesses.

Style:
- Confident, specific, revenue-first. Talk in jobs, clients, appointments, revenue, not "leads."
- Frame AI as teammates ("a teammate that books your calendar 24/7"), not software.
- Reference the client's industry and the intake details concretely. No generic filler.
- Pricing can only use the approved service catalog below. For every priced item, use the exact catalog name and exact one-time/monthly amounts. Do not invent discounts, bundles, taxes, terms, or custom prices. If no catalog item fits, use null for pricing and state that founder scope confirmation is required.

APPROVED SERVICE CATALOG (the only source permitted for money):
${approvedPricingPromptContext()}

You always return ONLY a valid JSON object with exactly this shape:
{
  "sections": [
    { "title": "Executive Summary", "content": "..." },
    { "title": "Understanding Your Needs", "content": "..." },
    { "title": "Proposed Solution", "content": "..." },
    { "title": "Services Included", "items": ["item1", "item2", ...] },
    { "title": "Investment", "content": "...", "pricing": [{ "item": "...", "monthly": 0, "oneTime": 0 }] },
    { "title": "Timeline", "content": "..." },
    { "title": "Next Steps", "content": "..." }
  ]
}

No commentary outside the JSON. No markdown fences.`;

export const PROPOSAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["sections"],
  properties: {
    sections: {
      type: "array",
      minItems: 5,
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "content", "items", "pricing"],
        properties: {
          title: { type: "string", maxLength: 120 },
          content: { type: ["string", "null"], maxLength: 5000 },
          items: {
            type: ["array", "null"],
            maxItems: 30,
            items: { type: "string", maxLength: 500 },
          },
          pricing: {
            type: ["array", "null"],
            maxItems: 20,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["item", "monthly", "oneTime"],
              properties: {
                item: { type: "string", maxLength: 240 },
                monthly: { type: "number", minimum: 0, maximum: 1000000 },
                oneTime: { type: "number", minimum: 0, maximum: 1000000 },
              },
            },
          },
        },
      },
    },
  },
} as const;

export function validateProposal(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    !Array.isArray((value as { sections?: unknown }).sections)
  )
    throw new Error("OpenRouter returned an invalid proposal draft");
  const proposal = value as {
    sections: Array<{
      title: string;
      content?: string | null;
      items?: string[] | null;
      pricing?: Array<{ item: string; monthly: number; oneTime: number }> | null;
    }>;
  };
  for (const section of proposal.sections)
    if (section.pricing) assertApprovedPricingRows(section.pricing);
  return proposal;
}

export function buildProposalUserPrompt(lead: {
  contact_name: string;
  business_name?: string | null;
  industry?: string | null;
  intake_data?: unknown;
  ai_plan?: unknown;
}): string {
  const intakeStr = lead.intake_data
    ? JSON.stringify(lead.intake_data, null, 2)
    : "No intake data available";
  const aiPlanStr = lead.ai_plan
    ? JSON.stringify(lead.ai_plan, null, 2).substring(0, 3000)
    : "No AI plan generated";
  return `Client details:

Name: ${lead.contact_name}
Business: ${lead.business_name || "Unknown"}
Industry: ${lead.industry?.replace(/_/g, " ") || "Unknown"}

Intake Data:
${intakeStr}

AI Plan Summary:
${aiPlanStr}

Generate the proposal JSON for this client now. Make it specific to their industry, their pain points, and their goals.`;
}
