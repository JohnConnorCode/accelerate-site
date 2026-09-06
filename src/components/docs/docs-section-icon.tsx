import type { LucideIcon } from "lucide-react";
import {
  Bot,
  BriefcaseBusiness,
  Compass,
  FileCheck,
  Globe2,
  KanbanSquare,
  LayoutDashboard,
  Mail,
  MessageSquareText,
  PlugZap,
  RotateCcw,
  Settings,
  UserPlus,
  UsersRound,
} from "lucide-react";

/** One icon per docs section. Shared by the sidebar and the landing index. */
export const DOCS_SECTION_ICONS: Record<string, LucideIcon> = {
  start: Compass,
  "command-center": LayoutDashboard,
  pipeline: KanbanSquare,
  conversations: MessageSquareText,
  contacts: UsersRound,
  outreach: Mail,
  proposals: FileCheck,
  delivery: BriefcaseBusiness,
  intelligence: Bot,
  sources: UserPlus,
  workspace: Settings,
  extend: PlugZap,
  "follow-up": RotateCcw,
  "self-hosting": Globe2,
};

export function DocsSectionIcon({
  sectionId,
  className,
}: {
  sectionId: string;
  className?: string;
}) {
  const Icon = DOCS_SECTION_ICONS[sectionId] ?? Compass;
  return <Icon className={className} aria-hidden="true" />;
}
