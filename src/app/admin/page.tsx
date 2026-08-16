"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckSquare,
  Clock3,
  DollarSign,
  Download,
  Inbox,
  Mail,
  Plus,
  RefreshCw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { LeadsChart } from "@/components/admin/LeadsChart";
import { LeadPipeline } from "@/components/admin/LeadPipeline";
import { RevenueSnapshot } from "@/components/admin/RevenueSnapshot";
import { AIInsights } from "@/components/admin/AIInsights";
import { PlausibleWidget } from "@/components/admin/PlausibleWidget";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/Button";
import { calculateLeadScore, getScoreLabel } from "@/lib/admin/lead-scoring";
import { fetchJson } from "@/lib/admin/fetchJson";
import { toast } from "@/lib/admin/useToast";
import { cn } from "@/lib/utils";
import { adminListItemVariants, adminListVariants, adminSectionVariants } from "@/lib/admin/motion";
import type { AdminInboxResponse } from "@/lib/admin/inbox";

interface Metrics {
  leadsToday: number;
  leadsWeek: number;
  leadsMonth: number;
  plansGenerated: number;
  conversionRate: string;
  activeClients?: number;
  mrr?: number;
}

interface Summary {
  newOpportunities: number;
  highPriorityCount: number;
  openPipelineValue: number;
  activeClientMrr: number;
  wonThisMonth: number;
  conversionRate: string;
}

interface Trends {
  weekDelta: number;
  monthDelta: number;
  prevWeekCount: number;
  prevMonthCount: number;
}

interface RecentLead {
  id?: string;
  contact_name: string;
  contact_email: string;
  business_name?: string;
  contact_phone?: string;
  industry: string;
  created_at: string;
  lead_status: string;
  ai_plan?: unknown;
  intake_data?: Record<string, unknown>;
  view_count?: number;
}

interface MetricsResponse {
  metrics: Metrics;
  summary: Summary;
  trends?: Trends;
  chartData?: { date: string; leads: number }[];
  pipeline?: Record<string, number>;
  pipelineValues?: Record<string, number>;
  updatedAt?: string;
}

