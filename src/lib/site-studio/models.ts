import snapshot from "./model-catalog.snapshot.json";
import type { SiteStudioModel } from "./model-catalog-data";
export * from "./model-catalog-data";
/** Offline/demo fallback. Connected installations refresh the public catalogue;
 * this snapshot never silently replaces an explicitly selected model. */
export const SITE_STUDIO_MODELS = snapshot.models as SiteStudioModel[];
export const SITE_MODELS_OBSERVED_AT = snapshot.observedAt;
export function siteModel(id: string): SiteStudioModel {
  const model = SITE_STUDIO_MODELS.find((model) => model.id === id);
  if (!model) throw new Error("Choose a supported Site Studio model.");
  return model;
}
