import { adminNavSections, resolveAdminNavLink } from "./navigation";

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

  const section = adminNavSections.find((candidate) =>
    candidate.links.some((link) => link.id === active.id),
  );

  if (pathname.startsWith("/admin/contacts/") && pathname !== "/admin/contacts") {
    return [
      {
        label: section?.label === "More tools" ? "Customers" : (section?.label ?? "Customers"),
        href: "/admin/contacts",
      },
      { label: active.label, href: "/admin/contacts" },
      { label: "Timeline", href: pathname },
    ];
  }

  // Top-level pages already identify their home in the page header. Adding a
  // second crumb that points to the same URL creates a redundant title in the
  // shell; reserve the section crumb for nested record views.
  if (pathname === active.href) return [{ label: active.label, href: active.href }];
  return section
    ? [
        { label: section.label, href: section.links[0]?.href ?? active.href },
        { label: active.label, href: active.href },
      ]
    : [{ label: active.label, href: active.href }];
}
