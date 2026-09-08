import { INDUSTRY_VISUALS, FEATURED_INDUSTRY_SLUGS } from "@/content/industry-visuals";

/** V1 asset library. AI page generation and editors may only attach catalog
 * entries: approved photography with recorded alt text. Arbitrary external
 * image URLs are refused, so generated pages cannot hotlink unvetted or
 * invented sources. Supabase-backed uploads arrive with a later card. */

export interface SiteAsset {
  id: string;
  src: string;
  alt: string;
  vertical: string;
  kind: "hero" | "still";
}

function buildCatalog(): SiteAsset[] {
  const assets: SiteAsset[] = [];
  for (const slug of FEATURED_INDUSTRY_SLUGS) {
    const visual = INDUSTRY_VISUALS[slug];
    if (!visual) continue;
    assets.push({
      id: `${slug}/hero`,
      src: visual.hero.src,
      alt: visual.hero.alt,
      vertical: slug,
      kind: "hero",
    });
    visual.stills.forEach((still, index) => {
      assets.push({
        id: `${slug}/still-${index + 1}`,
        src: still.src,
        alt: still.alt,
        vertical: slug,
        kind: "still",
      });
    });
  }
  return assets;
}

export const SITE_ASSET_CATALOG: SiteAsset[] = buildCatalog();

const byId = new Map(SITE_ASSET_CATALOG.map((asset) => [asset.id, asset]));

export function resolveSiteAsset(assetId: string): SiteAsset | null {
  return byId.get(assetId) ?? null;
}

/** Parse helper for tests and generation prompts. */
export function describeCatalogForPrompt(): string {
  return SITE_ASSET_CATALOG.map(
    (asset) => `- ${asset.id}: ${asset.alt} (${asset.kind}, ${asset.vertical})`,
  ).join("\n");
}

export function assertCatalogAsset(assetId: string): SiteAsset {
  const asset = resolveSiteAsset(assetId);
  if (!asset) throw new Error(`Unknown site asset ${JSON.stringify(assetId)}; use a catalog id`);
  return asset;
}
