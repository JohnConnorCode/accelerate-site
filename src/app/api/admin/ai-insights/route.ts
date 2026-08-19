import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { isOpenRouterConfigured, openRouterChat } from "@/lib/ai/openrouter";

export async function POST() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  if (!isOpenRouterConfigured()) {
    return NextResponse.json(
      { insights: ["AI insights require OpenRouter. Add OPENROUTER_API_KEY in Setup Center."] }
    );
  }

  const supabase = createServiceRoleClient();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Gather last 30 days of data
  const [leadsRes, chatRes, emailRes] = await Promise.all([
    supabase
      .from("solution_requests")
      .select("industry, lead_status, created_at, contact_phone, ai_plan")
      .gte("created_at", thirtyDaysAgo),
    supabase
      .from("chat_leads")
      .select("id, created_at")
      .gte("created_at", thirtyDaysAgo),
    supabase
      .from("email_sequences")
      .select("status, sequence_type")
      .gte("created_at", thirtyDaysAgo),
  ]);

  const leads = leadsRes.data || [];
  const chats = chatRes.data || [];
  const emails = emailRes.data || [];

  // Build summary for AI
  const statusCounts: Record<string, number> = {};
  const industryCounts: Record<string, number> = {};
  leads.forEach((l: { lead_status: string; industry: string }) => {
    statusCounts[l.lead_status || "new"] = (statusCounts[l.lead_status || "new"] || 0) + 1;
    industryCounts[l.industry] = (industryCounts[l.industry] || 0) + 1;
  });

  const summaryText = `Last 30 days metrics for Accelerate (AI solutions agency):
- Total new leads: ${leads.length}
- Chat widget leads: ${chats.length}
- Email sequences active: ${emails.filter((e: { status: string }) => e.status === "active").length}
- Lead pipeline: ${JSON.stringify(statusCounts)}
- Industries: ${JSON.stringify(industryCounts)}
- Leads with plans generated: ${leads.filter((l: { ai_plan?: unknown }) => l.ai_plan).length}
- Leads with phone numbers: ${leads.filter((l: { contact_phone?: string }) => l.contact_phone).length}
Today's date: ${now.toISOString().split("T")[0]}`;

  try {
    const response = await openRouterChat({
      model: process.env.OPENROUTER_INSIGHTS_MODEL,
      maxTokens: 400,
      messages: [
        {
          role: "user",
          content: `You are a business intelligence analyst. Given these metrics, provide 3-5 short, actionable bullet insights. Focus on trends, opportunities, and recommended actions. Be specific with numbers. Keep each bullet to 1-2 sentences.\n\n${summaryText}`,
        },
      ],
    });

    const text = response.choices[0]?.message.content || "";
    const insights = text
      .split("\n")
      .map((line) => line.replace(/^[-*]\s*/, "").trim())
      .filter((line) => line.length > 10);

    return NextResponse.json({ insights });
  } catch {
    return NextResponse.json({
      insights: ["Unable to generate AI insights. Check OpenRouter in Setup Center."],
    });
  }
}
