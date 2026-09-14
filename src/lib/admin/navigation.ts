import {
  Activity,
  Palette,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  CalendarCheck,
  CircleDollarSign,
  FileText,
  FileCheck,
  Globe2,
  Handshake,
  Inbox,
  KanbanSquare,
  LayoutDashboard,
  ListChecks,
  Library,
  Mail,
  MailCheck,
  MessageSquareText,
  MessageCircleMore,
  PlugZap,
  RotateCcw,
  Settings,
  Target,
  UserRound,
  UserPlus,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { applyLayoutOverride, type LayoutDoc } from "@/lib/admin/layout-overrides";
import { isNavLinkEnabled } from "@/lib/revenue-os/modules";
import { EXTENSION_NAV_LINKS } from "@/lib/revenue-os/extension-modules.generated";
import { resolveExtensionNavIcon } from "@/lib/admin/extension-nav-icons";

export interface AdminNavLink {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  keywords?: string;
  mobilePrimary?: boolean;
  moreGroup?: "Revenue" | "Delivery" | "Intelligence" | "System" | "Sources";
}

export interface AdminNavSection {
  label: string;
  links: AdminNavLink[];
}

export const adminNavSections: AdminNavSection[] = [
  {
    label: "Command",
    links: [
      {
        id: "today",
        label: "Today",
        href: "/admin/today",
        icon: LayoutDashboard,
        description: "What needs your attention now",
        mobilePrimary: true,
      },
      {
        id: "work",
        label: "Tasks",
        href: "/admin/work",
        icon: ListChecks,
        description: "Work with an owner, due date, or completion state",
        keywords: "tasks approvals my work team",
      },
    ],
  },
  {
    label: "Sales",
    links: [
      {
        id: "leads",
        label: "Leads",
        href: "/admin/leads",
        icon: UserRound,
        description: "Prospective customers from every source",
        keywords: "inquiries forms chat imports",
      },
      {
        id: "pipeline",
        label: "Pipeline",
        href: "/admin/pipeline",
        icon: Target,
        description: "Active opportunities and deal movement",
        mobilePrimary: true,
      },
      {
        id: "proposals",
        label: "Proposals",
        href: "/admin/proposals",
        icon: FileCheck,
        description: "Draft, send, and track customer proposals",
      },
      {
        id: "follow-ups",
        label: "Follow-ups",
        href: "/admin/follow-ups",
        icon: RotateCcw,
        description: "Due and upcoming customer follow-up",
        keywords: "recovery reminders stale leads no shows",
      },
    ],
  },
  {
    label: "Customers",
    links: [
      {
        id: "conversations",
        label: "Conversations",
        href: "/admin/conversations",
        icon: MessageSquareText,
        description: "Customer communication and history",
        mobilePrimary: true,
      },
      {
        id: "clients",
        label: "Clients",
        href: "/admin/clients",
        icon: BriefcaseBusiness,
        description: "Customer records and relationships",
      },
      {
        id: "bookings",
        label: "Appointments",
        href: "/admin/bookings",
        icon: CalendarCheck,
        description: "Bookings, meetings, inspections, and calls",
      },
    ],
  },
  {
    label: "Marketing",
    links: [
      {
        id: "campaigns",
        label: "Campaigns",
        href: "/admin/campaigns",
        icon: Mail,
        description: "Campaigns, automations, templates, and audiences",
      },
      {
        id: "content",
        label: "Content",
        href: "/admin/content",
        icon: FileText,
        description: "Content calendar and reusable assets",
      },
      {
        id: "website-grades",
        label: "Website",
        href: "/admin/website-grades",
        icon: Globe2,
        description: "Review site health and improvement opportunities",
        keywords: "website site content publish",
      },
    ],
  },
  {
    label: "Money",
    links: [
      {
        id: "money",
        label: "Money",
        href: "/admin/money",
        icon: CircleDollarSign,
        description: "Invoices, payments, collections, and recurring billing",
      },
      {
        id: "revenue",
        label: "Revenue",
        href: "/admin/revenue",
        icon: BriefcaseBusiness,
        description: "Performance and revenue reporting",
      },
    ],
  },
  {
    label: "Intelligence",
    links: [
      {
        id: "analytics",
        label: "Analytics",
        href: "/admin/analytics",
        icon: BarChart3,
        description: "Business-wide performance",
      },
      {
        id: "opportunity-radar",
        label: "Opportunity Radar",
        href: "/admin/radar/today",
        icon: Target,
        description: "Signals and opportunities worth reviewing",
        keywords: "signals risks research",
      },
      {
        id: "ai",
        label: "Ask Accelerate",
        href: "/admin/ai",
        icon: Bot,
        description: "Ask questions across your company context",
        mobilePrimary: true,
        keywords: "ai assistant copilot chat runs capabilities",
      },
    ],
  },
  {
    label: "System",
    links: [
      {
        id: "integrations",
        label: "Integrations",
        href: "/admin/integrations",
        icon: PlugZap,
        description: "Connected tools and what they unlock",
      },
      {
        id: "branding",
        label: "Business & Brand",
        href: "/admin/branding",
        icon: Palette,
        description: "Company identity, offers, and customer-facing defaults",
      },
      {
        id: "settings",
        label: "Settings",
        href: "/admin/settings",
        icon: Settings,
        description: "Users, permissions, notifications, and advanced controls",
      },
    ],
  },
  {
    label: "More tools",
    links: [
      {
        id: "inbox",
        label: "Inbox",
        href: "/admin/inbox",
        icon: Inbox,
        description: "Legacy mixed-source triage view",
        keywords: "triage",
      },
      {
        id: "contacts",
        label: "Contact intake",
        href: "/admin/contacts",
        icon: UsersRound,
        description: "Website submissions and reviewed list imports",
        keywords: "contacts submissions csv json paste ai dedupe import",
      },
      {
        id: "identity-review",
        label: "Identity review",
        href: "/admin/identity-review",
        icon: UserPlus,
        description: "Ambiguous senders waiting for a decision",
        keywords: "identity review ambiguous unknown link contact",
      },
      {
        id: "emails",
        label: "Email Studio",
        href: "/admin/emails",
        icon: MessageSquareText,
        description: "Edit and inspect live email copy",
        keywords: "templates preview editor",
      },
      {
        id: "delivery-runs",
        label: "Email Sequences",
        href: "/admin/email-sequences",
        icon: MailCheck,
        description: "Sequence delivery status",
        keywords: "delivery runs sends",
      },
      {
        id: "resources",
        label: "Resources",
        href: "/admin/resources",
        icon: Library,
        description: "Downloadable resources",
      },
      {
        id: "activity",
        label: "Activity",
        href: "/admin/activity",
        icon: Activity,
        description: "History for material changes",
      },
      {
        id: "setup",
        label: "Setup Center",
        href: "/admin/setup",
        icon: ListChecks,
        description: "Connections and readiness",
      },
      {
        id: "features",
        label: "Feature Board",
        href: "/admin/features",
        icon: KanbanSquare,
        description: "Managed delivery backlog",
      },
      {
        id: "tenants",
        label: "Tenants",
        href: "/admin/tenants",
        icon: UsersRound,
        description: "Workspace provisioning and access",
      },
      {
        id: "chat-leads",
        label: "Chat inquiries",
        href: "/admin/chat-leads",
        icon: MessageCircleMore,
        description: "Website chat submissions",
      },
      {
        id: "subscribers",
        label: "Subscribers",
        href: "/admin/subscribers",
        icon: UserPlus,
        description: "Resource and email subscribers",
      },
      {
        id: "partners",
        label: "Partners",
        href: "/admin/partners",
        icon: Handshake,
        description: "Partner applications",
      },
      {
        id: "recovery",
        label: "Recovery tools",
        href: "/admin/recovery",
        icon: RotateCcw,
        description: "Legacy recovery playbooks",
        keywords: "follow ups",
      },
    ],
  },
];

/**
 * Merge validated extension nav links into the section their manifest names.
 *
 * Manifests keep their stable, older group vocabulary. The operator rail uses
 * business language, so this small adapter maps extension entries into the new
 * parent area without making every extension edit its manifest at once.
 * Module enablement still gates visibility downstream through
 * filterNavSectionsByTenant, exactly as it does for core links.
 */
for (const link of EXTENSION_NAV_LINKS) {
  const targetLabel =
    link.id === "opportunity-radar"
      ? "Intelligence"
      : link.id === "receivables-collections" || link.id === "stripe-invoicing"
        ? "Money"
        : "More tools";
  const target = adminNavSections.find((section) => section.label === targetLabel);
  if (!target) continue;
  if (adminNavSections.some((section) => section.links.some((item) => item.id === link.id)))
    continue;
  target.links.push({
    id: link.id,
    label: link.label,
    href: link.href,
    icon: resolveExtensionNavIcon(link.icon),
    description: link.description,
    ...(link.keywords ? { keywords: link.keywords } : {}),
    ...(link.moreGroup ? { moreGroup: link.moreGroup } : {}),
  });
}

export const adminNavLinks = adminNavSections.flatMap((section) => section.links);
export const adminMobileLinks = adminNavLinks.filter((link) => link.mobilePrimary);
export const adminMoreSections = adminNavSections.filter((section) => section.label !== "Command");

/** Section membership is fixed; a layout override may only reorder sections
    (by the first surviving link's new position) and links within them, and
    hide/reveal links — never move a link to a different section. */
export function applyNavLayoutOverride(
  sections: AdminNavSection[],
  doc: LayoutDoc | null | undefined,
  requiredIds: string[] = ["settings"],
): AdminNavSection[] {
  if (!doc) return sections;

  const flatLinks = sections.flatMap((section) => section.links);
  const orderedLinks = applyLayoutOverride(flatLinks, requiredIds, doc);
  const orderIndex = new Map(orderedLinks.map((link, index) => [link.id, index]));

  return sections
    .map((section) => ({
      ...section,
      links: section.links
        .filter((link) => orderIndex.has(link.id))
        .sort((a, b) => orderIndex.get(a.id)! - orderIndex.get(b.id)!),
    }))
    .filter((section) => section.links.length > 0)
    .sort((a, b) => {
      const aIndex = orderIndex.get(a.links[0]!.id) ?? Number.MAX_SAFE_INTEGER;
      const bIndex = orderIndex.get(b.links[0]!.id) ?? Number.MAX_SAFE_INTEGER;
      return aIndex - bIndex;
    });
}

/**
 * Filters navigation sections by module enablement in the active tenant configuration.
 */
export function filterNavSectionsByTenant(
  sections: AdminNavSection[],
  tenantConfig?: { modules?: Partial<Record<string, boolean>> } | null,
): AdminNavSection[] {
  return sections
    .map((section) => ({
      ...section,
      links: section.links.filter((link) => isNavLinkEnabled(link.id, tenantConfig)),
    }))
    .filter((section) => section.links.length > 0);
}

export function resolveAdminNavLink(pathname: string) {
  return [...adminNavLinks]
    .sort((left, right) => right.href.length - left.href.length)
    .find((link) => pathname === link.href || pathname.startsWith(`${link.href}/`));
}
