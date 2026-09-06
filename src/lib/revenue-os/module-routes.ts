import { REVENUE_OS_MODULES, type RevenueOSModule } from "./modules";

/**
 * Longest-prefix match of an admin pathname against every module's declared
 * routes[]. A module's declared route "/admin/clients" owns both that exact
 * path and every path under it, such as "/admin/clients/[id]", without the
 * module needing to enumerate dynamic children.
 *
 * Returns null for a path no module claims — the redirects, the auth pages,
 * and any admin page whose module registration is missing. Those pages are
 * never gated by this resolver; that is the fail-open case
 * scripts/verify-module-contract.mjs guards against by requiring every real
 * page.tsx under src/app/admin to be claimed by some module's routes[].
 */
export function resolveModuleForAdminPath(pathname: string): RevenueOSModule | null {
  let best: RevenueOSModule | null = null;
  let bestLength = -1;
  for (const mod of REVENUE_OS_MODULES) {
    for (const route of mod.routes ?? []) {
      const matches = pathname === route || pathname.startsWith(`${route}/`);
      if (matches && route.length > bestLength) {
        best = mod;
        bestLength = route.length;
      }
    }
  }
  return best;
}
