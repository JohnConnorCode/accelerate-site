"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { DashboardMetrics } from "@/components/admin/DashboardMetrics";
import { LeadsChart } from "@/components/admin/LeadsChart";
import { AIInsights } from "@/components/admin/AIInsights";
import { LeadPipeline } from "@/components/admin/LeadPipeline";
import { PageHeader } from "@/components/admin/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";

interface Metrics {
  leadsToday: number;
  leadsWeek: number;
  leadsMonth: number;
  plansGenerated: number;
  conversionRate: string;
  chatLeads?: number;
  partnerApps?: number;
  websiteGrades?: number;
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [chartData, setChartData] = useState<{ date: string; leads: number }[]>([]);
  const [pipeline, setPipeline] = useState<Record<string, number>>({});
  const [emailStats, setEmailStats] = useState<{ active: number; completed: number; total: number } | undefined>();
  const [recentLeads, setRecentLeads] = useState<
    { contact_name: string; contact_email: string; industry: string; created_at: string; lead_status: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchData = useCallback(async (chartDays: number) => {
    try {
      const [metricsRes, leadsRes] = await Promise.all([
        fetch(`/api/admin/metrics?days=${chartDays}`),
        fetch("/api/admin/leads"),
      ]);
      const metricsData = await metricsRes.json();
      const leadsData = await leadsRes.json();

      setMetrics(metricsData.metrics);
      setChartData(metricsData.chartData);
      setPipeline(metricsData.pipeline || {});
      setEmailStats(metricsData.emailStats);
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

      {metrics && <DashboardMetrics metrics={metrics} emailStats={emailStats} />}

      <div className="mt-6">
        <AIInsights />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <LeadsChart data={chartData} days={days} onDaysChange={handleDaysChange} />
        <LeadPipeline pipeline={pipeline} />
      </div>

      {/* Recent Leads */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="mt-6"
      >
        <GlassCard hover="none">
          <h3 className="font-display text-sm font-semibold text-white-primary mb-4">
            Recent Leads
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-glass">
                  <th className="text-left px-3 py-2 text-xs text-white-muted uppercase">Name</th>
                  <th className="text-left px-3 py-2 text-xs text-white-muted uppercase">Email</th>
                  <th className="text-left px-3 py-2 text-xs text-white-muted uppercase">Industry</th>
                  <th className="text-left px-3 py-2 text-xs text-white-muted uppercase">Status</th>
                  <th className="text-left px-3 py-2 text-xs text-white-muted uppercase">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentLeads.map((lead, i) => (
                  <motion.tr
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-border-glass last:border-b-0"
                  >
                    <td className="px-3 py-2.5 text-white-primary">{lead.contact_name}</td>
                    <td className="px-3 py-2.5 text-white-secondary">{lead.contact_email}</td>
                    <td className="px-3 py-2.5 text-white-secondary capitalize">
                      {lead.industry?.replace(/_/g, " ")}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={lead.lead_status || "new"} />
                    </td>
                    <td className="px-3 py-2.5 text-white-muted text-xs">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                  </motion.tr>
                ))}
                {recentLeads.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-white-muted">
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
