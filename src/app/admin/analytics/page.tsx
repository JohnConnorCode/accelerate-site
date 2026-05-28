"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Clock, Users, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { ChannelBreakdown } from "@/components/admin/ChannelBreakdown";
import { ConversionFunnel } from "@/components/admin/ConversionFunnel";
import { GlassCard } from "@/components/ui/GlassCard";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";

interface Channel {
  name: string;
  count: number;
}

interface IndustryItem {
  name: string;
  count: number;
}

interface AnalyticsData {
  channels: Channel[];
  industryBreakdown: IndustryItem[];
  funnel: Record<string, number>;
  avgTimeToContact: number | null;
  totalLeads: number;
  days: number;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?days=${days}`);
      const json = await res.json();
      setData(json);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Analytics" />
        <LoadingSkeleton variant="page" />
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <PageHeader title="Analytics" />
        <p className="text-white-muted text-sm">Failed to load analytics data.</p>
      </div>
    );
  }

  const totalChannelLeads = data.channels.reduce((sum, c) => sum + c.count, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <PageHeader title="Analytics" subtitle="What's working, what's not" />

      {/* Date range selector */}
      <div className="flex gap-2 mb-6">
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-all cursor-pointer ${
              days === d
                ? "bg-gold-gradient text-black font-semibold"
                : "glass text-white-secondary hover:text-white-primary"
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard
          label={`Leads (${days}d)`}
          value={data.totalLeads}
          icon={Users}
          index={0}
        />
        <StatCard
          label="Total Touchpoints"
          value={totalChannelLeads}
          icon={TrendingUp}
          index={1}
        />
        <StatCard
          label="Avg Time to Contact"
          value={data.avgTimeToContact !== null ? `${data.avgTimeToContact}h` : "N/A"}
          icon={Clock}
          index={2}
          change={data.avgTimeToContact !== null && data.avgTimeToContact < 24 ? "Under 24h" : undefined}
          trend={data.avgTimeToContact !== null && data.avgTimeToContact < 24 ? "up" : undefined}
        />
      </div>

      {/* Charts grid */}
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <ChannelBreakdown channels={data.channels} />
        <ConversionFunnel funnel={data.funnel} />
      </div>

      {/* Industry breakdown */}
      <GlassCard hover="none">
        <h3 className="font-display text-sm font-semibold text-white-primary mb-4">
          Industry Breakdown
        </h3>
        {data.industryBreakdown.length === 0 ? (
          <p className="text-sm text-white-muted">No industry data for this period</p>
        ) : (
          <div className="space-y-2">
            {data.industryBreakdown.map((item, i) => {
              const maxCount = data.industryBreakdown[0]?.count || 1;
              const width = (item.count / maxCount) * 100;

              return (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-3"
                >
                  <span className="text-xs text-white-secondary w-36 shrink-0 capitalize truncate">
                    {item.name}
                  </span>
                  <div className="flex-1 h-5 rounded bg-white/5 overflow-hidden relative">
                    <motion.div
                      className="h-full bg-gold rounded"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(width, item.count > 0 ? 3 : 0)}%` }}
                      transition={{ duration: 0.6, delay: 0.1 + i * 0.04, ease: "easeOut" }}
                      style={{ opacity: 0.5 }}
                    />
                    <span className="absolute inset-0 flex items-center px-2 text-[11px] font-medium text-white-primary">
                      {item.count}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}