const inboxLabels = {
  lead: "Lead",
  contact: "Contact",
  chat: "Chat handoff",
  partner: "Partner",
  task: "Task",
  proposal: "Proposal",
} as const;

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function relativeTime(value: string) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [trends, setTrends] = useState<Trends>();
  const [chartData, setChartData] = useState<{ date: string; leads: number }[]>([]);
  const [pipeline, setPipeline] = useState<Record<string, number>>({});
  const [pipelineValues, setPipelineValues] = useState<Record<string, number>>({});
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([]);
  const [inbox, setInbox] = useState<AdminInboxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [days, setDays] = useState(30);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const aiRef = useRef<HTMLDetailsElement>(null);

  const fetchData = useCallback(async (chartDays: number, background = false) => {
    if (background) setRefreshing(true); else setLoading(true);
    try {
      const [metricsData, leadsData, inboxData] = await Promise.all([
        fetchJson<MetricsResponse>(`/api/admin/metrics?days=${chartDays}`),
        fetchJson<{ leads?: RecentLead[] }>("/api/admin/leads?limit=10"),
        fetchJson<AdminInboxResponse>("/api/admin/inbox"),
      ]);
      setMetrics(metricsData.metrics);
      setSummary(metricsData.summary);
      setTrends(metricsData.trends);
      setChartData(metricsData.chartData || []);
      setPipeline(metricsData.pipeline || {});
      setPipelineValues(metricsData.pipelineValues || {});
      setRecentLeads((leadsData.leads || []).slice(0, 8));
      setInbox(inboxData);
      setUpdatedAt(metricsData.updatedAt || new Date().toISOString());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load the Command Center");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(days); }, [days, fetchData]);
  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === "visible") fetchData(days, true); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [days, fetchData]);

  const metricCards = useMemo(() => summary ? [
    { label: "New opportunities", value: summary.newOpportunities, note: "Last 7 days", icon: Users, trend: trends?.weekDelta },
    { label: "Needs attention", value: summary.highPriorityCount, note: "Across every channel", icon: Target },
    { label: "Open pipeline", value: `$${summary.openPipelineValue.toLocaleString()}`, note: "Excludes won and lost", icon: DollarSign },
    { label: "Active client MRR", value: `$${summary.activeClientMrr.toLocaleString()}`, note: `${metrics?.activeClients || 0} active client${metrics?.activeClients === 1 ? "" : "s"}`, icon: Building2 },
  ] : [], [summary, trends, metrics]);

  if (loading) {
    return <div><PageHeader title="Command Center" subtitle="The work that moves pipeline and revenue." /><LoadingSkeleton variant="page" /></div>;
  }

  return (
    <motion.div variants={adminListVariants} initial="hidden" animate="visible">
      <motion.div variants={adminSectionVariants}>
        <PageHeader
          title={`${getGreeting()}.`}
          subtitle="Here is what needs attention and what is moving the business today."
          actions={
            <>
              <span className="hidden items-center gap-1.5 text-[11px] text-[var(--admin-muted)] md:flex"><Clock3 className="h-3.5 w-3.5" />{updatedAt ? `Updated ${relativeTime(updatedAt)}` : "Waiting for sync"}</span>
              <Button variant="secondary" size="sm" onClick={() => fetchData(days, true)} disabled={refreshing}><RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", refreshing && "animate-spin")} />{refreshing ? "Refreshing…" : "Refresh"}</Button>
              <Link href="/admin/leads?new=1" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[#0b0b0b] px-4 text-sm font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-[#252525] active:scale-[0.96]"><Plus className="h-3.5 w-3.5" /> New lead</Link>
            </>
          }
        />
      </motion.div>

      <motion.section variants={adminSectionVariants} aria-label="Business summary" className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => <MetricCard key={card.label} {...card} />)}
      </motion.section>

      <motion.section variants={adminSectionVariants} className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(310px,0.65fr)]">
        <AdminSurface padding="none" className="overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div><p className="admin-eyebrow">Operator queue</p><h2 className="text-base font-semibold tracking-[-0.02em] text-[var(--admin-ink)]">What needs a decision</h2></div>
            <Link href="/admin/inbox" className="inline-flex min-h-10 items-center gap-1.5 rounded-[10px] px-2 text-xs font-medium text-[var(--admin-muted)] transition-[color,background-color,transform] duration-150 hover:bg-[var(--admin-surface-subtle)] hover:text-[var(--admin-ink)] active:scale-[0.96]">Open inbox <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          <motion.div variants={adminListVariants} className="border-t border-black/[0.07] dark:border-white/[0.07]">
            {(inbox?.items || []).slice(0, 6).map((item) => (
              <motion.div key={`${item.kind}-${item.id}`} variants={adminListItemVariants} className="group flex items-center gap-3 border-b border-black/[0.07] px-5 py-3.5 last:border-b-0 dark:border-white/[0.07]">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", item.priority === "urgent" ? "bg-red-500" : item.priority === "important" ? "bg-amber-500" : "bg-black/20 dark:bg-white/25")} />
                <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--admin-muted)]">{inboxLabels[item.kind]}</span><span className="text-[10px] text-[var(--admin-muted)]">{relativeTime(item.createdAt)}</span></div><p className="mt-0.5 truncate text-sm font-medium text-[var(--admin-ink)]">{item.title}</p><p className="admin-copy mt-0.5 truncate text-xs">{item.summary}</p></div>
                <Link href={item.href} className="admin-icon-button opacity-60 sm:opacity-0 sm:group-hover:opacity-100" aria-label={`Open ${item.title}`}><ArrowUpRight className="h-4 w-4" /></Link>
              </motion.div>
            ))}
            {(inbox?.items || []).length === 0 && <div className="px-5 py-10 text-center"><CheckSquare className="mx-auto mb-2 h-5 w-5 text-[var(--success)]" /><p className="text-sm font-medium">Queue clear</p><p className="admin-copy mt-1 text-xs">Nothing needs a human decision right now.</p></div>}
          </motion.div>
        </AdminSurface>

        <AdminSurface tone="ink" className="flex flex-col justify-between overflow-hidden">
          <div>
            <p className="mb-2 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-white/38">Move the work</p>
            <h2 className="max-w-[15ch] font-display text-2xl font-semibold leading-[1.05] tracking-[-0.04em] text-white">The fastest paths through the admin.</h2>
          </div>
          <div className="mt-8 space-y-1">
            <QuickAction icon={Plus} label="Create a lead" href="/admin/leads?new=1" />
            <QuickAction icon={Mail} label="Compose an email" onClick={() => window.dispatchEvent(new CustomEvent("admin:compose-email"))} />
            <QuickAction icon={CheckSquare} label="Add a follow-up" onClick={() => window.dispatchEvent(new CustomEvent("admin:add-task"))} />
            <QuickAction icon={Inbox} label="Open operator inbox" href="/admin/inbox" />
            <QuickAction icon={Download} label="Export leads" onClick={() => window.open("/api/admin/leads/export", "_blank", "noopener,noreferrer")} />
          </div>
        </AdminSurface>
      </motion.section>

      <motion.section variants={adminSectionVariants} className="mb-5 grid gap-5 lg:grid-cols-2">
        <LeadsChart data={chartData} days={days} onDaysChange={setDays} />
        <LeadPipeline pipeline={pipeline} pipelineValues={pipelineValues} />
      </motion.section>

      <motion.section variants={adminSectionVariants} className="mb-5">
        <AdminSurface padding="none" className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4"><div><p className="admin-eyebrow">Recent opportunities</p><h2 className="text-base font-semibold tracking-[-0.02em]">Newest pipeline activity</h2></div><Link href="/admin/leads" className="inline-flex min-h-10 items-center gap-1.5 px-2 text-xs text-[var(--admin-muted)] transition-colors duration-150 hover:text-[var(--admin-ink)]">View all <ArrowRight className="h-3.5 w-3.5" /></Link></div>
          <div className="overflow-x-auto border-t border-black/[0.07] dark:border-white/[0.07]">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="text-left font-mono text-[9px] uppercase tracking-[0.11em] text-[var(--admin-muted)]"><th className="px-5 py-3 font-semibold">Opportunity</th><th className="px-4 py-3 font-semibold">Industry</th><th className="px-4 py-3 font-semibold">Score</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-5 py-3 text-right font-semibold">Received</th></tr></thead>
              <tbody>
                {recentLeads.map((lead) => {
                  const score = calculateLeadScore(lead);
                  return <tr key={lead.id || `${lead.contact_email}-${lead.created_at}`} className="border-t border-black/[0.07] transition-colors duration-150 hover:bg-black/[0.025] dark:border-white/[0.07] dark:hover:bg-white/[0.025]"><td className="px-5 py-3"><Link href={`/admin/contacts/${encodeURIComponent(lead.contact_email)}`} className="block min-h-10 py-1"><span className="block font-medium text-[var(--admin-ink)]">{lead.business_name || lead.contact_name}</span><span className="admin-copy block text-xs">{lead.contact_name} · {lead.contact_email}</span></Link></td><td className="px-4 py-3 capitalize text-[var(--admin-muted)]">{lead.industry?.replace(/_/g, " ") || "—"}</td><td className="admin-number px-4 py-3"><span className={cn("rounded-md px-2 py-1 text-xs font-semibold", score >= 70 ? "bg-red-500/10 text-red-600 dark:text-red-400" : score >= 40 ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-black/5 text-[var(--admin-muted)] dark:bg-white/8")}>{getScoreLabel(score)} {score}</span></td><td className="px-4 py-3"><StatusBadge status={lead.lead_status || "new"} /></td><td className="admin-number px-5 py-3 text-right text-xs text-[var(--admin-muted)]">{relativeTime(lead.created_at)}</td></tr>;
                })}
                {recentLeads.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-[var(--admin-muted)]">No opportunities yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </AdminSurface>
      </motion.section>

      <motion.section variants={adminSectionVariants} className="space-y-5">
        <RevenueSnapshot pipeline={pipeline} pipelineValues={pipelineValues} clientMRR={metrics?.mrr || 0} activeClients={metrics?.activeClients || 0} />
        <PlausibleWidget />
        <details ref={aiRef} className="group">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between rounded-[14px] bg-[var(--admin-surface)] px-4 text-sm font-medium shadow-[var(--admin-shadow)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--admin-shadow-hover)] active:scale-[0.99]"><span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[var(--admin-muted)]" /> AI analysis</span><span className="text-xs font-normal text-[var(--admin-muted)]">Generate on demand</span></summary>
          <div className="mt-3"><AIInsights /></div>
        </details>
      </motion.section>
    </motion.div>
  );
}

