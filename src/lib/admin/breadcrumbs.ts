import { resolveAdminNavLink } from "./navigation";

export interface AdminBreadcrumb {
  label: string;
  href: string;
}

/**
 * Breadcrumbs reflect the navigation registry, never the page a user happened
 * to visit before this one. That makes direct loads, browser history, live
 * admin, and fictional demo routes tell the same truthful story.
 */
export function getAdminBreadcrumbs(pathname: string): AdminBreadcrumb[] {
  const active = resolveAdminNavLink(pathname);
  if (!active) return [];

  if (pathname.startsWith("/admin/contacts/") && pathname !== "/admin/contacts") {
    return [
      { label: "Contacts", href: "/admin/contacts" },
      { label: "Timeline", href: pathname },
    ];
  }

  return [{ label: active.label, href: active.href }];
}
