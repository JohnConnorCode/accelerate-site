"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Users,
  Inbox,
  AtSign,
  Handshake,
  Globe,
  Mail,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { EmptyState } from "@/components/admin/EmptyState";
import { cn } from "@/lib/utils";

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  timestamp: string;
}

const typeConfig: Record<string, { icon: LucideIcon; color: string }> = {
  lead: { icon: Users, color: "text-blue-400 bg-blue-500/10" },
  contact: { icon: Inbox, color: "text-emerald-400 bg-emerald-500/10" },
  subscriber: { icon: AtSign, color: "text-purple-400 bg-purple-500/10" },
  partner: { icon: Handshake, color: "text-yellow-400 bg-yellow-500/10" },
  grade: { icon: Globe, color: "text-cyan-400 bg-cyan-500/10" },
  email: { icon: Mail, color: "text-orange-400 bg-orange-500/10" },
};

function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/activity");
      const data = await res.json();
      setActivities(data.activities || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Activity Log" />
        <LoadingSkeleton variant="table" rows={10} />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <PageHeader title="Activity Log" subtitle="Recent system activity" />

      <GlassCard padding="none" hover="none">
        {activities.length === 0 ? (
          <EmptyState message="No recent activity" icon={Activity} />
        ) : (
          <div className="divide-y divide-border-glass">
            {activities.map((item, index) => {
              const config = typeConfig[item.type] || { icon: Activity, color: "text-white-muted bg-white/5" };
              const Icon = config.icon;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
                >
                  <div className={cn("rounded-lg p-2 shrink-0", config.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="flex-1 text-sm text-white-secondary min-w-0 truncate">
                    {item.description}
                  </p>
                  <time className="text-xs text-white-muted shrink-0">
                    {formatRelativeTime(item.timestamp)}
                  </time>
                </motion.div>
              );
            })}
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}
