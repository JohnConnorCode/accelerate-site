import "server-only";
import { DEFAULT_SITE_MODEL, SiteModelSelectionError, type SitePriceCeiling } from "./models";
import { resolveSiteModel } from "./model-catalog";
import type { SupabaseClient } from "@supabase/supabase-js";
import { openRouterJson, OpenRouterError } from "@/lib/ai/openrouter";
import { validateGeneratedDocument, type PageBrief } from "./generate";
import {
  siteJsonEnvelopeSchema,
  siteJsonEnvelopePrompt,
  decodeSiteJsonEnvelope,
} from "./structured-output";
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
  model = DEFAULT_SITE_MODEL,
  priceCeiling?: SitePriceCeiling,
): Promise<SiteDocument> {
  let raw: unknown;
  try {
    const result = await openRouterJson({
      database,
      job: "site-page-draft",
      timeoutMs: 150_000,
      ...(await resolveSiteModel(model, priceCeiling)),
      maxTokens: 8000,
      messages: [
        { role: "system", content: siteJsonEnvelopePrompt(system) },
        { role: "user", content: user },
      ],
      schemaName: "site_page_draft_v1",
      schema: siteJsonEnvelopeSchema,
      validate: decodeSiteJsonEnvelope,
    });
    raw = result.data;
  } catch (error) {
    if (error instanceof SiteModelSelectionError) throw error;
    if (error instanceof OpenRouterError && error.status === 503)
      throw new Error(
        "AI generation is not configured for this workspace. Connect OpenRouter under Setup, or create the page from the built-in template.",
      );
    throw new Error(
      `Page generation failed before validation: ${error instanceof Error ? error.message : "unknown provider error"}`,
      { cause: error },
    );
  }
  return validateGeneratedDocument(raw);
}

/** Raw transport for section regeneration. Validation lives in the service
 * so provider output is never trusted; the same site-page-draft job,
 * receipts, and budgets apply. */
export async function regenerateSectionWithOpenRouter(
  database: SupabaseClient,
  system: string,
  user: string,
  model = DEFAULT_SITE_MODEL,
  priceCeiling?: SitePriceCeiling,
): Promise<unknown> {
  try {
    const result = await openRouterJson({
      database,
      job: "site-page-draft",
      timeoutMs: 150_000,
      ...(await resolveSiteModel(model, priceCeiling)),
      maxTokens: 4000,
      messages: [
        { role: "system", content: siteJsonEnvelopePrompt(system) },
        { role: "user", content: user },
      ],
      schemaName: "site_section_regenerate_v1",
      schema: siteJsonEnvelopeSchema,
      validate: decodeSiteJsonEnvelope,
    });
    return result.data;
  } catch (error) {
    if (error instanceof SiteModelSelectionError) throw error;
    if (error instanceof OpenRouterError && error.status === 503)
      throw new Error(
        "AI generation is not configured for this workspace. Connect OpenRouter under Setup to regenerate sections.",
      );
    throw error instanceof Error ? error : new Error("Section regeneration failed");
  }
}
