import { existsSync } from "node:fs";
import { join } from "node:path";
/** A display-only retained-record route must be concrete and owned by this module. */
export function pluginHistoryFailures(root, manifest) {
  const route = manifest.historyRoute;
  if (route === undefined) return [];
  if (typeof route !== "string" || !/^\/admin\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(route))
    return ["History route must be an exact static admin path"];
  if (
    !Array.isArray(manifest.routes) ||
    !manifest.routes.some(
      (owner) => typeof owner === "string" && (route === owner || route.startsWith(`${owner}/`)),
    )
  )
    return ["History route must belong to the module declared routes"];
  if (!existsSync(join(root, "src/app", route, "page.tsx")))
    return ["History route must have a real shared admin page"];
  return [];
}
