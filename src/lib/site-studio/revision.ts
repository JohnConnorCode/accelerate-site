import "server-only";
import { z } from "zod";
import {
  collectAssetIds,
  collectRawUrls,
  parseSiteDocument,
  siteNodeIdSchema,
  siteSlugSchema,
  siteStyleSchema,
  type SiteDocument,
  type SiteDraft,
} from "./document";
import { assertCatalogAsset } from "./assets";
import { SlugInUseError } from "./drafts";
import type { SiteDraftRepository } from "./store";

/** Draft revision through typed patch operations. Creation accepts AI
 * output; revision accepts human intent. Both validate server-side, but
 * only AI output is refused for invented metrics — a founder editing
 * their own draft owns the words, the same as static site copy today. */

export class DraftNotFoundError extends Error {
  constructor(id: string) {
    super(`Draft ${id} does not exist`);
    this.name = "DraftNotFoundError";
  }
}

export class StaleDraftError extends Error {
  constructor() {
    super("This draft changed since you opened it; reload and reapply your edit");
    this.name = "StaleDraftError";
  }
}

const leafNodeSchema = z
  .object({
    id: siteNodeIdSchema,
    type: z.enum(["hero", "heading", "text", "image", "button", "featureGrid", "faq", "ctaBand"]),
    props: z.record(z.string(), z.unknown()),
    styles: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const sitePatchSchema = z.discriminatedUnion("op", [
  z
    .object({ op: z.literal("setProp"), nodeId: siteNodeIdSchema, path: z.string().min(1).max(80), value: z.unknown() })
    .strict(),
  z
    .object({ op: z.literal("setStyle"), nodeId: siteNodeIdSchema, path: z.string().min(1).max(80), value: z.unknown() })
    .strict(),
  z
    .object({ op: z.literal("insert"), parentId: siteNodeIdSchema, index: z.number().int().min(0).max(40).optional(), node: leafNodeSchema })
    .strict(),
  z.object({ op: z.literal("remove"), nodeId: siteNodeIdSchema }).strict(),
  z
    .object({
      op: z.literal("move"),
      nodeId: siteNodeIdSchema,
      toParentId: siteNodeIdSchema.optional(),
      toIndex: z.number().int().min(0).max(40).optional(),
    })
    .strict(),
  z
    .object({ op: z.literal("replace"), nodeId: siteNodeIdSchema, node: leafNodeSchema })
    .strict(),
  z
    .object({
      op: z.literal("updateMetadata"),
      title: z.string().trim().min(1).max(120).optional(),
      slug: siteSlugSchema.optional(),
      description: z.string().trim().min(1).max(300).optional(),
    })
    .strict(),
]);
export type SitePatch = z.infer<typeof sitePatchSchema>;

export interface ReviseDraftInput {
  patches: SitePatch[];
  /** Optimistic concurrency: refuse when the stored checksum moved on. */
  expectedChecksum?: string;
}

type EditableDocument = {
  root: Array<{
    id: string;
    type: "section";
    props?: Record<string, unknown>;
    styles?: Record<string, unknown>;
    children: Array<{
      id: string;
      type: string;
      props: Record<string, unknown>;
      styles?: Record<string, unknown>;
    }>;
  }>;
  metadata: { title: string; slug: string; description: string };
  schemaVersion: 1;
  engine: "site-studio";
  engineVersion: 1;
};

function allIds(document: EditableDocument): Set<string> {
  const ids = new Set<string>();
  for (const section of document.root) {
    ids.add(section.id);
    for (const child of section.children) ids.add(child.id);
  }
  return ids;
}

function findSection(document: EditableDocument, id: string) {
  const index = document.root.findIndex((section) => section.id === id);
  if (index < 0) throw new Error(`Unknown section ${JSON.stringify(id)}`);
  return { section: document.root[index]!, index };
}

function findLeaf(document: EditableDocument, id: string) {
  for (const section of document.root) {
    const index = section.children.findIndex((child) => child.id === id);
    if (index >= 0) return { section, leaf: section.children[index]!, index };
  }
  throw new Error(`Unknown node ${JSON.stringify(id)}`);
}

function applyPatch(document: EditableDocument, patch: SitePatch): void {
  switch (patch.op) {
    case "setProp": {
      const { leaf } = findLeaf(document, patch.nodeId);
      if (!(patch.path in leaf.props))
        throw new Error(
          `Node ${patch.nodeId} has no prop ${JSON.stringify(patch.path)}; refusing to invent one`,
        );
      leaf.props[patch.path] = patch.value;
      return;
    }
    case "setStyle": {
      if (!siteStyleSchema.safeParse({ [patch.path]: patch.value }).success)
        throw new Error(`Unknown style token ${JSON.stringify(patch.path)}`);
      const leafHit = (() => {
        try {
          return findLeaf(document, patch.nodeId);
        } catch {
          return null;
        }
      })();
      const target = leafHit ? leafHit.leaf : findSection(document, patch.nodeId).section;
      target.styles = { ...target.styles, [patch.path]: patch.value };
      return;
    }
    case "insert": {
      if (allIds(document).has(patch.node.id))
        throw new Error(`Node id ${JSON.stringify(patch.node.id)} is already in use`);
      const { section } = findSection(document, patch.parentId);
      const index = patch.index ?? section.children.length;
      section.children.splice(Math.min(index, section.children.length), 0, {
        ...structuredClone(patch.node),
      });
      return;
    }
    case "remove": {
      const leafHit = (() => {
        try {
          return { kind: "leaf" as const, found: findLeaf(document, patch.nodeId) };
        } catch {
          return null;
        }
      })();
      if (leafHit) {
        leafHit.found.section.children.splice(leafHit.found.index, 1);
        return;
      }
      const { index } = findSection(document, patch.nodeId);
      document.root.splice(index, 1);
      return;
    }
    case "move": {
      const leafHit = (() => {
        try {
          return { kind: "leaf" as const, found: findLeaf(document, patch.nodeId) };
        } catch {
          return null;
        }
      })();
      if (leafHit) {
        const [detached] = leafHit.found.section.children.splice(leafHit.found.index, 1);
        const target = patch.toParentId
          ? findSection(document, patch.toParentId).section
          : leafHit.found.section;
        const index = patch.toIndex ?? target.children.length;
        target.children.splice(Math.min(index, target.children.length), 0, detached!);
        return;
      }
      if (patch.toParentId)
        throw new Error("Sections move within the page, not into other sections");
      const { index } = findSection(document, patch.nodeId);
      const [detached] = document.root.splice(index, 1);
      const toIndex = patch.toIndex ?? document.root.length;
      document.root.splice(Math.min(toIndex, document.root.length), 0, detached!);
      return;
    }
    case "replace": {
      if (patch.node.id !== patch.nodeId)
        throw new Error("Replacement keeps the original node id; ids are stable addresses");
      const leafHit = (() => {
        try {
          return { kind: "leaf" as const, found: findLeaf(document, patch.nodeId) };
        } catch {
          return null;
        }
      })();
      if (!leafHit) throw new Error("Sections are edited in place, not replaced wholesale");
      leafHit.found.section.children[leafHit.found.index] = { ...structuredClone(patch.node) };
      return;
    }
    case "updateMetadata": {
      if (patch.title !== undefined) document.metadata.title = patch.title;
      if (patch.description !== undefined) document.metadata.description = patch.description;
      if (patch.slug !== undefined) document.metadata.slug = patch.slug;
      return;
    }
  }
}

function validateRevised(document: EditableDocument): SiteDocument {
  const parsed = parseSiteDocument(document);
  for (const assetId of collectAssetIds(parsed)) assertCatalogAsset(assetId);
  const rawUrls = collectRawUrls(parsed);
  if (rawUrls.length > 0)
    throw new Error(
      `Revised copy invents links (${rawUrls.slice(0, 3).join(", ")}); CTA hrefs must be site-relative`,
    );
  return parsed;
}

export async function reviseSiteDraft(
  repo: SiteDraftRepository,
  id: string,
  input: ReviseDraftInput,
): Promise<SiteDraft> {
  const current = repo.get(id);
  if (!current) throw new DraftNotFoundError(id);
  if (input.expectedChecksum !== undefined && input.expectedChecksum !== current.checksum)
    throw new StaleDraftError();
  if (input.patches.length === 0) throw new Error("At least one patch is required");
  if (input.patches.length > 50) throw new Error("Revise in batches of at most 50 patches");
  const working = structuredClone(current.document) as unknown as EditableDocument;
  const previousSlug = working.metadata.slug;
  for (const patch of input.patches) applyPatch(working, patch);
  const slug = working.metadata.slug;
  siteSlugSchema.parse(slug);
  if (slug !== previousSlug && repo.list().some((draft) => draft.slug === slug && draft.id !== id))
    throw new SlugInUseError(slug);
  const document = validateRevised(working);
  const saved = repo.save({
    title: document.metadata.title,
    slug,
    document,
    source: current.source,
    brief: current.brief,
  });
  if (saved.id !== id) repo.remove(id);
  return repo.get(saved.id) ?? saved;
}
