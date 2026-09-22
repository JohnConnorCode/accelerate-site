"use client";

import Link from "@/components/admin/AdminLink";
import {
  Users,
  Inbox,
  AtSign,
  MessageCircle,
  Download,
  Mail,
  Globe,
  ArrowRight,
  CheckSquare,
  Send,
  Target,
  MessageSquareText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { EmptyState } from "./EmptyState";

interface TimelineItem {
  type: string;
  title: string;
  description: string;
  timestamp: string;
  sourceId: string;
  link: string;
}

interface ContactTimelineProps {
  items: TimelineItem[];
}

const typeConfig: Record<string, { icon: LucideIcon; emphasis?: boolean; label: string }> = {
  lead: { icon: Users, label: "Lead" },
  contact: { icon: Inbox, label: "Contact" },
  subscriber: { icon: AtSign, label: "Subscriber" },
  chat: { icon: MessageCircle, label: "Chat" },
  resource: { icon: Download, label: "Resource" },
  email: { icon: Mail, label: "Email" },
  grade: { icon: Globe, label: "Website grade" },
  task: { icon: CheckSquare, label: "Task" },
  email_sent: { icon: Send, label: "Email sent" },
  opportunity: { icon: Target, emphasis: true, label: "Opportunity" },
  activity: { icon: CheckSquare, label: "Activity" },
  message_inbound: { icon: MessageSquareText, label: "Message received" },
  message_outbound: { icon: Send, label: "Message sent" },
};

/** Human label for an interaction type. Falls back to de-underscoring the raw
 * value so an unmapped type never renders as MESSAGE_INBOUND-style enum text. */
function typeLabel(type: string): string {
  return typeConfig[type]?.label ?? type.replaceAll("_", " ");
}

const timelineDate = (value: string) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export function ContactTimeline({ items }: ContactTimelineProps) {
  if (items.length === 0) {
    return <EmptyState message="No interactions found for this contact" icon={Users} />;
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute bottom-5 left-5 top-5 w-px bg-[var(--admin-rule)]" />

      <ol className="grid gap-[var(--admin-space-3)]">
        {items.map((item) => {
          const config = typeConfig[item.type] || typeConfig.lead!;
          const Icon = config.icon;

          return (
            <li key={`${item.type}-${item.sourceId}`} data-contact-timeline-item>
              <Link
                href={item.link}
                className="admin-timeline-link group relative block rounded-[var(--admin-surface-radius)]"
              >
                <div
                  className={`absolute left-2 top-4 z-10 grid size-6 place-items-center rounded-full shadow-[0_0_0_3px_var(--admin-canvas)] ${config.emphasis ? "bg-amber-500/14 text-amber-700 dark:text-amber-300" : "bg-[var(--admin-surface-subtle)] text-[var(--admin-muted)]"}`}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                </div>
                <AdminSurface
                  padding="sm"
                  elevation="flat"
                  className="admin-timeline-card ml-10 transition-shadow duration-150 group-hover:shadow-[var(--admin-shadow-hover)]"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="admin-eyebrow">{typeLabel(item.type)}</span>
                        <time
                          dateTime={item.timestamp}
                          className="text-xs tabular-nums text-[var(--admin-muted)]"
                        >
                          {timelineDate(item.timestamp)}
                        </time>
                      </div>
                      <p className="mt-1 break-words text-sm font-semibold leading-snug text-[var(--admin-ink)]">
                        {item.title}
                      </p>
                      <p className="admin-copy mt-1 line-clamp-2 break-words text-xs leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    <ArrowRight
                      aria-hidden="true"
                      className="mt-1 size-4 shrink-0 text-[var(--admin-muted)] opacity-60 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                    />
                  </div>
                </AdminSurface>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
