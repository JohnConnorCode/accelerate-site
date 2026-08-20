"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlarmClock, ArrowRight, BarChart3, CalendarClock, Check, CheckCircle2, CircleDollarSign, Inbox, Loader2, Mail, Megaphone, RefreshCw, ServerCog, ShieldCheck, Sparkles, Target, TriangleAlert, X } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { RevenueAICommand } from "@/components/admin/RevenueAICommand";
import { RevenueSetupGate } from "@/components/admin/RevenueSetupGate";
import { fetchJson } from "@/lib/admin/fetchJson";
import { cn } from "@/lib/utils";

interface QueueItem { id: string; kind: "reply" | "task" | "follow_up" | "proposal" | "meeting" | "approval" | "system"; title: string; summary: string; urgency: "critical" | "high" | "normal" | "low"; dueAt: string | null; priorityReason: string; href: string }
interface HealthRun { key: string; status: string; startedAt: string | null; finishedAt: string | null; error: string | null }
interface Overview { schemaReady: boolean; generatedAt: string; metrics: { openOpportunities: number; pipelineValue: number; weightedValue: number; wonRevenue: number; unreadConversations: number; activeCampaigns: number; pendingProposals: number }; queue: QueueItem[]; integrations: Array<{ provider: string; status: string; last_success_at: string | null; last_error: string | null }>; health: { status: "ready" | "attention" | "not_configured"; attentionCount: number; integrations: Array<{ provider: string; status: string; lastSuccessAt: string | null; lastError: string | null }>; sourceRuns: HealthRun[]; jobRuns: HealthRun[] } }
interface ActionRow { id: string; action_type: string; title: string; description: string | null; urgency: string; reasoning: string | null; status: string; created_at: string; expires_at: string | null; payload: Record<string, unknown> | null }

/**
 * What each action will actually do if approved, in plain language. Approving is
 * irreversible for external actions, so the operator is told the consequence
 * before the button, not after.
 */
const ACTION_CONSEQUENCE: Record<string, string> = {
  send_email: "Sends this email immediately. It cannot be recalled.",
  send_gmail_reply: "Sends this reply from your Gmail account immediately. It cannot be recalled.",
  activate_campaign: "Starts this campaign. Enrolled contacts begin receiving email on the next run.",
  transition_opportunity: "Moves this opportunity to a new stage and records an immutable stage event.",
  create_task: "Creates a task on your queue.",
  update_next_action: "Changes the next action recorded on this opportunity.",
};

/** Fields worth showing verbatim, in the order an operator reads them. */
const PAYLOAD_FIELD_ORDER = ["to", "recipient", "subject", "stage", "reason", "lossReason", "dueDate", "priority", "campaignId", "opportunityId", "contactId"];
const BODY_FIELDS = new Set(["body", "text", "message", "description"]);

function payloadEntries(payload: Record<string, unknown> | null) {
  if (!payload) return { fields: [] as Array<[string, string]>, body: null as string | null };
  const fields: Array<[string, string]> = [];
  let body: string | null = null;
  const keys = Object.keys(payload).sort((a, b) => {
    const ai = PAYLOAD_FIELD_ORDER.indexOf(a), bi = PAYLOAD_FIELD_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.localeCompare(b);
  });
  for (const key of keys) {
    const value = payload[key];
    if (value === null || value === undefined || value === "") continue;
    const text = typeof value === "string" ? value : JSON.stringify(value);
    if (BODY_FIELDS.has(key) && text.length > 120) { body = text; continue; }
    fields.push([key, text]);
  }
  return { fields, body };
}

