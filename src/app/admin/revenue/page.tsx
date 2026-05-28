"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { DollarSign, Users, TrendingDown, BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { GlassCard } from "@/components/ui/GlassCard";
import { MRRChart } from "@/components/admin/MRRChart";
import { StatCard } from "@/components/admin/StatCard";

interface RevenueData {
  totalMRR: number;
  totalOneTime: number;
  activeCount: number;
  churnRate: number;
  avgClientValue: number;
  industryBreakdown: { name: string; value: number }[];
  byClient: { name: string; monthly: number; oneTime: number }[];
  mrrTimeline: { date: string; mrr: number }[];
  proposalRevenue: number;
}

export default function RevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRevenue = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/revenue");
      const json = await res.json();
      setData(json);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRevenue();
  }, [fetchRevenue]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Revenue" />
        <LoadingSkeleton variant="page" />
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <PageHeader title="Revenue" />
        <p className="text-white-muted">Failed to load revenue data.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <PageHeader title="Revenue" subtitle="Financial overview" />

      {/* Key Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard
          label="Monthly Recurring"
          value={data.totalMRR}
          change={`$${data.totalMRR.toLocaleString()}/mo`}
          icon={DollarSign}
          index={0}
        />
        <StatCard
          label="Active Clients"
          value={data.activeCount}
          icon={Users}
          index={1}
        />
        <StatCard
          label="Avg Client Value"
          value={data.avgClientValue}
          change={`$${data.avgClientValue.toLocaleString()}/mo`}
          icon={BarChart3}
          index={2}
        />
        <StatCard
          label="Churn Rate"
          value={data.churnRate}
          change={`${data.churnRate}%`}
          trend={data.churnRate > 10 ? "down" : "neutral"}
          icon={TrendingDown}
          index={3}
        />
      </div>

      {/* MRR Chart */}
      <div className="mb-6">
        <MRRChart data={data.mrrTimeline} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue by Industry */}
        <GlassCard hover="none" padding="md">
          <h3 className="font-display text-sm font-semibold text-white-primary mb-4">
            Revenue by Industry
          </h3>
          {data.industryBreakdown.length === 0 ? (
            <p className="text-xs text-white-muted">No data yet</p>
          ) : (
            <div className="space-y-3">
              {data.industryBreakdown.map((ind) => {
                const pct = data.totalMRR > 0 ? (ind.value / data.totalMRR) * 100 : 0;
                return (
                  <div key={ind.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-white-secondary capitalize">{ind.name}</span>
                      <span className="text-sm text-emerald-400 font-medium">
                        ${ind.value.toLocaleString()}/mo
                      </span>
                    </div>
                    <div className="h-2 rounded bg-white/5 overflow-hidden">
                      <motion.div
                        className="h-full rounded bg-gold"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6 }}
                        style={{ opacity: 0.7 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>

        {/* Revenue by Client */}
        <GlassCard hover="none" padding="md">
          <h3 className="font-display text-sm font-semibold text-white-primary mb-4">
            Revenue by Client
          </h3>
          {data.byClient.length === 0 ? (
            <p className="text-xs text-white-muted">No clients yet</p>
          ) : (
            <div className="space-y-2">
              {data.byClient.map((client) => (
                <div
                  key={client.name}
                  className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-white/5 transition-colors"
                >
                  <span className="text-sm text-white-primary">{client.name}</span>
                  <div className="text-right">
                    <span className="text-sm text-emerald-400 font-medium">
                      ${client.monthly.toLocaleString()}/mo
                    </span>
                    {client.oneTime > 0 && (
                      <span className="text-xs text-white-muted ml-2">
                        + ${client.oneTime.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      {/* One-Time Revenue */}
      {data.totalOneTime > 0 && (
        <div className="mt-6">
          <GlassCard hover="none" padding="md">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-white-muted">Total One-Time Revenue</p>
                <p className="text-2xl font-display font-bold text-white-primary">
                  ${data.totalOneTime.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-white-muted">Annual Recurring (est.)</p>
                <p className="text-2xl font-display font-bold text-gold-gradient">
                  ${(data.totalMRR * 12).toLocaleString()}
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </motion.div>
  );
}
