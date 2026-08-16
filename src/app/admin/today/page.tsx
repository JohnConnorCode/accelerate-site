"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, CalendarClock, Check, CircleDollarSign, Inbox, Loader2, Mail, Megaphone, RefreshCw, Sparkles, Target, TriangleAlert, X } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { RevenueAICommand } from "@/components/admin/RevenueAICommand";
import { RevenueSetupGate } from "@/components/admin/RevenueSetupGate";
import { fetchJson } from "@/lib/admin/fetchJson";
import { cn } from "@/lib/utils";

interface QueueItem { id: string; kind: string; title: string; summary: string; urgency: "critical" | "high" | "normal" | "low"; dueAt: string | null; href: string }
interface Overview { schemaReady: boolean; generatedAt: string; metrics: { openOpportunities: number; pipelineValue: number; weightedValue: number; wonRevenue: number; unreadConversations: number; activeCampaigns: number; pendingProposals: number }; queue: QueueItem[]; integrations: Array<{ provider: string; status: string; last_success_at: string | null; last_error: string | null }> }
interface ActionRow { id: string; action_type: string; title: string; description: string | null; urgency: string; reasoning: string | null; status: string; created_at: string }

const urgencyClass = {
  critical: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  high: "bg-amber-500/12 text-amber-800 dark:text-amber-300",
  normal: "bg-black/[0.045] text-[var(--admin-muted)] dark:bg-white/[0.06]",
  low: "bg-black/[0.025] text-[var(--admin-muted)] dark:bg-white/[0.04]",
};

function formatMoney(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }

