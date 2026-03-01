import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { getSetting } from "@/lib/admin/settings";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { title, keywords, category } = await request.json();

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const apiKey = await getSetting("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return NextResponse.json(
      { error: "Anthropic API key not configured. Add it in Settings." },
      { status: 400 }
    );
  }

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey });

    const prompt = `You are a content strategist for Accelerate, an AI solutions agency for small businesses. Generate a content brief for the following article:

Title: ${title}
${keywords ? `Target Keywords: ${keywords}` : ""}
${category ? `Category: ${category}` : ""}

Respond in this exact JSON format (no markdown, just JSON):
{
  "outline": ["Section 1: ...", "Section 2: ...", "Section 3: ..."],
  "seoTitle": "SEO-optimized title (under 60 chars)",
  "seoDescription": "Meta description (under 160 chars)",
  "wordCount": 1500,
  "keyTakeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3"]
}`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "{}";

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    const brief = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ brief });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate brief" },
      { status: 500 }
    );
  }
}
