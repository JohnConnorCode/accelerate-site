"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Flame, Clock, Inbox, Handshake, ArrowRight, CheckSquare, FileCheck } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui/GlassCard";
import { getScoreColor } from "@/lib/admin/lead-scoring";

interface Priority {
  id: string;
  name: string;
  email: string;
  score: number;
  scoreLabel: string;
  type: string;
  timeAgo: string;
  link: string;
}

interface TodaysPrioritiesProps {
  priorities: Priority[];
  unreadContacts: number;
  pendingPartners: number;
  overdueTasks?: number;
  stalledProposals?: number;
}

export function TodaysPriorities({ priorities, unreadContacts, pendingPartners, overdueTasks = 0, stalledProposals = 0 }: TodaysPrioritiesProps) {
  const hasItems = priorities.length > 0 || unreadContacts > 0 || pendingPartners > 0 || overdueTasks > 0 || stalledProposals > 0;

  if (!hasItems) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-6"
    >
      <GlassCard variant="gold" hover="none">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-4 w-4 text-gold-light" />
          <h3 className="font-display text-sm font-semibold text-white-primary">
            Today&apos;s Priorities
          </h3>
        </div>

        <div className="space-y-2">
          {overdueTasks > 0 && (
            <Link href="/admin" className="block">
              <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/5 transition-colors group bg-red-500/10 border border-red-500/20">
                <CheckSquare className="h-4 w-4 text-red-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-red-300 font-medium">
                    {overdueTasks} overdue task{overdueTasks !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-red-400/70">Follow-ups past due date</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-white-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
            </Link>
          )}

          {stalledProposals > 0 && (
            <Link href="/admin/proposals" className="block">
              <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/5 transition-colors group bg-amber-500/10 border border-amber-500/20">
                <FileCheck className="h-4 w-4 text-amber-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-amber-200 font-medium">
                    {stalledProposals} proposal{stalledProposals !== 1 ? "s" : ""} awaiting response
                  </p>
                  <p className="text-xs text-amber-400/70">Sent 3+ days ago, no reply</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-white-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
            </Link>
          )}

          {priorities.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link href={item.link} className="block">
                <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/5 transition-colors group">
                  {item.type === "hot_lead" ? (
                    <Flame className="h-4 w-4 text-orange-400 shrink-0" />
                  ) : (
                    <Clock className="h-4 w-4 text-yellow-400 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white-primary font-medium truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-white-muted">
                      {item.type === "hot_lead" ? "Hot lead, needs contact" : "Stuck in new, 48h+"} · {item.timeAgo}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-xs font-semibold rounded-full px-2 py-0.5 shrink-0",
                      getScoreColor(item.score)
                    )}
                  >
                    {item.scoreLabel} {item.score}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-white-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              </Link>
            </motion.div>
          ))}

          {unreadContacts > 0 && (
            <Link href="/admin/contacts" className="block">
              <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/5 transition-colors group">
                <Inbox className="h-4 w-4 text-blue-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-white-primary font-medium">
                    {unreadContacts} unread contact{unreadContacts !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-white-muted">New form submissions</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-white-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
            </Link>
          )}

          {pendingPartners > 0 && (
            <Link href="/admin/partners" className="block">
              <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/5 transition-colors group">
                <Handshake className="h-4 w-4 text-purple-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-white-primary font-medium">
                    {pendingPartners} pending partner app{pendingPartners !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-white-muted">Awaiting review</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-white-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
            </Link>
          )}
        </div>
      </GlassCard>
    </motion.div>
  );
}