function MetricCard({ label, value, note, icon: Icon, trend }: { label: string; value: string | number; note: string; icon: LucideIcon; trend?: number }) {
  return (
    <AdminSurface interactive className="min-h-[144px]">
      <div className="mb-6 flex items-center justify-between gap-4"><span className="text-xs font-medium text-[var(--admin-muted)]">{label}</span><Icon className="h-4 w-4 text-[var(--admin-muted)]" /></div>
      <div className="flex items-end justify-between gap-3"><div><p className="admin-number font-display text-[1.85rem] font-semibold leading-none tracking-[-0.045em] text-[var(--admin-ink)]">{value}</p><p className="admin-copy mt-2 text-[11px]">{note}</p></div>{typeof trend === "number" && <span className={cn("admin-number mb-0.5 flex items-center gap-1 text-[11px] font-medium", trend > 0 ? "text-[var(--success)]" : trend < 0 ? "text-[var(--error)]" : "text-[var(--admin-muted)]")}>{trend > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : trend < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : null}{trend === 0 ? "No change" : `${trend > 0 ? "+" : ""}${trend}`}</span>}</div>
    </AdminSurface>
  );
}

function QuickAction({ icon: Icon, label, href, onClick }: { icon: LucideIcon; label: string; href?: string; onClick?: () => void }) {
  const className = "group flex min-h-11 w-full items-center gap-3 rounded-[10px] px-2.5 text-left text-sm text-white/65 transition-[color,background-color,transform] duration-150 hover:bg-white/8 hover:text-white active:scale-[0.96]";
  const content = <><span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-white/8"><Icon className="h-3.5 w-3.5" /></span><span className="flex-1">{label}</span><ArrowUpRight className="h-3.5 w-3.5 opacity-30 transition-opacity duration-150 group-hover:opacity-80" /></>;
  return href ? <Link href={href} className={className}>{content}</Link> : <button type="button" onClick={onClick} className={className}>{content}</button>;
}
