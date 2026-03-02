"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { DashboardMetrics } from "@/components/admin/DashboardMetrics";
import { LeadsChart } from "@/components/admin/LeadsChart";
import { AIInsights } from "@/components/admin/AIInsights";
import { LeadPipeline } from "@/components/admin/LeadPipeline";
import { TodaysPriorities } from "@/components/admin/TodaysPriorities";
import { QuickActions } from "@/components/admin/QuickActions";
import { RevenueSnapshot } from "@/components/admin/RevenueSnapshot";
import { TaskWidget } from "@/components/admin/TaskWidget";
import { PageHeader } from "@/components/admin/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { calculateLeadScore, getScoreColor, getScoreLabel } from "@/lib/admin/lead-scoring";

interface Metrics {
  leadsToday: number;
  leadsWeek: number;
  leadsMonth: number;
  plansGenerated: number;
  conversionRate: string;
  chatLeads?: number;
  partnerApps?: number;
  websiteGrades?: number;
  mrr?: number;
  activeClients?: number;
}

interface Trends {
  weekDelta: number;
  monthDelta: number;
  prevWeekCount: number;
  prevMonthCount: number;
}

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

interface RecentLead {
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  industry: string;
  created_at: string;
  lead_status: string;
  ai_plan?: unknown;
  intake_data?: Record<string, unknown>;
  view_count?: number;
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [trends, setTrends] = useState<Trends | undefined>();
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [unreadContacts, setUnreadContacts] = useState(0);
  const [pendingPartners, setPendingPartners] = useState(0);
  const [chartData, setChartData] = useState<{ date: string; leads: number }[]>([]);
  const [pipeline, setPipeline] = useState<Record<string, number>>({});
  const [pipelineValues, setPipelineValues] = useState<Record<string, number>>({});
  const [emailStats, setEmailStats] = useState<{ active: number; completed: number; total: number } | undefined>();
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([]);
  const [overdueTasks, setOverdueTasks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const aiRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async (chartDays: number) => {
    try {
      const [metricsRes, leadsRes] = await Promise.all([
        fetch(`/api/admin/metrics?days=${chartDays}`),
        fetch("/api/admin/leads"),
      ]);
      const metricsData = await metricsRes.json();
      const leadsData = await leadsRes.json();

      setMetrics(metricsData.metrics);
      setTrends(metricsData.trends);
      setPriorities(metricsData.priorities || []);
      setUnreadContacts(metricsData.unreadContacts || 0);
      setPendingPartners(metricsData.pendingPartners || 0);
      setChartData(metricsData.chartData);
      setPipeline(metricsData.pipeline || {});
      setPipelineValues(metricsData.pipelineValues || {});
      setEmailStats(metricsData.emailStats);
      setOverdueTasks(metricsData.overdueTasks || 0);
      setRecentLeads((leadsData.leads || []).slice(0, 10));
    } catch {
      // Handle error silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(days);
  }, [fetchData, days]);

  const handleDaysChange = (newDays: number) => {
    setDays(newDays);
  };

  const handleExportLeads = () => {
    window.open("/api/admin/leads/export", "_blank");
  };

  const handleScrollToAI = () => {
    aiRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <LoadingSkeleton variant="page" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <PageHeader title="Dashboard" />

      <TodaysPriorities
        priorities={priorities}
        unreadContacts={unreadContacts}
        pendingPartners={pendingPartners}
        overdueTasks={overdueTasks}
      />

      <TaskWidget />

      {metrics && <DashboardMetrics metrics={metrics} emailStats={emailStats} trends={trends} />}

      <QuickActions onExportLeads={handleExportLeads} onScrollToAI={handleScrollToAI} />

      <div ref={aiRef} className="mt-6">
        <AIInsights />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <LeadsChart data={chartData} days={days} onDaysChange={handleDaysChange} />
        <LeadPipeline pipeline={pipeline} pipelineValues={pipelineValues} />
      </div>

      <div className="mt-6">
        <RevenueSnapshot
          pipeline={pipeline}
          pipelineValues={pipelineValues}
          clientMRR={metrics?.mrr || 0}
          activeClients={metrics?.activeClients || 0}
        />
      </div>

      {/* Recent Leads */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="mt-6"
      >
        <GlassCard hover="none">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-sm font-semibold text-white-primary">
              Recent Leads
            </h3>
            <Link href="/admin/leads" className="text-xs text-white-muted hover:text-white-secondary transition-colors">
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-glass">
                  <th className="text-left px-3 py-2 text-xs text-white-muted uppercase">Name</th>
                  <th className="text-left px-3 py-2 text-xs text-white-muted uppercase">Email</th>
                  <th className="text-left px-3 py-2 text-xs text-white-muted uppercase hidden sm:table-cell">Industry</th>
                  <th className="text-left px-3 py-2 text-xs text-white-muted uppercase">Score</th>
                  <th className="text-left px-3 py-2 text-xs text-white-muted uppercase">Status</th>
                  <th className="text-left px-3 py-2 text-xs text-white-muted uppercase hidden sm:table-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentLeads.map((lead, i) => {
                  const score = calculateLeadScore(lead);
                  const scoreColor = getScoreColor(score);
                  const label = getScoreLabel(score);

                  return (
                    <motion.tr
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-border-glass last:border-b-0 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-3 py-2.5">
                        <Link href="/admin/leads" className="text-white-primary hover:text-[var(--gold-light)] transition-colors">
                          {lead.contact_name}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/admin/contacts/${encodeURIComponent(lead.contact_email)}`}
                          className="text-white-secondary hover:text-[var(--gold-light)] transition-colors"
                        >
                          {lead.contact_email}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-white-secondary capitalize hidden sm:table-cell">
                        {lead.industry?.replace(/_/g, " ")}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${scoreColor}`}>
                          {label} {score}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={lead.lead_status || "new"} />
                      </td>
                      <td className="px-3 py-2.5 text-white-muted text-xs hidden sm:table-cell">
                        {new Date(lead.created_at).toLocaleDateString()}
                      </td>
                    </motion.tr>
                  );
                })}
                {recentLeads.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-white-muted">
                      No leads yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
