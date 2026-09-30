"use client";

import { adminPageName } from "@/lib/admin/navigation";

import { motion, useReducedMotion } from "framer-motion";
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
  byClient: { id?: string; name: string; monthly: number; oneTime: number }[];
  mrrTimeline: { date: string; mrr: number }[];
  proposalRevenue: number;
  timelineDates?: { creationDateFallbackCount: number; unknownDateCount: number };
  canonical: {
    openOpportunities: number;
    pipelineValue: number;
    weightedValue: number;
    wonRevenue: number;
    opportunityCount: number;
  };
  dispositions: { field: string; owner: "canonical" | "retained"; note: string }[];
}

export default function RevenuePage() {
  const reducedMotion = useReducedMotion();
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
      <PageHeader
        title={adminPageName("revenue")}
        subtitle="Review active client contracts and recorded opportunity values."
      />
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
            <div className="admin-grid admin-grid--metrics">
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
                label="Churned Share"
                value={data.churnRate}
                change={`${data.churnRate}%`}
                trend={data.churnRate > 10 ? "down" : "neutral"}
                icon={TrendingDown}
                index={3}
              />
            </div>

            <p className="admin-copy text-xs">
              Monthly recurring value includes active clients. Churned share is the percentage of
              current non-onboarding client records marked churned, across all recorded dates.
            </p>

            <AdminSurface>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display text-sm font-semibold text-[var(--admin-ink)]">
                  Opportunity values
                </h3>
                <span className="admin-copy text-xs">
                  {data.canonical.openOpportunities} open of {data.canonical.opportunityCount}{" "}
                  opportunities
                </span>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="admin-eyebrow">Open pipeline</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    ${data.canonical.pipelineValue.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="admin-eyebrow">Weighted pipeline</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    ${data.canonical.weightedValue.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="admin-eyebrow">Won revenue</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    ${data.canonical.wonRevenue.toLocaleString()}
                  </p>
                </div>
              </div>
              <p className="admin-copy mt-4 text-xs">
                Client agreements, accepted proposals and opportunity values are separate records.
                Check payment receipts when you need collected cash.
              </p>
            </AdminSurface>

            {/* MRR Chart */}
            <div>
              <MRRChart data={data.mrrTimeline} dates={data.timelineDates} />
            </div>

            <div className="admin-grid admin-grid--panels">
              {/* Active Monthly Value by Industry */}
              <AdminSurface>
                <h3 className="mb-4 font-display text-sm font-semibold text-[var(--admin-ink)]">
                  Active Monthly Value by Industry
                </h3>
                {data.industryBreakdown.length === 0 ? (
                  <p className="admin-copy text-xs">No active client contracts yet</p>
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
                              initial={reducedMotion ? false : { width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: reducedMotion ? 0 : 0.6 }}
                              style={{ opacity: 0.7 }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </AdminSurface>

              {/* Active Monthly Value by Client */}
              <AdminSurface>
                <h3 className="mb-4 font-display text-sm font-semibold text-[var(--admin-ink)]">
                  Active Monthly Value by Client
                </h3>
                {data.byClient.length === 0 ? (
                  <p className="admin-copy text-xs">No active client contracts yet</p>
                ) : (
                  <div className="space-y-2">
                    {data.byClient.map((client) => (
                      <div
                        key={client.id ?? client.name}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-[var(--admin-surface-subtle)]"
                      >
                        <span className="min-w-0 break-words text-sm text-[var(--admin-ink)]">
                          {client.name}
                        </span>
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

            {/* Agreement and proposal values remain separate. */}
            <div>
              <AdminSurface>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="admin-copy text-xs">Recorded One-Time Value</p>
                    <p className="font-display text-2xl font-bold text-[var(--admin-ink)]">
                      ${data.totalOneTime.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="admin-copy text-xs">Annualized Active Contracts</p>
                    <p className="font-display text-2xl font-bold text-[var(--admin-accent)]">
                      ${(data.totalMRR * 12).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="admin-copy text-xs">Accepted Proposal Monthly Value</p>
                    <p className="font-display text-2xl font-bold tabular-nums text-[var(--admin-ink)]">
                      ${data.proposalRevenue.toLocaleString()}/mo
                    </p>
                  </div>
                </div>
              </AdminSurface>
            </div>
          </>
        )}
      </AdminReadBody>
    </motion.div>
  );
}
