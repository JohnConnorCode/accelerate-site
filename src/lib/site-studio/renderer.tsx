import type { SiteDocument } from "./document";
import { renderSection, type RenderAsset } from "./components";

/** Public renderer. Turns a validated document into React using only
 * registered components. Unknown content renders an honest fallback, never
 * crashes, and never executes stored code. No editor code may be imported
 * through this module. */
export function SitePageRenderer({
  document,
  assets = [],
}: {
  document: SiteDocument;
  assets?: readonly RenderAsset[];
}) {
  return <>{document.root.map((section) => renderSection(section, assets))}</>;
}