function ActionReviewDialog({ action, busy, onClose, onApprove, onReject }: {
  action: ActionRow;
  busy: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { fields, body } = payloadEntries(action.payload);
  const consequence = ACTION_CONSEQUENCE[action.action_type] ?? "Executes this action through the same service the admin uses.";
  const external = action.action_type === "send_email" || action.action_type === "send_gmail_reply" || action.action_type === "activate_campaign";
  return <AdminDialog open onClose={onClose} title="Review before approving" labelledBy="action-review-title" maxWidth="lg">
    <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[24px] bg-[var(--admin-surface)] shadow-2xl sm:rounded-[24px]">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface)]/95 px-5 py-4 backdrop-blur-xl sm:px-6">
        <div>
          <p className="admin-eyebrow">Approval queue</p>
          <h2 id="action-review-title" className="mt-1 text-balance text-xl font-semibold tracking-[-0.03em] text-[var(--admin-ink)]">{action.title}</h2>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--admin-muted)]">{action.action_type.replace(/_/g, " ")}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close review" className="grid size-10 place-items-center rounded-xl text-[var(--admin-muted)] transition-[background-color,color,transform] duration-150 hover:bg-black/[0.04] hover:text-[var(--admin-ink)] active:scale-[0.96] dark:hover:bg-white/[0.05]"><X className="size-4" /></button>
      </div>

      <div className={cn("mx-5 mt-5 flex items-start gap-2.5 rounded-xl border px-3.5 py-3 sm:mx-6", external ? "border-amber-500/25 bg-amber-500/[0.07]" : "border-[var(--admin-border)] bg-[var(--admin-surface-subtle)]")}>
        <TriangleAlert className={cn("mt-px size-4 shrink-0", external ? "text-amber-600 dark:text-amber-400" : "text-[var(--admin-muted)]")} />
        <p className="admin-copy text-[11px] leading-5"><span className="font-semibold text-[var(--admin-ink)]">If you approve:</span> {consequence}</p>
      </div>

      <div className="grid gap-4 px-5 py-5 sm:px-6">
        {fields.length > 0 && <dl className="grid gap-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-4 py-3">
          {fields.map(([key, value]) => <div key={key} className="grid gap-1 sm:grid-cols-[130px_1fr] sm:gap-3">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted)]">{key.replace(/_/g, " ")}</dt>
            <dd className="break-words text-xs text-[var(--admin-ink)]">{value}</dd>
          </div>)}
        </dl>}

        {body && <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted)]">Exact message that will be sent</p>
          <pre className="mt-1.5 max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-4 py-3 font-sans text-xs leading-6 text-[var(--admin-ink)]">{body}</pre>
        </div>}

        {!fields.length && !body && <p className="admin-copy text-xs">This proposal recorded no payload. Reject it and ask the copilot to restage the action.</p>}

        {(action.reasoning || action.description) && <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted)]">Why the copilot proposed this</p>
          <p className="admin-copy mt-1.5 text-pretty text-xs leading-5">{action.reasoning || action.description}</p>
        </div>}

        {action.expires_at && <p className="admin-copy text-[11px]">Expires {relativeTime(action.expires_at).replace(/^Due in /, "in ").replace(/^Due today$/, "today")}.</p>}
      </div>

      <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface)]/95 px-5 py-4 backdrop-blur-xl sm:px-6">
        <button type="button" disabled={busy} onClick={onReject} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-rose-700 transition-[background-color,transform] duration-150 hover:bg-rose-500/10 active:scale-[0.96] disabled:opacity-50 dark:text-rose-300"><X className="size-3.5" /> Reject</button>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl px-4 text-xs font-semibold text-[var(--admin-muted)] transition-[color,transform] duration-150 hover:text-[var(--admin-ink)] active:scale-[0.96]">Cancel</button>
          <button type="button" disabled={busy} onClick={onApprove} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--admin-ink)] px-4 text-xs font-semibold text-[var(--admin-surface)] transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.96] disabled:opacity-50">{busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}{external ? "Approve and send" : "Approve"}</button>
        </div>
      </div>
    </div>
  </AdminDialog>;
}

const urgencyClass = {
  critical: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  high: "bg-amber-500/12 text-amber-800 dark:text-amber-300",
  normal: "bg-black/[0.045] text-[var(--admin-muted)] dark:bg-white/[0.06]",
  low: "bg-black/[0.025] text-[var(--admin-muted)] dark:bg-white/[0.04]",
};

function formatMoney(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }

const focusOptions = [
  { id: "all", label: "All work" },
  { id: "reply", label: "Replies" },
  { id: "commitments", label: "Commitments" },
  { id: "approval", label: "Approvals" },
  { id: "proposal", label: "Proposals" },
] as const;

