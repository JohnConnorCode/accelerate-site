import {
  Activity,
  Palette,
  BarChart3,
  Bot,
  Brain,
  BriefcaseBusiness,
  CalendarCheck,
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
  Layers,
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
  title?: string;
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
        description:
          "See urgent priorities, upcoming commitments, and the next steps that need your attention.",
        mobilePrimary: true,
      },
      {
        id: "work",
        label: "Tasks & approvals",
        href: "/admin/work",
        icon: ListChecks,
        description: "Track assigned tasks and review actions waiting for your approval.",
        keywords: "tasks approvals commitments team assigned work",
      },
      {
        id: "pipeline",
        label: "Pipeline",
        href: "/admin/pipeline",
        icon: Target,
        description: "See where each opportunity stands and decide how to move it forward.",
        mobilePrimary: true,
      },
      {
        id: "conversations",
        label: "Conversations",
        href: "/admin/conversations",
        icon: MessageSquareText,
        description:
          "Read customer messages, review the conversation history, and prepare your next reply.",
        mobilePrimary: true,
      },
      {
        id: "inbox",
        label: "Review queue",
        href: "/admin/inbox",
        icon: Inbox,
        description: "Review incoming items and follow-ups that need a decision.",
        mobilePrimary: true,
      },
      {
        id: "identity-review",
        label: "Contact review",
        href: "/admin/identity-review",
        icon: UserPlus,
        description:
          "Match unfamiliar senders to the right contact so their messages appear with the right history.",
        keywords: "identity review ambiguous unknown link contact",
      },
    ],
  },
  {
    label: "Revenue",
    links: [
      {
        id: "contacts",
        label: "Contact intake",
        href: "/admin/contacts",
        icon: UsersRound,
        description:
          "Review website submissions and import contact lists for your team to follow up.",
        keywords: "contacts submissions csv json paste ai dedupe import",
        moreGroup: "Revenue",
      },
      {
        id: "emails",
        label: "Email Templates",
        href: "/admin/emails",
        icon: MessageSquareText,
        description: "Edit reusable email copy and review messages your business has sent.",
        keywords: "templates preview editor",
        moreGroup: "Revenue",
      },
      {
        id: "campaigns",
        label: "Campaigns",
        href: "/admin/campaigns",
        icon: Mail,
        description: "Prepare outreach campaigns, review recipients, and track their progress.",
        moreGroup: "Revenue",
      },
      {
        id: "recovery",
        label: "Revenue Recovery",
        href: "/admin/recovery",
        icon: RotateCcw,
        description:
          "Reconnect with past enquiries and customers who may be ready for a follow-up.",
        keywords: "reactivation stale leads no shows estimates recovery",
        moreGroup: "Revenue",
      },
      {
        id: "proposals",
        label: "Proposals",
        href: "/admin/proposals",
        icon: FileCheck,
        description: "Prepare customer proposals and follow their progress from draft to decision.",
        moreGroup: "Revenue",
      },
      {
        id: "delivery-runs",
        label: "Email Sequences",
        href: "/admin/email-sequences",
        icon: MailCheck,
        description:
          "Check scheduled follow-ups, delivered messages, and the next email in each sequence.",
        keywords: "email sequences sends delivery runs nurture enrollment follow up",
        moreGroup: "Revenue",
      },
      {
        id: "revenue",
        label: "Revenue",
        href: "/admin/revenue",
        icon: BriefcaseBusiness,
        description:
          "Review revenue and customer value to understand where your business is growing.",
        moreGroup: "Revenue",
      },
    ],
  },
  {
    label: "Delivery",
    links: [
      {
        id: "clients",
        label: "Clients",
        href: "/admin/clients",
        icon: BriefcaseBusiness,
        description: "Keep customer details, delivery progress, and related work together.",
        moreGroup: "Delivery",
      },
      {
        id: "bookings",
        label: "Bookings",
        href: "/admin/bookings",
        icon: CalendarCheck,
        description: "Review meeting requests, scheduled appointments, and booking details.",
        moreGroup: "Delivery",
      },
      {
        id: "content",
        label: "Content Calendar",
        href: "/admin/content",
        icon: FileText,
        description: "Plan content, track its progress, and keep upcoming publishing work visible.",
        moreGroup: "Delivery",
      },
      {
        id: "resources",
        label: "Resource Downloads",
        href: "/admin/resources",
        icon: Library,
        description: "Manage downloadable resources and review how people access them.",
        moreGroup: "Delivery",
      },
    ],
  },
  {
    label: "Intelligence",
    links: [
      {
        id: "ai",
        label: "AI Workspace",
        href: "/admin/ai",
        icon: Bot,
        description:
          "Ask about your business, review AI activity, and understand the tools available to it.",
        keywords: "assistant copilot command chat operations traces capabilities",
        moreGroup: "Intelligence",
      },
      {
        id: "architect",
        label: "Architect",
        href: "/admin/ai?purpose=architect",
        icon: MessageSquareText,
        description:
          "Teach the workspace how the business works through a durable chat session, attachments and scoped sources.",
        keywords: "workspace architect setup blueprint attachments sources",
        moreGroup: "Intelligence",
      },
      {
        id: "blueprints",
        label: "Blueprints",
        href: "/admin/blueprints",
        icon: Layers,
        description:
          "Review versioned workspace contracts before anything is applied to schema or settings.",
        keywords: "blueprint architect version diff validation contract",
        moreGroup: "Intelligence",
      },
      {
        id: "analytics",
        label: "Analytics",
        href: "/admin/analytics",
        icon: BarChart3,
        description:
          "Understand which sources bring enquiries and how those enquiries become customers.",
        moreGroup: "Intelligence",
      },
      {
        id: "activity",
        label: "Activity",
        href: "/admin/activity",
        icon: Activity,
        description: "Review recorded changes and action results across your business.",
        moreGroup: "Intelligence",
      },
    ],
  },
  {
    label: "System",
    links: [
      {
        id: "tenants",
        label: "Workspaces",
        href: "/admin/tenants",
        icon: UsersRound,
        description: "Manage business workspaces and the people who can access them.",
        moreGroup: "System",
      },
      {
        id: "integrations",
        label: "Integrations",
        href: "/admin/integrations",
        icon: PlugZap,
        description:
          "Manage connected services and the business tools available in your workspace.",
        moreGroup: "System",
      },
      {
        id: "setup",
        label: "Setup",
        href: "/admin/setup",
        icon: ListChecks,
        description: "Connect your services and check what is ready or still needs attention.",
        moreGroup: "System",
      },
      {
        id: "features",
        label: "Feature Board",
        href: "/admin/features",
        icon: KanbanSquare,
        description:
          "Plan product improvements, follow implementation progress, and review completed work.",
        moreGroup: "System",
      },
      {
        id: "branding",
        label: "Branding",
        href: "/admin/branding",
        icon: Palette,
        description: "Set the logo, colors, and business identity used in customer documents.",
        moreGroup: "System",
      },
      {
        id: "settings",
        label: "Settings",
        href: "/admin/settings",
        icon: Settings,
        description: "Adjust workspace preferences and how your team uses Command Center.",
        moreGroup: "System",
      },
      {
        id: "learning",
        label: "Learning Inbox",
        href: "/admin/learning",
        icon: Brain,
        description: "Review reusable corrections and approve shared intelligence for future work.",
        moreGroup: "System",
      },
    ],
  },
  {
    label: "More tools",
    links: [
      {
        id: "leads",
        label: "Leads",
        href: "/admin/leads",
        icon: UserRound,
        description:
          "Review enquiries, qualify potential customers, and decide who needs follow-up.",
        moreGroup: "Sources",
      },
      {
        id: "chat-leads",
        label: "Chat enquiries",
        href: "/admin/chat-leads",
        icon: MessageCircleMore,
        description: "Review enquiries submitted through your website chat.",
        moreGroup: "Sources",
      },
      {
        id: "subscribers",
        label: "Subscribers",
        href: "/admin/subscribers",
        icon: UserPlus,
        description: "Review people who subscribed to your emails or requested a resource.",
        moreGroup: "Sources",
      },
      {
        id: "partners",
        label: "Partner Applications",
        href: "/admin/partners",
        icon: Handshake,
        description: "Review partnership enquiries and decide who to follow up with.",
        moreGroup: "Sources",
      },
      {
        id: "website-grades",
        label: "Website Grades",
        href: "/admin/website-grades",
        icon: Globe2,
        description: "Review website assessment submissions and their results.",
        moreGroup: "Sources",
      },
    ],
  },
];

