import {
  Activity,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  CalendarCheck,
  FileCheck,
  FileText,
  Globe2,
  Handshake,
  Inbox,
  KanbanSquare,
  LayoutDashboard,
  Library,
  ListChecks,
  Mail,
  MailCheck,
  MessageCircleMore,
  MessageSquareText,
  PlugZap,
  RotateCcw,
  Settings,
  Target,
  UserPlus,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

/**
 * The icons an extension manifest may name, resolved from string to component.
 *
 * A manifest is data and never supplies a component. This map is the other
 * half of that contract, and it must stay in sync with ALLOWED_ICONS in
 * scripts/build-extension-modules.mjs, which rejects any manifest naming an
 * icon that is not here. Keeping it an explicit map rather than a namespace
 * import is what stops the bundle from pulling in all of lucide.
 */
export const EXTENSION_NAV_ICONS: Record<string, LucideIcon> = {
  Activity,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  CalendarCheck,
  FileCheck,
  FileText,
  Globe2,
  Handshake,
  Inbox,
  KanbanSquare,
  LayoutDashboard,
  Library,
  ListChecks,
  Mail,
  MailCheck,
  MessageCircleMore,
  MessageSquareText,
  PlugZap,
  RotateCcw,
  Settings,
  Target,
  UserPlus,
  UserRound,
  UsersRound,
};

/** Falls back to a neutral icon rather than crashing the shell if a generated
 *  entry ever names something this map does not carry. */
export function resolveExtensionNavIcon(name: string): LucideIcon {
  return EXTENSION_NAV_ICONS[name] ?? PlugZap;
}
