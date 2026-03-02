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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
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

const typeConfig: Record<string, { icon: LucideIcon; color: string }> = {
  lead: { icon: Users, color: "text-blue-400 bg-blue-500/20" },
  contact: { icon: Inbox, color: "text-green-400 bg-green-500/20" },
  subscriber: { icon: AtSign, color: "text-purple-400 bg-purple-500/20" },
  chat: { icon: MessageCircle, color: "text-yellow-400 bg-yellow-500/20" },
  resource: { icon: Download, color: "text-cyan-400 bg-cyan-500/20" },
  email: { icon: Mail, color: "text-orange-400 bg-orange-500/20" },
  grade: { icon: Globe, color: "text-emerald-400 bg-emerald-500/20" },
  task: { icon: CheckSquare, color: "text-pink-400 bg-pink-500/20" },
  email_sent: { icon: Send, color: "text-amber-400 bg-amber-500/20" },
};

export function ContactTimeline({ items }: ContactTimelineProps) {
  if (items.length === 0) {
    return <EmptyState message="No interactions found for this contact" icon={Users} />;
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-5 top-0 bottom-0 w-px bg-border-glass" />

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
            >
              <Link href={item.link}>
                <GlassCard hover="glow" padding="sm" className="ml-10 group">
                  <div className="flex items-start gap-3">
                    {/* Icon circle */}
                    <div className={`absolute left-2.5 mt-1 h-5 w-5 rounded-full flex items-center justify-center ${config.color}`}>
                      <Icon className="h-3 w-3" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-semibold text-white-muted">
                          {item.type}
                        </span>
                        <span className="text-[10px] text-white-muted">
                          {new Date(item.timestamp).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-white-primary font-medium mt-0.5 truncate">
                        {item.title}
                      </p>
                      <p className="text-xs text-white-muted mt-0.5 truncate">
                        {item.description}
                      </p>
                    </div>

                    <ArrowRight className="h-3.5 w-3.5 text-white-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                  </div>
                </GlassCard>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
