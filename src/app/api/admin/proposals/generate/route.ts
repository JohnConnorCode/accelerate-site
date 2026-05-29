import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";
import { rateLimit } from "@/lib/rate-limit";
import Anthropic from "@anthropic-ai/sdk";

const PROPOSAL_MODEL = process.env.PROPOSAL_MODEL || "claude-sonnet-4-20250514";
const GENERATE_LIMIT = 30;
const GENERATE_WINDOW_MS = 60 * 60 * 1000;

const PROPOSAL_SYSTEM_PROMPT = `You generate JSON business proposals for Accelerate, an embedded AI operations team that builds and runs custom AI systems for small businesses.

Style:
- Confident, specific, revenue-first. Talk in jobs, clients, appointments, revenue, not "leads."
- Frame AI as teammates ("a teammate that books your calendar 24/7"), not software.
- Reference the client's industry and the intake details concretely. No generic filler.
- Pricing must be realistic and tied to the recommendations.

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

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const adminKey = auth.user.email ?? auth.user.id;
  const { success } = rateLimit(`admin-proposal-gen:${adminKey}`, GENERATE_LIMIT, GENERATE_WINDOW_MS);
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

  const supabase = createServiceRoleClient();

  const { data: lead, error: leadError } = await supabase
    .from("solution_requests")
    .select("*")
    .eq("id", lead_id)
    .single();

  if (leadError || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const { data: apiKeySetting } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", "ANTHROPIC_API_KEY")
    .single();

  const apiKey = apiKeySetting?.value || process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 500 });
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    const intakeStr = lead.intake_data
      ? JSON.stringify(lead.intake_data, null, 2)
      : "No intake data available";

    const aiPlanStr = lead.ai_plan
      ? JSON.stringify(lead.ai_plan, null, 2).substring(0, 3000)
      : "No AI plan generated";

    const message = await anthropic.messages.create({
      model: PROPOSAL_MODEL,
      max_tokens: 2000,
      system: [
        {
          type: "text",
          text: PROPOSAL_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
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

    const textContent = message.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from AI");
    }

    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse proposal JSON");
    }

    const proposalContent = JSON.parse(jsonMatch[0]);

    let totalMonthly = 0;
    let totalOneTime = 0;
    const investmentSection = proposalContent.sections?.find(
      (s: { title: string }) => s.title.toLowerCase().includes("investment"),
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
    });
  } catch (error) {
    console.error("[proposals/generate] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate proposal" },
      { status: 500 },
    );
  }
}
