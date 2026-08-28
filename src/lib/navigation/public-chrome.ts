/**
 * Public marketing chrome belongs on every public page. Only the authenticated
 * admin and an entered full-admin demo workspace replace it with application
 * chrome. The demo launcher is a public selection page, not an admin route.
 */
export function isApplicationWorkspace(pathname: string) {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/admin" || path.startsWith("/admin/")) return true;
  return /^\/demo\/command-center\/[^/]+(?:\/|$)/.test(path);
}
