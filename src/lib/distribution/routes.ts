/** Bundled agency URLs are retained in source, but never used as neutral
 * fallbacks. Owner publications can still claim these ordinary page paths. */
export const AGENCY_ROUTE_ROOTS = [
  "about",
  "blog",
  "changelog",
  "contact",
  "industries",
  "learn",
  "legacy-home",
  "open-source",
  "packages",
  "partners",
  "privacy",
  "resources",
  "results",
  "roofing",
  "services",
  "style-guide",
  "team",
  "terms",
  "work",
] as const;

export function isAgencyPage(path: string) {
  path = distributionPath(path);
  return AGENCY_ROUTE_ROOTS.some((root) => path === `/${root}` || path.startsWith(`/${root}/`));
}

/** These namespaces contain the bundled protected media. New businesses use
 * /site-assets/ or their own HTTPS asset origins, not the agency namespaces. */
export function isAgencyAsset(path: string) {
  path = distributionPath(path);
  return path === "/logo.png" || /^\/(?:images|work|resources)\/.+\.[a-z0-9]+$/i.test(path);
}

export function distributionPath(path: string): string {
  try {
    return decodeURIComponent(path).replace(/\\/g, "/");
  } catch {
    return path;
  }
}
