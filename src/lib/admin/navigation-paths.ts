import type { DemoScenarioId } from "./demo/scenarios";

/** URL adapters shared by admin links and the mounted shell. Next.js owns routing. */
export function resolveAdminPathname(
  pathname: string,
  scenarioId: DemoScenarioId | null,
  demoRoute: string | null,
) {
  const workspacePath = pathname.match(/^\/t\/[^/]+\/admin(?:\/(.*))?$/);
  if (workspacePath) return `/admin/${workspacePath[1] || "today"}`;
  if (!scenarioId) return pathname;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return pathname;
  const publicPrefix = `/demo/command-center/${scenarioId}`;
  if (pathname === publicPrefix) return "/admin/today";
  if (pathname.startsWith(`${publicPrefix}/`))
    return `/admin/${pathname.slice(publicPrefix.length + 1) || "today"}`;
  return `/admin/${demoRoute || "today"}`;
}

export function resolveAdminHref(
  href: string,
  scenarioId: string | null,
  workspaceSlug?: string | null,
) {
  if (!href.startsWith("/admin")) return href;
  const suffix = href.replace(/^\/admin\/?/, "");
  if (scenarioId) return `/demo/command-center/${scenarioId}/${suffix || "today"}`;
  if (workspaceSlug) return `/t/${workspaceSlug}/admin/${suffix || "today"}`;
  return href;
}
