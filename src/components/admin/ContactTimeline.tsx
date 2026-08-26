"use client";

import { motion } from "framer-motion";
import Link from "next/link";
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

const typeConfig: Record<string, { icon: LucideIcon; emphasis?: boolean }> = {
  lead: { icon: Users },
  contact: { icon: Inbox },
  subscriber: { icon: AtSign },
  chat: { icon: MessageCircle },
  resource: { icon: Download },
  email: { icon: Mail },
  grade: { icon: Globe },
  task: { icon: CheckSquare },
  email_sent: { icon: Send },
  opportunity: { icon: Target, emphasis: true },
  activity: { icon: CheckSquare },
  message_inbound: { icon: MessageSquareText },
  message_outbound: { icon: Send },
};

export function ContactTimeline({ items }: ContactTimelineProps) {
  if (items.length === 0) {
    return <EmptyState message="No interactions found for this contact" icon={Users} />;
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute bottom-5 left-5 top-5 w-px bg-[var(--admin-rule)]" />

      <div className="space-y-1">
        {items.map((item, i) => {
          const config = typeConfig[item.type] || typeConfig.lead!;
          const Icon = config.icon;

          return (
            <motion.div
              key={`${item.type}-${item.sourceId}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              data-contact-timeline-item
            >
              <Link href={item.link} className="relative block">
                <div className={`absolute left-2.5 top-4 z-10 grid size-5 place-items-center rounded-full shadow-[0_0_0_3px_var(--admin-bg)] ${config.emphasis ? "bg-amber-500/14 text-amber-700 dark:text-amber-300" : "bg-[var(--admin-surface-subtle)] text-[var(--admin-muted)]"}`}>
                  <Icon className="h-3 w-3" />
                </div>
                <AdminSurface padding="sm" className="group ml-10 transition-[box-shadow,transform] duration-200 hover:-translate-y-px hover:shadow-[var(--admin-shadow-hover)]">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="admin-eyebrow text-[9px]">
                          {item.type}
                        </span>
                        <span className="text-[10px] tabular-nums text-[var(--admin-muted)]">
                          {new Date(item.timestamp).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold leading-snug text-[var(--admin-ink)]">
                        {item.title}
                      </p>
                      <p className="admin-copy mt-1 line-clamp-2 text-xs leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    <ArrowRight className="mt-1 size-3.5 shrink-0 text-[var(--admin-muted)] opacity-0 transition-[opacity,transform] duration-150 group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </div>
                </AdminSurface>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