function relativeTime(value: string | null) {
  if (!value) return "No due date";
  // Task due dates come from a DATE column, so they carry no time. Parsing one
  // as an instant makes it midnight, which meant a task created at 09:00 and due
  // the same day immediately read as "9h overdue". Compare whole days instead,
  // in UTC, to match how the queue service decides urgency.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const today = new Date().toISOString().slice(0, 10);
    if (value === today) return "Due today";
    const days = Math.round((Date.parse(`${value}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
    if (days < 0) return `${Math.abs(days)}d overdue`;
    return days === 1 ? "Due tomorrow" : `Due in ${days}d`;
  }
  const difference = Date.parse(value) - Date.now();
  const absoluteHours = Math.max(1, Math.round(Math.abs(difference) / 3_600_000));
  if (difference < 0) return absoluteHours < 24 ? `${absoluteHours}h overdue` : `${Math.ceil(absoluteHours / 24)}d overdue`;
  if (absoluteHours < 24) return `Due in ${absoluteHours}h`;
  return `Due in ${Math.ceil(absoluteHours / 24)}d`;
}

function queueIcon(kind: QueueItem["kind"]) {
  if (kind === "reply") return Mail;
  if (kind === "meeting") return CalendarClock;
  if (kind === "proposal") return BarChart3;
  if (kind === "approval") return Sparkles;
  return Inbox;
}

export default function TodayPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [reviewing, setReviewing] = useState<ActionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [acting, setActing] = useState<string | null>(null);
  const [taskActioning, setTaskActioning] = useState<string | null>(null);
  const [focus, setFocus] = useState<(typeof focusOptions)[number]["id"]>("all");

  const load = useCallback(async () => {
    setError("");
    try {
      const [nextOverview, nextActions] = await Promise.all([
        fetchJson<Overview>("/api/admin/revenue-os/overview"),
        fetchJson<{ actions: ActionRow[] }>("/api/admin/revenue-os/actions"),
      ]);
      setOverview(nextOverview);
      // An expired proposal can never be approved: claimApprovedAction rejects it.
      // Rendering one is an invitation to click a button that always fails.
      const now = Date.now();
      setActions(nextActions.actions.filter((action) =>
        action.status === "pending" && (!action.expires_at || Date.parse(action.expires_at) > now)));
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
      setReviewing(null);
      await load();
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : "Could not handle the action.");
    } finally {
      setActing(null);
    }
  };

  const updateTask = async (id: string, action: "complete" | "snooze") => {
    setTaskActioning(`${id}:${action}`);
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      await fetchJson("/api/admin/revenue-os/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, ...(action === "snooze" ? { until: tomorrow.toISOString().slice(0, 10) } : {}) }),
      });
      await load();
    } catch (taskError) {
      setError(taskError instanceof Error ? taskError.message : "Could not update task.");
    } finally {
      setTaskActioning(null);
    }
  };

  const urgentCount = useMemo(() => overview?.queue.filter((item) => ["critical", "high"].includes(item.urgency)).length ?? 0, [overview]);
  const visibleQueue = useMemo(() => {
    const queue = overview?.queue ?? [];
    if (focus === "all") return queue;
    if (focus === "commitments") return queue.filter((item) => item.kind === "task" || item.kind === "follow_up" || item.kind === "meeting");
    return queue.filter((item) => item.kind === focus);
  }, [focus, overview]);
  const healthItems = useMemo(() => {
    if (!overview) return [];
    return [
      ...overview.health.integrations.map((item) => ({ label: item.provider, status: item.status, at: item.lastSuccessAt, error: item.lastError })),
      ...overview.health.sourceRuns.map((item) => ({ label: item.key, status: item.status, at: item.finishedAt || item.startedAt, error: item.error })),
      ...overview.health.jobRuns.map((item) => ({ label: item.key, status: item.status, at: item.finishedAt || item.startedAt, error: item.error })),
    ].slice(0, 5);
  }, [overview]);

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

          <AdminSurface tone={overview.health.status === "attention" ? "attention" : "default"} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", overview.health.status === "attention" ? "bg-amber-500/12 text-amber-700 dark:text-amber-300" : overview.health.status === "ready" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-black/[0.045] text-[var(--admin-muted)] dark:bg-white/[0.06]")}>
                {overview.health.status === "attention" ? <TriangleAlert className="size-4" /> : overview.health.status === "ready" ? <ShieldCheck className="size-4" /> : <ServerCog className="size-4" />}
              </span>
              <div className="min-w-0"><p className="text-sm font-semibold text-[var(--admin-ink)]">{overview.health.status === "attention" ? `${overview.health.attentionCount} operational item${overview.health.attentionCount === 1 ? "" : "s"} need attention` : overview.health.status === "ready" ? "Revenue operations are reporting normally" : "Revenue integrations are not configured yet"}</p><p className="admin-copy mt-0.5 text-xs">{overview.health.status === "attention" ? "Review failures before they silently delay customer work." : overview.health.status === "ready" ? "Recent connections and job runs are healthy." : "Setup Center verifies live behavior once connections are enabled."}</p></div>
            </div>
            <Link href="/admin/setup" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[0.98]">Open Setup <ArrowRight className="size-3.5" /></Link>
          </AdminSurface>

          <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
            <AdminSurface padding="none" className="overflow-hidden">
              <div className="flex flex-col gap-4 px-5 py-4 sm:px-6"><div className="flex items-center justify-between gap-3"><div><p className="admin-eyebrow">Priority queue</p><h2 className="mt-1 text-balance text-lg font-semibold tracking-[-0.02em] text-[var(--admin-ink)]">What needs your attention</h2></div><span className="rounded-full bg-black/[0.045] px-2.5 py-1 font-mono text-[10px] tabular-nums text-[var(--admin-muted)] dark:bg-white/[0.06]">{visibleQueue.length}</span></div><div className="-mx-1 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none]">{focusOptions.map((option) => <button key={option.id} type="button" onClick={() => setFocus(option.id)} className={cn("min-h-10 shrink-0 rounded-lg px-3 text-xs font-semibold transition-[background-color,color,box-shadow] duration-150", focus === option.id ? "bg-[var(--admin-ink)] text-[var(--admin-surface)]" : "text-[var(--admin-muted)] hover:bg-black/[0.045] hover:text-[var(--admin-ink)] dark:hover:bg-white/[0.06]")}>{option.label}</button>)}</div></div>
              <div className="divide-y divide-[var(--admin-border)] border-t border-[var(--admin-border)]">
                {visibleQueue.slice(0, 15).map((item) => {
                  const Icon = queueIcon(item.kind);
                  const taskId = item.kind === "task" || item.kind === "follow_up" ? item.id.replace(/^task:/, "") : null;
                  return <div key={item.id} className="group flex min-h-[84px] items-start gap-3 px-5 py-4 transition-[background-color] duration-150 hover:bg-black/[0.022] dark:hover:bg-white/[0.025] sm:px-6">
                    <span className={cn("mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl", urgencyClass[item.urgency])}><Icon className="size-4" /></span>
                    <Link href={item.href} className="min-w-0 flex-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-ink)] focus-visible:ring-offset-2"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold text-[var(--admin-ink)]">{item.title}</h3>{item.urgency !== "normal" && <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]", urgencyClass[item.urgency])}>{item.urgency}</span>}</div><p className="admin-copy mt-1 line-clamp-2 text-pretty text-xs leading-5">{item.summary}</p><p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted)]">{item.priorityReason} <span className="mx-1 text-[var(--admin-border)]">·</span> {relativeTime(item.dueAt)}</p></Link>
                    {taskId ? <div className="flex shrink-0 items-center gap-1"><button type="button" aria-label={`Complete ${item.title}`} title="Complete task" disabled={Boolean(taskActioning)} onClick={() => void updateTask(taskId, "complete")} className="grid size-10 place-items-center rounded-lg text-emerald-700 transition-[background-color,scale,opacity] duration-150 hover:bg-emerald-500/10 active:scale-[0.96] disabled:opacity-50 dark:text-emerald-300">{taskActioning === `${taskId}:complete` ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}</button><button type="button" aria-label={`Snooze ${item.title} until tomorrow`} title="Snooze until tomorrow" disabled={Boolean(taskActioning)} onClick={() => void updateTask(taskId, "snooze")} className="grid size-10 place-items-center rounded-lg text-[var(--admin-muted)] transition-[background-color,scale,opacity] duration-150 hover:bg-black/[0.045] hover:text-[var(--admin-ink)] active:scale-[0.96] disabled:opacity-50 dark:hover:bg-white/[0.06]">{taskActioning === `${taskId}:snooze` ? <Loader2 className="size-4 animate-spin" /> : <AlarmClock className="size-4" />}</button></div> : <Link href={item.href} aria-label={`Open ${item.title}`} className="mt-2 grid size-10 shrink-0 place-items-center rounded-lg text-[var(--admin-muted)] transition-[background-color,transform] duration-150 hover:bg-black/[0.045] hover:text-[var(--admin-ink)] dark:hover:bg-white/[0.06]"><ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" /></Link>}
                  </div>;
                })}
                {!visibleQueue.length && <div className="px-6 py-14 text-center"><Check className="mx-auto size-5 text-emerald-600" /><p className="mt-3 text-sm font-semibold text-[var(--admin-ink)]">{overview.queue.length ? "Nothing in this focus" : "Queue clear"}</p><p className="admin-copy mt-1 text-xs">{overview.queue.length ? "Try another work category to see what is next." : "No current replies, approvals, or due commitments."}</p></div>}
              </div>
            </AdminSurface>

            <AdminSurface padding="none" className="overflow-hidden">
              <div className="px-5 py-4 sm:px-6"><p className="admin-eyebrow">Decisions</p><h2 className="mt-1 text-balance text-lg font-semibold tracking-[-0.02em] text-[var(--admin-ink)]">Approval queue</h2><p className="admin-copy mt-1 text-pretty text-xs">AI and automations stage consequential actions here.</p></div>
              <div className="divide-y divide-[var(--admin-border)] border-t border-[var(--admin-border)]">
                {actions.slice(0, 8).map((action) => (
                  <div key={action.id} className="px-5 py-4 sm:px-6"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-700 dark:text-violet-300"><Sparkles className="size-4" /></span><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold text-[var(--admin-ink)]">{action.title}</h3><p className="admin-copy mt-1 line-clamp-3 text-pretty text-xs leading-5">{action.description || action.reasoning || "Review before execution."}</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => setReviewing(action)} disabled={acting === action.id} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[var(--admin-ink)] px-3 text-xs font-semibold text-[var(--admin-surface)] transition-[opacity,transform] duration-150 active:scale-[0.96] disabled:opacity-50">{acting === action.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Review</button><button type="button" onClick={() => void decide(action.id, "reject")} disabled={acting === action.id} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[var(--admin-muted)] shadow-[var(--admin-shadow-border)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[0.96] disabled:opacity-50"><X className="size-3.5" /> Reject</button></div></div></div></div>
                ))}
                {!actions.length && <div className="px-6 py-12 text-center"><Check className="mx-auto size-5 text-emerald-600" /><p className="mt-3 text-sm font-semibold text-[var(--admin-ink)]">No decisions waiting</p><p className="admin-copy mt-1 text-xs">The copilot will stage external actions here.</p></div>}
              </div>
            </AdminSurface>
          </section>

          <AdminSurface padding="none" className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6"><div><p className="admin-eyebrow">Operational ledger</p><h2 className="mt-1 text-balance text-lg font-semibold tracking-[-0.02em] text-[var(--admin-ink)]">Connection and job health</h2></div><Link href="/admin/setup" className="text-xs font-semibold text-[var(--admin-ink)] underline decoration-[var(--admin-border)] underline-offset-4 hover:decoration-[var(--admin-ink)]">Details</Link></div>
            <div className="grid divide-y divide-[var(--admin-border)] border-t border-[var(--admin-border)] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-5">{healthItems.map((item) => <div key={`${item.label}-${item.status}`} className="min-h-[96px] px-5 py-4"><div className="flex items-center gap-2"><span className={cn("size-2 rounded-full", item.status === "success" || item.status === "connected" ? "bg-emerald-500" : item.status === "failed" || item.status === "partial" || item.status === "degraded" || item.status === "revoked" ? "bg-amber-500" : "bg-[var(--admin-muted)]")} /><p className="truncate text-xs font-semibold text-[var(--admin-ink)]">{item.label}</p></div><p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted)]">{item.status.replace(/_/g, " ")}</p><p className="admin-copy mt-1 line-clamp-2 text-xs">{item.error || (item.at ? `Last activity ${relativeTime(item.at)}` : "No run recorded yet")}</p></div>)}{!healthItems.length && <div className="px-6 py-8 text-sm text-[var(--admin-muted)] sm:col-span-2 lg:col-span-5">No connections or job receipts have been recorded. Setup Center will show exactly what needs configuration.</div>}</div>
          </AdminSurface>

          <RevenueAICommand onProposed={() => void load()} />

          {reviewing && <ActionReviewDialog
            action={reviewing}
            busy={acting === reviewing.id}
            onClose={() => setReviewing(null)}
            onApprove={() => void decide(reviewing.id, "approve")}
            onReject={() => void decide(reviewing.id, "reject")}
          />}
        </>
      )}
    </div>
  );
}
