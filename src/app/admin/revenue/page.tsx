"use client";

import { motion } from "framer-motion";
import { DollarSign, Users, TrendingDown, BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { AdminReadBody } from "@/components/admin/AdminReadBody";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
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
  const revenueQuery = useAdminQuery<RevenueData>(["admin", "revenue"], "/api/admin/revenue");
  const data = revenueQuery.data ?? null;
  const loading = revenueQuery.isPending;

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="pb-10"
    >
      <PageHeader title="Revenue" subtitle="Financial overview" />
      <AdminReadBody
        loading={loading}
        hasData={Boolean(data)}
        error={revenueQuery.error?.message}
        onRetry={() => void revenueQuery.refetch()}
        refreshing={revenueQuery.isFetching}
        loadingFallback={<LoadingSkeleton variant="page" />}
        label="Loading revenue"
      >
        {data && (
          <>
            {/* Key Metrics */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Monthly Recurring"
                value={data.totalMRR}
                change={`$${data.totalMRR.toLocaleString()}/mo`}
                icon={DollarSign}
                index={0}
              />
              <StatCard label="Active Clients" value={data.activeCount} icon={Users} index={1} />
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
            <div>
              <MRRChart data={data.mrrTimeline} />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Revenue by Industry */}
              <AdminSurface>
                <h3 className="mb-4 font-display text-sm font-semibold text-[var(--admin-ink)]">
                  Revenue by Industry
                </h3>
                {data.industryBreakdown.length === 0 ? (
                  <p className="admin-copy text-xs">No data yet</p>
                ) : (
                  <div className="space-y-3">
                    {data.industryBreakdown.map((ind) => {
                      const pct = data.totalMRR > 0 ? (ind.value / data.totalMRR) * 100 : 0;
                      return (
                        <div key={ind.name}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm capitalize text-[var(--admin-ink)]">
                              {ind.name}
                            </span>
                            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                              ${ind.value.toLocaleString()}/mo
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded bg-[var(--admin-surface-subtle)]">
                            <motion.div
                              className="h-full rounded bg-[var(--admin-accent)]"
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
              </AdminSurface>

              {/* Revenue by Client */}
              <AdminSurface>
                <h3 className="mb-4 font-display text-sm font-semibold text-[var(--admin-ink)]">
                  Revenue by Client
                </h3>
                {data.byClient.length === 0 ? (
                  <p className="admin-copy text-xs">No clients yet</p>
                ) : (
                  <div className="space-y-2">
                    {data.byClient.map((client) => (
                      <div
                        key={client.name}
                        className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-[var(--admin-surface-subtle)]"
                      >
                        <span className="text-sm text-[var(--admin-ink)]">{client.name}</span>
                        <div className="text-right">
                          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                            ${client.monthly.toLocaleString()}/mo
                          </span>
                          {client.oneTime > 0 && (
                            <span className="admin-copy ml-2 text-xs">
                              + ${client.oneTime.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </AdminSurface>
            </div>

            {/* One-Time Revenue */}
            {data.totalOneTime > 0 && (
              <div>
                <AdminSurface>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="admin-copy text-xs">Total One-Time Revenue</p>
                      <p className="font-display text-2xl font-bold text-[var(--admin-ink)]">
                        ${data.totalOneTime.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="admin-copy text-xs">Annual Recurring (est.)</p>
                      <p className="font-display text-2xl font-bold text-[var(--admin-accent)]">
                        ${(data.totalMRR * 12).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </AdminSurface>
              </div>
            )}
          </>
        )}
      </AdminReadBody>
    </motion.div>
  );
}
