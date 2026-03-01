import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { getSetting } from "@/lib/admin/settings";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function POST() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const apiKey = await getSetting("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return NextResponse.json(
      { insights: ["AI insights require an Anthropic API key. Add one in Settings."] }
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
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `You are a business intelligence analyst. Given these metrics, provide 3-5 short, actionable bullet insights. Focus on trends, opportunities, and recommended actions. Be specific with numbers. Keep each bullet to 1-2 sentences.\n\n${summaryText}`,
        },
      ],
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text : "";
    const insights = text
      .split("\n")
      .map((line) => line.replace(/^[-*]\s*/, "").trim())
      .filter((line) => line.length > 10);

    return NextResponse.json({ insights });
  } catch {
    return NextResponse.json({
      insights: ["Unable to generate AI insights. Check your Anthropic API key in Settings."],
    });
  }
}
