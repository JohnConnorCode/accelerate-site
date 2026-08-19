import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { isOpenRouterConfigured, openRouterJson } from "@/lib/ai/openrouter";

const CONTENT_BRIEF_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["outline", "seoTitle", "seoDescription", "wordCount", "keyTakeaways"],
  properties: {
    outline: { type: "array", minItems: 3, maxItems: 12, items: { type: "string", maxLength: 240 } },
    seoTitle: { type: "string", maxLength: 60 }, seoDescription: { type: "string", maxLength: 160 },
    wordCount: { type: "integer", minimum: 500, maximum: 5000 },
    keyTakeaways: { type: "array", minItems: 3, maxItems: 8, items: { type: "string", maxLength: 300 } },
  },
} as const;

function validateBrief(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("OpenRouter returned an invalid content brief");
  const row = value as Record<string, unknown>;
  if (!Array.isArray(row.outline) || !Array.isArray(row.keyTakeaways) || typeof row.seoTitle !== "string" || typeof row.seoDescription !== "string" || !Number.isFinite(row.wordCount)) throw new Error("OpenRouter returned an incomplete content brief");
  return row;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { title, keywords, category } = await request.json();

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  if (!isOpenRouterConfigured()) {
    return NextResponse.json(
      { error: "OpenRouter is not configured. Add OPENROUTER_API_KEY in Setup Center." },
      { status: 400 }
    );
  }

  try {
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

    const response = await openRouterJson({
      model: process.env.OPENROUTER_CONTENT_MODEL,
      maxTokens: 600,
      temperature: 0.2,
      schemaName: "content_brief",
      schema: CONTENT_BRIEF_SCHEMA,
      validate: validateBrief,
      messages: [{ role: "user", content: prompt }],
    });
    return NextResponse.json({ brief: response.data, provider: "openrouter", model: response.model, requestId: response.requestId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate brief" },
      { status: 500 }
    );
  }
}