/**
 * Merge validated extension nav links into the section their manifest names.
 *
 * An extension declares a moreGroup; that is the section it joins. Anything
 * without a recognized group lands in "More tools" rather than being dropped
 * silently, so a manifest can never register a link the operator cannot find.
 * Module enablement still gates visibility downstream through
 * filterNavSectionsByTenant, exactly as it does for core links.
 */
for (const link of EXTENSION_NAV_LINKS) {
  const target =
    adminNavSections.find((section) => section.label === link.moreGroup) ??
    adminNavSections.find((section) => section.label === "More tools");
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

// Stable section keys preserve saved expansion state and extension group contracts.
// Display names explain the operator task rather than implementation terminology.
const sectionTitles: Record<string, string> = {
  Command: "Daily work",
  Revenue: "Sales",
  Delivery: "Client work",
  Intelligence: "Insights & AI",
  System: "Administration",
  "More tools": "Other tools",
};
const marketingIds = new Set([
  "social-marketing",
  "emails",
  "campaigns",
  "delivery-runs",
  "content",
  "resources",
  "subscribers",
]);
const marketingLinks = adminNavSections
  .flatMap((section) => section.links)
  .filter((link) => marketingIds.has(link.id));
for (const section of adminNavSections) {
  section.title = sectionTitles[section.label] ?? section.label;
  section.links = section.links.filter((link) => !marketingIds.has(link.id));
}
adminNavSections.splice(2, 0, { label: "Marketing", title: "Marketing", links: marketingLinks });
// Unknown extension groups remain discoverable under Other tools; they are not
// mislabeled as lead sources. The existing Sources manifest group is explicit.
const fallback = adminNavSections.find((section) => section.label === "More tools")!;
const sourceLinks = fallback.links.filter((link) => link.moreGroup === "Sources");
fallback.links = fallback.links.filter((link) => link.moreGroup !== "Sources");
adminNavSections.splice(adminNavSections.indexOf(fallback), 0, {
  label: "Sources",
  title: "Lead sources",
  links: sourceLinks,
});

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

/** Root page identity comes from the same registry as sidebar and search. */
export function adminPageName(id: string): string {
  const link = adminNavLinks.find((entry) => entry.id === id);
  if (!link) throw new Error(`Unknown admin destination: ${id}`);
  return link.label;
}
