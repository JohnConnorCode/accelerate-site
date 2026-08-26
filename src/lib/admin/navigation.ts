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
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  keywords?: string;
}

export interface AdminNavSection {
  label: string;
  links: AdminNavLink[];
}

export const adminNavSections: AdminNavSection[] = [
  { label: "Command", links: [
    { label: "Today", href: "/admin/today", icon: LayoutDashboard, description: "Prioritized revenue work" },
    { label: "Pipeline", href: "/admin/pipeline", icon: Target, description: "Canonical opportunities" },
    { label: "Conversations", href: "/admin/conversations", icon: Inbox, description: "Gmail and linked replies" },
    { label: "Inbox", href: "/admin/inbox", icon: Inbox, description: "Operator messages and follow-up" },
  ] },
  { label: "Revenue", links: [
    { label: "Contact intake", href: "/admin/contacts", icon: UsersRound, description: "Website submissions and reviewed list imports", keywords: "contacts submissions csv json paste ai dedupe import" },
    { label: "Email Studio", href: "/admin/emails", icon: MessageSquareText, description: "View and edit live email copy", keywords: "templates preview editor" },
    { label: "Campaigns", href: "/admin/campaigns", icon: Mail, description: "Controlled outbound" },
    { label: "Proposals", href: "/admin/proposals", icon: FileCheck, description: "Drafts, decisions, and follow-up" },
    { label: "Delivery Runs", href: "/admin/email-sequences", icon: MailCheck, description: "Sequence and delivery status", keywords: "email sequences sends" },
    { label: "Revenue", href: "/admin/revenue", icon: BriefcaseBusiness, description: "Revenue and client value" },
  ] },
  { label: "Delivery", links: [
    { label: "Clients", href: "/admin/clients", icon: BriefcaseBusiness, description: "Client delivery records" },
    { label: "Bookings", href: "/admin/bookings", icon: CalendarCheck, description: "Meeting and booking records" },
    { label: "Content", href: "/admin/content", icon: FileText, description: "Content operations" },
    { label: "Resources", href: "/admin/resources", icon: Library, description: "Downloadable resources" },
  ] },
  { label: "Intelligence", links: [
    { label: "AI Workspace", href: "/admin/ai", icon: Bot, description: "Ask, inspect runs, and review capabilities", keywords: "assistant copilot command chat operations traces capabilities" },
    { label: "Analytics", href: "/admin/analytics", icon: BarChart3, description: "Source-to-revenue funnel" },
    { label: "Activity", href: "/admin/activity", icon: Activity, description: "Operating activity ledger" },
  ] },
  { label: "System", links: [
    { label: "Integrations", href: "/admin/integrations", icon: PlugZap, description: "Capabilities, evidence, and roadmap" },
    { label: "Setup Center", href: "/admin/setup", icon: ListChecks, description: "Connections and readiness" },
    { label: "Feature Board", href: "/admin/features", icon: KanbanSquare, description: "Managed delivery backlog" },
    { label: "Settings", href: "/admin/settings", icon: Settings, description: "Operating preferences" },
  ] },
  { label: "More tools", links: [
    { label: "Leads", href: "/admin/leads", icon: UserRound, description: "Inquiry capture and qualification" },
    { label: "Chat inquiries", href: "/admin/chat-leads", icon: MessageCircleMore, description: "Website chat submissions" },
    { label: "Subscribers", href: "/admin/subscribers", icon: UserPlus, description: "Resource and email subscribers" },
    { label: "Partners", href: "/admin/partners", icon: Handshake, description: "Partner applications" },
    { label: "Website Grades", href: "/admin/website-grades", icon: Globe2, description: "Website grader submissions" },
  ] },
];

export const adminNavLinks = adminNavSections.flatMap((section) => section.links);
