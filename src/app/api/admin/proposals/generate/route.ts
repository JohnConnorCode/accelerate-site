import { tenant } from "@/config/tenant";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { rateLimit } from "@/lib/rate-limit";
import { openRouterJson } from "@/lib/ai/openrouter";
import { isTenantOpenRouterConfigured } from "@/lib/ai/openrouter-credentials";
import { approvedPricingPromptContext, assertApprovedPricingRows } from "@/lib/ai/approved-pricing";

const GENERATE_LIMIT = 30;
const GENERATE_WINDOW_MS = 60 * 60 * 1000;

const PROPOSAL_SYSTEM_PROMPT = `You generate JSON business proposals for ${tenant.ai.businessDescriptor}, which builds and runs custom AI systems for small businesses.

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

const PROPOSAL_SCHEMA = {
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

function validateProposal(value: unknown) {
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

export async function POST(request: NextRequest) {
  const auth = await requireAdminForModule("proposals");
  if (auth instanceof NextResponse) return auth;

  const adminKey = auth.user.email ?? auth.user.id;
  const { success } = rateLimit(
    `admin-proposal-gen:${adminKey}`,
    GENERATE_LIMIT,
    GENERATE_WINDOW_MS,
  );
  if (!success) {
    return NextResponse.json(
      { error: "Rate limit reached (30 proposals/hour). Wait a moment and try again." },
      { status: 429 },
    );
  }

  const { lead_id } = await request.json();

  if (!lead_id) {
    return NextResponse.json({ error: "lead_id is required" }, { status: 400 });
  }

  const supabase = auth.database;

  const { data: lead, error: leadError } = await supabase
    .from("solution_requests")
    .select("*")
    .eq("id", lead_id)
    .single();

  if (leadError || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (!(await isTenantOpenRouterConfigured(supabase))) {
    return NextResponse.json(
      {
        error: "OpenRouter is not configured for this workspace. Add its API key in Integrations.",
      },
      { status: 503 },
    );
  }

  try {
    const intakeStr = lead.intake_data
      ? JSON.stringify(lead.intake_data, null, 2)
      : "No intake data available";

    const aiPlanStr = lead.ai_plan
      ? JSON.stringify(lead.ai_plan, null, 2).substring(0, 3000)
      : "No AI plan generated";

    const response = await openRouterJson({
      database: supabase,
      model: process.env.OPENROUTER_PROPOSAL_MODEL,
      maxTokens: 2000,
      temperature: 0.2,
      schemaName: "proposal_draft",
      schema: PROPOSAL_SCHEMA,
      validate: validateProposal,
      messages: [
        { role: "system", content: PROPOSAL_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Client details:

Name: ${lead.contact_name}
Business: ${lead.business_name || "Unknown"}
Industry: ${lead.industry?.replace(/_/g, " ") || "Unknown"}

Intake Data:
${intakeStr}

AI Plan Summary:
${aiPlanStr}

Generate the proposal JSON for this client now. Make it specific to their industry, their pain points, and their goals.`,
        },
      ],
    });

    const proposalContent = response.data;

    let totalMonthly = 0;
    let totalOneTime = 0;
    const investmentSection = proposalContent.sections?.find((s: { title: string }) =>
      s.title.toLowerCase().includes("investment"),
    );
    if (investmentSection?.pricing) {
      for (const item of investmentSection.pricing) {
        totalMonthly += item.monthly || 0;
        totalOneTime += item.oneTime || 0;
      }
    }

    return NextResponse.json({
      content: proposalContent,
      totalMonthly,
      totalOneTime,
      clientName: lead.contact_name,
      businessName: lead.business_name,
      provider: "openrouter",
      model: response.model,
      requestId: response.requestId,
    });
  } catch (error) {
    console.error("[proposals/generate] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate proposal" },
      { status: 500 },
    );
  }
}
