"use client";

import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";

interface Channel {
  name: string;
  count: number;
}

interface ChannelBreakdownProps {
  channels: Channel[];
}

const barColors = ["bg-blue-500", "bg-green-500", "bg-yellow-500", "bg-purple-500", "bg-cyan-500"];

export function ChannelBreakdown({ channels }: ChannelBreakdownProps) {
  const maxCount = Math.max(...channels.map((c) => c.count), 1);
  const total = channels.reduce((sum, c) => sum + c.count, 0);

  return (
    <GlassCard hover="none">
      <h3 className="font-display text-sm font-semibold text-white-primary mb-4">Lead Sources</h3>
      <div className="space-y-3">
        {channels.map((channel, i) => {
          const width = (channel.count / maxCount) * 100;
          const pct = total > 0 ? Math.round((channel.count / total) * 100) : 0;

          return (
            <div key={channel.name} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white-secondary">{channel.name}</span>
                <span className="text-white-muted">
                  {channel.count} ({pct}%)
                </span>
              </div>
              <div className="h-5 rounded bg-white/5 overflow-hidden">
                <motion.div
                  className={`h-full rounded ${barColors[i % barColors.length]}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(width, channel.count > 0 ? 3 : 0)}%` }}
                  transition={{ duration: 0.7, delay: i * 0.08, ease: "easeOut" }}
                  style={{ opacity: 0.7 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
