import "server-only";
import { z } from "zod";
import { strictSiteOutputSchema, omitProviderNullFields } from "./structured-output";
import {
  collectAssetIds,
  collectRawUrls,
  parseSiteDocument,
  siteDocumentSchema,
  SITE_DOCUMENT_ENGINE,
  SITE_DOCUMENT_ENGINE_VERSION,
  SITE_DOCUMENT_SCHEMA_VERSION,
  SITE_NODE_TYPES,
  type SiteDocument,
} from "./document";
import { assertCatalogAsset, describeCatalogForPrompt } from "./assets";

/** AI page generation v1. Prompt construction and output validation are pure
 * and fully tested. Model transport is injected so tests never touch a
 * provider; the repository adapter lives in openrouter-adapter.ts. */

export interface PageBrief {
  serviceName: string;
  audience: string;
  outcome: string;
  extra?: string;
}

const HOUSE_RULES = [
  "Use 4 to 10 semantic sections (hero, featureGrid, faq, ctaBand, text, image, button, heading).",
  "Every section has a unique kebab-case id; every node has a unique kebab-case id.",
  "Images may only use catalog asset ids listed below; never invent image URLs.",
  "Copy fields must not contain raw URLs. CTA hrefs must be site-relative paths.",
  "Never invent prices, percentages, client names, or business metrics.",
  "Write direct, specific copy in the existing brand voice. No slogans.",
].join("\n");

export function buildPageSystemPrompt(): string {
  return [
    "You design marketing pages as structured JSON for the site renderer.",
    "Output a single JSON object with title, slug, description, and root (an array of section nodes).",
    `Available node types: ${SITE_NODE_TYPES.join(", ")}.`,
    "Section nodes hold children; all other nodes are leaves.",
    "Style with tokens only (background, paddingTop, paddingBottom, maxWidth, gap, align, tone).",
    "House rules:",
    HOUSE_RULES,
    "Approved image catalog (id: description):",
    describeCatalogForPrompt(),
  ].join("\n");
}

export function buildPageUserPrompt(brief: PageBrief): string {
  return [
    `Service: ${brief.serviceName}`,
    `Audience: ${brief.audience}`,
    `Outcome: ${brief.outcome}`,
    brief.extra?.trim() ? `Additional direction: ${brief.extra.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Model output shape: metadata plus the section tree. The envelope is added
 * by us after validation, so the model can never spoof schema versions. */
export const generatedPageJsonSchema = strictSiteOutputSchema(
  z
    .object({
      ...siteDocumentSchema.shape.metadata.shape,
      root: siteDocumentSchema.shape.root,
    })
    .strict(),
);

const INVENTED_METRIC = /(\$\s?\d|\d+\s*%)/;

/** Shared AI-copy grounding: invented prices, percentages, clients, and
 * metrics are refused before anything saves. Human-authored revisions are
 * exempt by design; model output never is. */
export function assertGroundedAiCopy(copy: string, scope: string): void {
  const metric = copy.match(INVENTED_METRIC);
  if (metric)
    throw new Error(
      `${scope} invents a metric (${metric[0]}); remove it or supply approved wording`,
    );
}

export function validateGeneratedDocument(value: unknown): SiteDocument {
  if (!value || typeof value !== "object") throw new Error("Generated page must be a JSON object");
  const body = omitProviderNullFields(value) as Record<string, unknown>;
  const document = parseSiteDocument({
    schemaVersion: SITE_DOCUMENT_SCHEMA_VERSION,
    engine: SITE_DOCUMENT_ENGINE,
    engineVersion: SITE_DOCUMENT_ENGINE_VERSION,
    root: body.root,
    metadata: { title: body.title, slug: body.slug, description: body.description },
  });
  for (const assetId of collectAssetIds(document)) assertCatalogAsset(assetId);
  const rawUrls = collectRawUrls(document);
  if (rawUrls.length > 0)
    throw new Error(
      `Generated copy invents links (${rawUrls.slice(0, 3).join(", ")}); CTA hrefs must be site-relative`,
    );
  const copy = JSON.stringify(document.root);
  assertGroundedAiCopy(copy, "Generated copy");
  return document;
}

export type PageCompleter = (system: string, user: string) => Promise<unknown>;

export async function generatePageDocument(
  brief: PageBrief,
  complete: PageCompleter,
): Promise<SiteDocument> {
  let raw: unknown;
  try {
    raw = await complete(buildPageSystemPrompt(), buildPageUserPrompt(brief));
  } catch (error) {
    throw new Error(
      `Page generation failed before validation: ${error instanceof Error ? error.message : "unknown provider error"}`,
    );
  }
  return validateGeneratedDocument(raw);
}
