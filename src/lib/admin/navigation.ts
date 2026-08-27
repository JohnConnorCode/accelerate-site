import {
  Activity,
  BarChart3,
  Bot,
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
  PlugZap,
  Settings,
  Target,
  UserRound,
  UserPlus,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

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
  { label: "Command", links: [
    { id: "today", label: "Today", href: "/admin/today", icon: LayoutDashboard, description: "What needs you now", mobilePrimary: true },
    { id: "pipeline", label: "Pipeline", href: "/admin/pipeline", icon: Target, description: "Opportunities and next actions", mobilePrimary: true },
    { id: "conversations", label: "Conversations", href: "/admin/conversations", icon: MessageSquareText, description: "Ongoing customer communication", mobilePrimary: true },
    { id: "inbox", label: "Inbox", href: "/admin/inbox", icon: Inbox, description: "New work requiring triage", mobilePrimary: true },
  ] },
  { label: "Revenue", links: [
    { id: "contacts", label: "Contact intake", href: "/admin/contacts", icon: UsersRound, description: "Website submissions and reviewed list imports", keywords: "contacts submissions csv json paste ai dedupe import", moreGroup: "Revenue" },
    { id: "emails", label: "Email Studio", href: "/admin/emails", icon: MessageSquareText, description: "View and edit live email copy", keywords: "templates preview editor", moreGroup: "Revenue" },
    { id: "campaigns", label: "Campaigns", href: "/admin/campaigns", icon: Mail, description: "Controlled outbound", moreGroup: "Revenue" },
    { id: "proposals", label: "Proposals", href: "/admin/proposals", icon: FileCheck, description: "Drafts, decisions, and follow-up", moreGroup: "Revenue" },
    { id: "delivery-runs", label: "Delivery Runs", href: "/admin/email-sequences", icon: MailCheck, description: "Sequence and delivery status", keywords: "email sequences sends", moreGroup: "Revenue" },
    { id: "revenue", label: "Revenue", href: "/admin/revenue", icon: BriefcaseBusiness, description: "Revenue and client value", moreGroup: "Revenue" },
  ] },
  { label: "Delivery", links: [
    { id: "clients", label: "Clients", href: "/admin/clients", icon: BriefcaseBusiness, description: "Client delivery records", moreGroup: "Delivery" },
    { id: "bookings", label: "Bookings", href: "/admin/bookings", icon: CalendarCheck, description: "Meeting and booking records", moreGroup: "Delivery" },
    { id: "content", label: "Content", href: "/admin/content", icon: FileText, description: "Content operations", moreGroup: "Delivery" },
    { id: "resources", label: "Resources", href: "/admin/resources", icon: Library, description: "Downloadable resources", moreGroup: "Delivery" },
  ] },
  { label: "Intelligence", links: [
    { id: "ai", label: "AI Workspace", href: "/admin/ai", icon: Bot, description: "Ask, inspect runs, and review capabilities", keywords: "assistant copilot command chat operations traces capabilities", moreGroup: "Intelligence" },
    { id: "analytics", label: "Analytics", href: "/admin/analytics", icon: BarChart3, description: "Source-to-revenue funnel", moreGroup: "Intelligence" },
    { id: "activity", label: "Activity", href: "/admin/activity", icon: Activity, description: "Operating activity ledger", moreGroup: "Intelligence" },
  ] },
  { label: "System", links: [
    { id: "integrations", label: "Integrations", href: "/admin/integrations", icon: PlugZap, description: "Capabilities, evidence, and roadmap", moreGroup: "System" },
    { id: "setup", label: "Setup Center", href: "/admin/setup", icon: ListChecks, description: "Connections and readiness", moreGroup: "System" },
    { id: "features", label: "Feature Board", href: "/admin/features", icon: KanbanSquare, description: "Managed delivery backlog", moreGroup: "System" },
    { id: "settings", label: "Settings", href: "/admin/settings", icon: Settings, description: "Operating preferences", moreGroup: "System" },
  ] },
  { label: "More tools", links: [
    { id: "leads", label: "Leads", href: "/admin/leads", icon: UserRound, description: "Inquiry capture and qualification", moreGroup: "Sources" },
    { id: "chat-leads", label: "Chat inquiries", href: "/admin/chat-leads", icon: MessageCircleMore, description: "Website chat submissions", moreGroup: "Sources" },
    { id: "subscribers", label: "Subscribers", href: "/admin/subscribers", icon: UserPlus, description: "Resource and email subscribers", moreGroup: "Sources" },
    { id: "partners", label: "Partners", href: "/admin/partners", icon: Handshake, description: "Partner applications", moreGroup: "Sources" },
    { id: "website-grades", label: "Website Grades", href: "/admin/website-grades", icon: Globe2, description: "Website grader submissions", moreGroup: "Sources" },
  ] },
];

export const adminNavLinks = adminNavSections.flatMap((section) => section.links);
export const adminMobileLinks = adminNavLinks.filter((link) => link.mobilePrimary);
export const adminMoreSections = adminNavSections.filter((section) => section.label !== "Command");

export function resolveAdminNavLink(pathname: string) {
  return [...adminNavLinks]
    .sort((left, right) => right.href.length - left.href.length)
    .find((link) => pathname === link.href || pathname.startsWith(`${link.href}/`));
}
