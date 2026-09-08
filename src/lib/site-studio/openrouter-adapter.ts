import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { openRouterJson, OpenRouterError } from "@/lib/ai/openrouter";
import {
  generatedPageJsonSchema,
  validateGeneratedDocument,
  type PageBrief,
} from "./generate";
import type { SiteDocument } from "./document";

/** Repository transport for AI page generation. Registered job
 * site-page-draft (non-consequential, JSON mode) keeps model resolution,
 * receipts, and budgets on the existing gateway. Unconfigured workspaces
 * fail with the setup path named, never a silent fallback. */
export async function generatePageWithOpenRouter(
  database: SupabaseClient,
  brief: PageBrief,
  system: string,
  user: string,
): Promise<SiteDocument> {
  let raw: unknown;
  try {
    const result = await openRouterJson({
      database,
      job: "site-page-draft",
      maxTokens: 4000,
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      schemaName: "site_page_draft_v1",
      schema: generatedPageJsonSchema as unknown as Record<string, unknown>,
      validate: (value: unknown) => value,
    });
    raw = result.data;
  } catch (error) {
    if (error instanceof OpenRouterError && error.status === 503)
      throw new Error(
        "AI generation is not configured for this workspace. Connect OpenRouter under Setup, or create the page from the built-in template.",
      );
    throw new Error(
      `Page generation failed before validation: ${error instanceof Error ? error.message : "unknown provider error"}`,
    );
  }
  return validateGeneratedDocument(raw);
}
