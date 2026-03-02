import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { lead_id } = await request.json();

  if (!lead_id) {
    return NextResponse.json({ error: "lead_id is required" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // Get lead data
  const { data: lead, error: leadError } = await supabase
    .from("solution_requests")
    .select("*")
    .eq("id", lead_id)
    .single();

  if (leadError || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // Get API key from settings
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
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `Generate a professional business proposal JSON for an AI operations agency called "Accelerate". The client details:

Name: ${lead.contact_name}
Business: ${lead.business_name || "Unknown"}
Industry: ${lead.industry?.replace(/_/g, " ") || "Unknown"}
Intake Data: ${intakeStr}
AI Plan Summary: ${aiPlanStr}

Return ONLY a valid JSON object with this structure:
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

Make it specific to the client's industry and needs. Use confident, professional language. Focus on ROI and revenue impact.`,
        },
      ],
    });

    const textContent = message.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from AI");
    }

    // Extract JSON from response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse proposal JSON");
    }

    const proposalContent = JSON.parse(jsonMatch[0]);

    // Calculate totals from pricing if available
    let totalMonthly = 0;
    let totalOneTime = 0;
    const investmentSection = proposalContent.sections?.find(
      (s: { title: string }) => s.title.toLowerCase().includes("investment")
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate proposal" },
      { status: 500 }
    );
  }
}
