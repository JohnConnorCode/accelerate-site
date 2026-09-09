import "server-only";
import { readBoundedJson } from "@/lib/ai/bounded-json";
import {
  SITE_STUDIO_MODELS,
  SITE_MODELS_OBSERVED_AT,
  parseSiteModelCatalog,
  modelPriceCeiling,
  enforceSitePriceCeiling,
  SiteModelSelectionError,
  type SiteStudioModel,
  type SitePriceCeiling,
} from "./models";

export type SiteModelCatalog = {
  models: SiteStudioModel[];
  observedAt: string;
  source: "live" | "cached" | "bundled";
};
let current: SiteModelCatalog | null = null;
let pending: Promise<SiteModelCatalog> | null = null;
let attemptedAt = 0;
const fallback = (): SiteModelCatalog =>
  current
    ? { ...current, source: "cached" }
    : { models: SITE_STUDIO_MODELS, observedAt: SITE_MODELS_OBSERVED_AT, source: "bundled" };
/** Public metadata only: five-minute cache, deduplicated refresh, bounded response
 * and timeout. No tenant, credential, prompt or generated content is cached. */
export async function getSiteModelCatalog(refresh = false): Promise<SiteModelCatalog> {
  const now = Date.now();
  if (pending) return pending;
  if (
    current &&
    now - Date.parse(current.observedAt) < 300_000 &&
    (!refresh || now - attemptedAt < 30_000)
  )
    return current;
  if (now - attemptedAt < 30_000) return fallback();
  attemptedAt = now;
  pending = (async () => {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        signal: AbortSignal.timeout(5000),
        redirect: "error",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Catalogue unavailable");
      const models = parseSiteModelCatalog(await readBoundedJson(response, 4 * 1024 * 1024));
      current = { models, observedAt: new Date(Date.now()).toISOString(), source: "live" };
      return current;
    } catch {
      return fallback();
    }
  })();
  try {
    return await pending;
  } finally {
    pending = null;
  }
}
/** The gateway can grant this non-consequential job only catalogue entries
 * already validated by the page adapter, or the bundled offline snapshot. */
export function cachedSiteModel(id: string): SiteStudioModel | undefined {
  return (current?.models ?? SITE_STUDIO_MODELS).find((model) => model.id === id);
}
export async function resolveSiteModel(id: string, ceiling?: SitePriceCeiling) {
  const catalog = await getSiteModelCatalog();
  const model = catalog.models.find((model) => model.id === id);
  if (!model)
    throw new SiteModelSelectionError(
      "This model is unavailable or incompatible. Refresh models and choose another model.",
    );
  const bundled = SITE_STUDIO_MODELS.find((model) => model.id === id);
  if (!ceiling && !bundled)
    throw new SiteModelSelectionError(
      "Select this model from the refreshed list to review its price first.",
    );
  const strictPricing = enforceSitePriceCeiling(model, ceiling ?? modelPriceCeiling(bundled!));
  return {
    model: model.id,
    strictPricing,
    temperature: model.supportsTemperature ? 0.3 : null,
    ...(model.reasoningEffort
      ? { reasoning: { effort: model.reasoningEffort, exclude: true } }
      : {}),
  };
}
