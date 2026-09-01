import { adminNavLinks } from "@/lib/admin/navigation";

/** The closed set of ids each admin layout scope may reorder or hide, plus
    which of those ids may never be hidden. Client- and server-safe — no
    database access here, just the registry both the UI and the domain
    service (`revenue-os/admin-layout.ts`) read from. */
export interface AdminLayoutRegionDef {
  id: string;
  label: string;
}

export interface AdminLayoutScopeDef {
  id: string;
  label: string;
  regions: AdminLayoutRegionDef[];
  requiredIds: string[];
}

export const TODAY_LAYOUT_REGIONS: AdminLayoutRegionDef[] = [
  { id: "operating-summary", label: "Operating summary" },
  { id: "operational-ledger", label: "Connection & job health" },
  { id: "revenue-copilot", label: "Revenue AI Command" },
];

export const ADMIN_LAYOUT_SCOPES: AdminLayoutScopeDef[] = [
  {
    id: "nav.sidebar",
    label: "Sidebar navigation",
    regions: adminNavLinks.map((link) => ({ id: link.id, label: link.label })),
    requiredIds: ["settings"],
  },
  {
    id: "page.today",
    label: "Today page",
    regions: TODAY_LAYOUT_REGIONS,
    // The empty-approvals state anchors to #revenue-copilot; hiding the
    // panel would leave that link dangling, not just remove a widget.
    requiredIds: ["revenue-copilot"],
  },
];

export function getLayoutScope(scope: string): AdminLayoutScopeDef | undefined {
  return ADMIN_LAYOUT_SCOPES.find((candidate) => candidate.id === scope);
}
