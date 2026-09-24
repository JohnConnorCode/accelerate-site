import "server-only";

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
import { contextReceipt, loadContextPack } from "@/lib/revenue-os/shared-context";
import type { SupabaseClient } from "@supabase/supabase-js";

export { parseContentBriefInput };
export type { ContentBriefInput };

export class ContentBriefInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContentBriefInputError";
  }
}

export class ContentBriefConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContentBriefConfigurationError";
  }
}

export async function generateContentBrief(database: SupabaseClient, value: unknown) {
  let input: ContentBriefInput;
  try {
    input = parseContentBriefInput(value);
  } catch (error) {
    throw new ContentBriefInputError(
      error instanceof Error ? error.message : "Invalid content brief request",
    );
  }
  if (!(await isTenantOpenRouterConfigured(database))) {
    throw new ContentBriefConfigurationError(
      "OpenRouter is not configured for this workspace. Add its API key in Integrations.",
    );
  }

  const guidance = await loadContextPack(database, { includeEvidence: false, maxChars: 2000 });
  const messages = [
    { role: "system" as const, content: buildContentBriefSystemPrompt() },
    { role: "system" as const, content: guidance.text },
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
    database,
    job: "content-brief",
    model: process.env.OPENROUTER_CONTENT_MODEL,
    maxTokens: 1000,
    temperature: 0.2,
    schemaName: "grounded_content_brief",
    schema: CONTENT_BRIEF_SCHEMA,
    validate: (output) => validateContentBrief(output, input),
    messages,
  });
  return {
    brief: response.data,
    provider: "openrouter" as const,
    model: response.model,
    requestId: response.requestId,
    context: {
      version: CONTENT_BRIEF_CONTEXT_VERSION,
      guidance: contextReceipt(guidance),
      sources: CONTENT_BRIEF_SOURCE_ALLOWLIST,
      sourceBudgetChars: MAX_CONTENT_BRIEF_SOURCE_CHARS,
      contextBudgetChars: MAX_CONTENT_BRIEF_CONTEXT_CHARS,
    },
  };
}
