import "server-only";
import { z } from "zod";
import { strictSiteOutputSchema, omitProviderNullFields } from "./structured-output";
import {
  SITE_NODE_TYPES,
  siteLeafNodeSchema,
  type SiteDocument,
  type SiteDraft,
  type SiteLeafNode,
  type SiteSectionNode,
} from "./document";
import { describeCatalogForPrompt } from "./assets";
import { assertGroundedAiCopy, type PageCompleter } from "./generate";
import { DraftNotFoundError } from "./drafts";
import {
  cloneDocumentForRevision,
  persistRevisedDocument,
  StaleDraftError,
  type EditableDocument,
} from "./revision";
import type { SiteDraftRepository } from "./store";

/** AI section regeneration: surgical improvement of one weak section with
 * the rest of the page provably untouched. The model proposes replacement
 * leaves; the server validates schema, catalog, links, and grounding, then
 * persists through the same revision path as patches. Sibling scoping is
 * structural (only the named section's children are replaced), never
 * requested politely in prose. */

export interface RegenerateSectionInput {
  direction?: string;
  expectedChecksum?: string;
}

export function buildSectionSystemPrompt(): string {
  return [
    "You redesign one marketing page section as structured JSON.",
    "Output a single JSON object with a children array of 1 to 20 leaf nodes.",
    `Available leaf types: ${SITE_NODE_TYPES.filter((type) => type !== "section").join(", ")}.`,
    "Every leaf has id, type and props. All content fields belong inside props; use the exact keys and enum values from the supplied JSON Schema.",
    "Every leaf needs a unique kebab-case id. Reuse an existing id only to intentionally supersede that node.",
    "Style with tokens only (background, paddingTop, paddingBottom, maxWidth, gap, align, tone) in the sibling styles object, not props.",
    "Exact output JSON Schema (also enforced after generation):",
    JSON.stringify(regeneratedSectionJsonSchema),
    "Images may only use catalog asset ids listed below; never invent image URLs.",
    "Copy fields must not contain raw URLs. CTA hrefs must be site-relative paths.",
    "Never invent prices, percentages, client names, or business metrics.",
    "Write direct, specific copy. No slogans.",
    "Approved image catalog (id: description):",
    describeCatalogForPrompt(),
  ].join("\n");
}

export function buildSectionUserPrompt(section: SiteSectionNode, direction?: string): string {
  return [
    `Current section id: ${section.id}`,
    `Current children: ${JSON.stringify(section.children)}`,
    direction?.trim() ? `Direction: ${direction.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export const regeneratedSectionJsonSchema = strictSiteOutputSchema(
  z
    .object({
      children: z.array(siteLeafNodeSchema).min(1).max(20),
    })
    .strict(),
);

function parseRegeneratedChildren(value: unknown): SiteLeafNode[] {
  if (!value || typeof value !== "object")
    throw new Error("Regenerated section must be a JSON object with a children array");
  const children = (value as Record<string, unknown>).children;
  if (!Array.isArray(children) || children.length < 1 || children.length > 20)
    throw new Error("Regenerated section must carry 1 to 20 leaf nodes");
  return children.map((child, index) => {
    const parsed = siteLeafNodeSchema.safeParse(omitProviderNullFields(child));
    if (!parsed.success)
      throw new Error(
        `Regenerated node ${index + 1} is invalid: ${parsed.error.issues[0]?.message ?? "schema refusal"}`,
      );
    return parsed.data;
  });
}

function findSection(document: SiteDocument, sectionId: string): SiteSectionNode {
  const section = document.root.find((entry) => entry.id === sectionId);
  if (!section) throw new Error(`Unknown section ${JSON.stringify(sectionId)}`);
  return section;
}

export async function regenerateSection(
  repo: SiteDraftRepository,
  id: string,
  sectionId: string,
  input: RegenerateSectionInput,
  complete: PageCompleter,
): Promise<SiteDraft> {
  const current = await repo.get(id);
  if (!current) throw new DraftNotFoundError(id);
  if (input.expectedChecksum !== undefined && input.expectedChecksum !== current.checksum)
    throw new StaleDraftError();
  const section = findSection(current.document, sectionId);
  let raw: unknown;
  try {
    raw = await complete(
      buildSectionSystemPrompt(),
      buildSectionUserPrompt(section, input.direction),
    );
  } catch (error) {
    throw new Error(
      `Section regeneration failed before validation: ${error instanceof Error ? error.message : "unknown provider error"}`,
    );
  }
  const children = parseRegeneratedChildren(raw);
  const freshIds = children.map((child) => child.id);
  if (new Set(freshIds).size !== freshIds.length)
    throw new Error("Regenerated node ids must be unique within the section");
  const outsideIds = new Set<string>();
  for (const entry of current.document.root) {
    if (entry.id === sectionId) continue;
    outsideIds.add(entry.id);
    for (const child of entry.children) outsideIds.add(child.id);
  }
  const collision = freshIds.find((childId) => outsideIds.has(childId));
  if (collision)
    throw new Error(
      `Regenerated id ${JSON.stringify(collision)} collides outside the section; scoping is enforced, not requested`,
    );
  assertGroundedAiCopy(JSON.stringify(children), "Regenerated section");
  const working = cloneDocumentForRevision(current.document) as unknown as EditableDocument;
  const target = working.root.find((entry) => entry.id === sectionId);
  if (!target) throw new Error(`Unknown section ${JSON.stringify(sectionId)}`);
  target.children = children.map((child) => ({
    ...structuredClone(child),
  })) as EditableDocument["root"][number]["children"];
  // Catalog, link, size, and slug rules run inside the shared persist path;
  // grounding above is the AI-only addition.
  return persistRevisedDocument(repo, current, working);
}