export default function TodayPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const [nextOverview, nextActions] = await Promise.all([
        fetchJson<Overview>("/api/admin/revenue-os/overview"),
        fetchJson<{ actions: ActionRow[] }>("/api/admin/revenue-os/actions"),
      ]);
      setOverview(nextOverview);
      setActions(nextActions.actions.filter((action) => action.status === "pending"));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load Today.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const decide = async (id: string, decision: "approve" | "reject") => {
    setActing(id);
    try {
      await fetchJson("/api/admin/revenue-os/actions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, decision }) });
      await load();
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : "Could not handle the action.");
    } finally {
      setActing(null);
    }
  };

  const urgentCount = useMemo(() => overview?.queue.filter((item) => ["critical", "high"].includes(item.urgency)).length ?? 0, [overview]);

  if (loading && !overview) return <div className="grid min-h-[55vh] place-items-center"><Loader2 className="size-6 animate-spin text-[var(--admin-muted)]" /></div>;

  return (
    <div className="space-y-7 pb-10">
      <PageHeader title="Today" subtitle="The founder queue: replies, commitments, meetings, proposals, approvals, and system exceptions in revenue order." actions={<button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-xs font-semibold text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[0.96]"><RefreshCw className={cn("size-3.5", loading && "animate-spin")} /> Refresh</button>} />
      {error && <AdminSurface tone="attention" className="flex items-center gap-3"><TriangleAlert className="size-5 shrink-0 text-rose-600" /><p className="text-sm text-[var(--admin-ink)]">{error}</p></AdminSurface>}
      {overview && !overview.schemaReady ? <RevenueSetupGate /> : overview && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Priority work", value: urgentCount, note: `${overview.queue.length} total in queue`, icon: Target },
              { label: "Open pipeline", value: formatMoney(overview.metrics.pipelineValue), note: `${formatMoney(overview.metrics.weightedValue)} weighted`, icon: CircleDollarSign },
              { label: "Unread replies", value: overview.metrics.unreadConversations, note: "Synced conversations", icon: Mail },
              { label: "Active campaigns", value: overview.metrics.activeCampaigns, note: `${overview.metrics.pendingProposals} proposals awaiting`, icon: Megaphone },
            ].map(({ label, value, note, icon: Icon }) => (
              <AdminSurface key={label} padding="lg">
                <div className="flex items-start justify-between gap-3"><div><p className="admin-eyebrow">{label}</p><p className="mt-3 text-3xl font-semibold tabular-nums tracking-[-0.045em] text-[var(--admin-ink)]">{value}</p><p className="admin-copy mt-1 text-xs">{note}</p></div><span className="grid size-9 place-items-center rounded-xl bg-black/[0.045] text-[var(--admin-ink)] dark:bg-white/[0.06]"><Icon className="size-4" /></span></div>
              </AdminSurface>
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
            <AdminSurface padding="none" className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6"><div><p className="admin-eyebrow">Now</p><h2 className="mt-1 text-balance text-lg font-semibold tracking-[-0.02em] text-[var(--admin-ink)]">What needs your attention</h2></div><span className="rounded-full bg-black/[0.045] px-2.5 py-1 font-mono text-[10px] tabular-nums text-[var(--admin-muted)] dark:bg-white/[0.06]">{overview.queue.length}</span></div>
              <div className="divide-y divide-[var(--admin-border)] border-t border-[var(--admin-border)]">
                {overview.queue.slice(0, 15).map((item) => (
                  <Link key={item.id} href={item.href} className="group flex min-h-[76px] items-start gap-3 px-5 py-4 transition-[background-color] duration-150 hover:bg-black/[0.022] dark:hover:bg-white/[0.025] sm:px-6">
                    <span className={cn("mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl", urgencyClass[item.urgency])}>{item.kind === "reply" ? <Mail className="size-4" /> : item.kind === "meeting" ? <CalendarClock className="size-4" /> : item.kind === "proposal" ? <BarChart3 className="size-4" /> : <Inbox className="size-4" />}</span>
                    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold text-[var(--admin-ink)]">{item.title}</h3>{item.urgency !== "normal" && <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]", urgencyClass[item.urgency])}>{item.urgency}</span>}</div><p className="admin-copy mt-1 line-clamp-2 text-pretty text-xs leading-5">{item.summary}</p></div>
                    <ArrowRight className="mt-2 size-4 shrink-0 text-[var(--admin-muted)] transition-transform duration-150 group-hover:translate-x-0.5" />
                  </Link>
                ))}
                {!overview.queue.length && <div className="px-6 py-14 text-center"><Check className="mx-auto size-5 text-emerald-600" /><p className="mt-3 text-sm font-semibold text-[var(--admin-ink)]">Queue clear</p><p className="admin-copy mt-1 text-xs">No current replies, approvals, or due commitments.</p></div>}
              </div>
            </AdminSurface>

            <AdminSurface padding="none" className="overflow-hidden">
              <div className="px-5 py-4 sm:px-6"><p className="admin-eyebrow">Decisions</p><h2 className="mt-1 text-balance text-lg font-semibold tracking-[-0.02em] text-[var(--admin-ink)]">Approval queue</h2><p className="admin-copy mt-1 text-pretty text-xs">AI and automations stage consequential actions here.</p></div>
              <div className="divide-y divide-[var(--admin-border)] border-t border-[var(--admin-border)]">
                {actions.slice(0, 8).map((action) => (
                  <div key={action.id} className="px-5 py-4 sm:px-6"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-700 dark:text-violet-300"><Sparkles className="size-4" /></span><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold text-[var(--admin-ink)]">{action.title}</h3><p className="admin-copy mt-1 line-clamp-3 text-pretty text-xs leading-5">{action.description || action.reasoning || "Review before execution."}</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => void decide(action.id, "approve")} disabled={acting === action.id} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[var(--admin-ink)] px-3 text-xs font-semibold text-[var(--admin-surface)] transition-[opacity,transform] duration-150 active:scale-[0.96] disabled:opacity-50">{acting === action.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Approve</button><button type="button" onClick={() => void decide(action.id, "reject")} disabled={acting === action.id} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[var(--admin-muted)] shadow-[var(--admin-shadow-border)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[0.96] disabled:opacity-50"><X className="size-3.5" /> Reject</button></div></div></div></div>
                ))}
                {!actions.length && <div className="px-6 py-12 text-center"><Check className="mx-auto size-5 text-emerald-600" /><p className="mt-3 text-sm font-semibold text-[var(--admin-ink)]">No decisions waiting</p><p className="admin-copy mt-1 text-xs">The copilot will stage external actions here.</p></div>}
              </div>
            </AdminSurface>
          </section>

          <RevenueAICommand onProposed={() => void load()} />
        </>
      )}
    </div>
  );
}
