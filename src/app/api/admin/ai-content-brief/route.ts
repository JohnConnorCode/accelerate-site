import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { openRouterJson } from "@/lib/ai/openrouter";
import { isTenantOpenRouterConfigured } from "@/lib/ai/openrouter-credentials";

import {
  CONTENT_BRIEF_CONTEXT_VERSION,
  CONTENT_BRIEF_SOURCE_ALLOWLIST,
  MAX_CONTENT_BRIEF_SOURCE_CHARS,
  MAX_CONTENT_BRIEF_CONTEXT_CHARS,
  CONTENT_BRIEF_SCHEMA,
  parseContentBriefInput,
  validateContentBrief,
  buildContentBriefSystemPrompt,
  type ContentBriefInput,
} from "@/lib/ai/content-brief";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  let input: ContentBriefInput;
  try {
    input = parseContentBriefInput(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid content brief request" },
      { status: 400 },
    );
  }

  if (!(await isTenantOpenRouterConfigured(auth.database))) {
    return NextResponse.json(
      {
        error: "OpenRouter is not configured for this workspace. Add its API key in Integrations.",
      },
      { status: 400 },
    );
  }

  try {
    const messages = [
      { role: "system" as const, content: buildContentBriefSystemPrompt() },
      {
        role: "user" as const,
        content: [
          "Create a grounded article content brief from this bounded source object.",
          "BEGIN UNTRUSTED ADMIN REQUEST",
          JSON.stringify(input),
          "END UNTRUSTED ADMIN REQUEST",
        ].join("\n"),
      },
    ];
    if (
      messages.reduce((total, message) => total + message.content.length, 0) >
      MAX_CONTENT_BRIEF_CONTEXT_CHARS
    ) {
      throw new Error("Content brief context exceeded its fixed budget");
    }
    const response = await openRouterJson({
      database: auth.database,
      model: process.env.OPENROUTER_CONTENT_MODEL,
      maxTokens: 1_000,
      temperature: 0.2,
      schemaName: "grounded_content_brief",
      schema: CONTENT_BRIEF_SCHEMA,
      validate: (value) => validateContentBrief(value, input),
      messages,
    });
    return NextResponse.json({
      brief: response.data,
      provider: "openrouter",
      model: response.model,
      requestId: response.requestId,
      context: {
        version: CONTENT_BRIEF_CONTEXT_VERSION,
        sources: CONTENT_BRIEF_SOURCE_ALLOWLIST,
        sourceBudgetChars: MAX_CONTENT_BRIEF_SOURCE_CHARS,
        contextBudgetChars: MAX_CONTENT_BRIEF_CONTEXT_CHARS,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate brief" },
      { status: 500 },
    );
  }
}
