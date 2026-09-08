import "server-only";
import { servicePageSlug, servicePageTemplate } from "./templates";
import { assertCatalogAsset } from "./assets";
import {
  parseSiteDocument,
  assertDocumentSize,
  siteSlugSchema,
  type SiteDocument,
  type SiteDraft,
} from "./document";
import { buildPageUserPrompt, type PageBrief } from "./generate";
import type { SiteDraftRepository } from "./store";

/** Draft creation owns the business rules; route handlers only authenticate,
 * validate the transport envelope, rate-limit, and map results to HTTP. */

export interface CreateDraftInput {
  title?: string;
  slug?: string;
  brief: PageBrief;
  mode: "template" | "ai";
  assetIds?: string[];
}

/** Produces the base document for AI mode. Injected so tests never touch a
 * provider; production passes the OpenRouter adapter. */
export type DraftGenerator = (brief: PageBrief) => Promise<SiteDocument>;

/** Gallery bound shared by the domain and the transport schema so direct
 * callers get the same limit as HTTP. */
export const MAX_ATTACHED_ASSETS = 8;

export class SlugInUseError extends Error {
  readonly slug: string;
  constructor(slug: string) {
    super(`A draft already uses the slug ${slug}; choose another slug`);
    this.name = "SlugInUseError";
    this.slug = slug;
  }
}

export class DraftNotFoundError extends Error {
  constructor(id: string) {
    super(`Draft ${id} does not exist`);
    this.name = "DraftNotFoundError";
  }
}

function appendGallery(document: SiteDocument, assetIds: string[]): SiteDocument {
  if (assetIds.length === 0) return document;
  if (assetIds.length > MAX_ATTACHED_ASSETS)
    throw new Error(
      `Attach at most ${MAX_ATTACHED_ASSETS} images to one draft; ${assetIds.length} were supplied`,
    );
  for (const assetId of assetIds) assertCatalogAsset(assetId);
  return parseSiteDocument({
    ...document,
    root: [
      ...document.root,
      {
        id: "attached-images",
        type: "section",
        styles: { paddingTop: "md", paddingBottom: "md" },
        children: assetIds.map((assetId, index) => ({
          id: `attached-image-${index + 1}`,
          type: "image",
          props: { assetId },
        })),
      },
    ],
  });
}

export async function createSiteDraft(
  repo: SiteDraftRepository,
  input: CreateDraftInput,
  generate: DraftGenerator,
): Promise<SiteDraft> {
  const slug = input.slug ?? servicePageSlug(input.brief.serviceName);
  siteSlugSchema.parse(slug);
  if (repo.list().some((draft) => draft.slug === slug)) throw new SlugInUseError(slug);
  // Validate before touching the payload: generator output is untrusted and
  // must fail as a named validation error, never a TypeError mid-spread.
  const base = parseSiteDocument(
    input.mode === "ai" ? await generate(input.brief) : servicePageTemplate(input.brief),
  );
  const document = appendGallery(
    {
      ...base,
      metadata: {
        ...base.metadata,
        title: input.title ?? base.metadata.title,
        slug,
      },
    },
    input.assetIds ?? [],
  );
  assertDocumentSize(document);
  return repo.save({
    title: document.metadata.title,
    slug,
    document,
    source: input.mode,
    brief: buildPageUserPrompt(input.brief),
  });
}

export interface DiscardedDraft {
  id: string;
  slug: string;
  title: string;
}

/** Explicit, confirmed removal. Drafts are private working copies, so
 * discard touches no published output; the returned summary is the
 * receipt the caller surfaces. Double discard fails honestly. */
export async function discardSiteDraft(
  repo: SiteDraftRepository,
  id: string,
): Promise<DiscardedDraft> {
  const current = repo.get(id);
  if (!current) throw new DraftNotFoundError(id);
  if (!repo.remove(id)) throw new DraftNotFoundError(id);
  return { id: current.id, slug: current.slug, title: current.title };
}
