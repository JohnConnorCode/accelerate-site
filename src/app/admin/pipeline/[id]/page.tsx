"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Bot,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  FileText,
  Loader2,
  Mail,
  MessageSquareText,
  RefreshCw,
  Save,
  Target,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { useAdminAI } from "@/components/admin/AdminAIProvider";
import { PageHeader } from "@/components/admin/PageHeader";
import { RevenueSetupGate } from "@/components/admin/RevenueSetupGate";
import { fetchJson } from "@/lib/admin/fetchJson";
import { REVENUE_STAGE_META, type RevenueStage } from "@/lib/revenue-os/types";

type Item = Record<string, unknown> & { id: string };
interface RecordModel {
  contract: string;
  activityContract: string;
  opportunity: Item & {
    name: string | null;
    email: string | null;
    canonical_stage: RevenueStage | null;
    stage: string;
    source: string | null;
    next_action: string | null;
    next_action_at: string | null;
    estimated_value: number;
    won_value: number;
    probability: number;
    created_at: string;
    updated_at: string;
  };
  contact: (Item & { full_name: string; primary_email: string | null; phone: string | null; title: string | null; lifecycle_stage: string; communication_status: string }) | null;
  company: (Item & { name: string; domain: string | null; website: string | null; industry: string | null; size_band: string | null; location: string | null; research_summary: string | null }) | null;
  tasks: Item[];
  conversations: Item[];
  meetings: Item[];
  proposals: Item[];
  activity: Array<Item & { activity_type: string; title: string; summary: string | null; source: string; actor_email: string | null; occurred_at: string }>;
}

function money(value: unknown) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function dateTime(value: unknown) {
  if (!value || Number.isNaN(Date.parse(String(value)))) return "Not scheduled";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(String(value)));
}

function localInputValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function Section({ id, title, count, children }: { id?: string; title: string; count?: number; children: React.ReactNode }) {
  return (
    <details id={id} open className="group scroll-mt-24 rounded-[20px] bg-[var(--admin-surface)] shadow-[var(--admin-shadow-border)]">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-[20px] px-4 text-sm font-semibold text-[var(--admin-ink)] outline-none transition-[box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-[var(--admin-ink)]/25 active:scale-[0.99] sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">{title}{count !== undefined && <span className="rounded-full bg-black/[0.05] px-2 py-0.5 font-mono text-[9px] tabular-nums text-[var(--admin-muted)] dark:bg-white/[0.07]">{count}</span>}</span>
        <ChevronDown className="size-4 text-[var(--admin-muted)] transition-transform duration-150 group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4 sm:px-5 sm:pb-5">{children}</div>
    </details>
  );
}

export default function OpportunityRecordPage() {
  const { id } = useParams<{ id: string }>();
  const ai = useAdminAI();
  const [record, setRecord] = useState<RecordModel | null>(null);
  const [schemaReady, setSchemaReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson<{ schemaReady: boolean; record: RecordModel | null }>(`/api/admin/revenue-os/records/opportunity/${encodeURIComponent(id)}`);
      setSchemaReady(data.schemaReady);
      setRecord(data.record);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load the opportunity record.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const openTasks = useMemo(() => record?.tasks.filter((task) => task.status !== "completed") ?? [], [record]);

  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved("");
    const form = new FormData(event.currentTarget);
    try {
      const data = await fetchJson<{ record: RecordModel }>(`/api/admin/revenue-os/records/opportunity/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nextAction: String(form.get("nextAction") || ""),
          nextActionAt: form.get("nextActionAt") ? new Date(String(form.get("nextActionAt"))).toISOString() : null,
          estimatedValue: Number(form.get("estimatedValue")),
          expectedUpdatedAt: opportunity.updated_at,
        }),
      });
      setRecord(data.record);
      setSaved("Revenue plan saved and dependent views refreshed.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the revenue plan.");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !record) return <div className="grid min-h-[55vh] place-items-center"><Loader2 className="size-6 animate-spin text-[var(--admin-muted)]" /></div>;
  if (!schemaReady) return <RevenueSetupGate />;
  if (!record) return (
    <div className="space-y-5">
      <PageHeader title="Opportunity record" subtitle="The canonical record could not be loaded." />
      <AdminSurface tone="attention" className="space-y-4 text-center">
        <TriangleAlert className="mx-auto size-6 text-rose-600" />
        <p className="text-sm text-[var(--admin-ink)]">{error || "Opportunity not found."}</p>
        <button type="button" onClick={() => void load()} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-xs font-semibold text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] transition-[box-shadow,transform] active:scale-[0.96]"><RefreshCw className="size-4" /> Retry</button>
      </AdminSurface>
    </div>
  );

  const opportunity = record.opportunity;
  const stage = opportunity.canonical_stage ?? "new";
  return (
    <div className="space-y-5 pb-12">
      <Link href="/admin/pipeline" className="inline-flex min-h-10 items-center gap-2 rounded-xl pr-3 text-xs font-semibold text-[var(--admin-muted)] transition-[color,transform] duration-150 hover:text-[var(--admin-ink)] active:scale-[0.96]"><ArrowLeft className="size-4" /> Back to Pipeline</Link>
      <PageHeader
        title={opportunity.name || record.company?.name || "Untitled opportunity"}
        subtitle="One operating view for identity, commitments, communication, meetings, proposals, and verified history."
        actions={<div className="flex items-center gap-2"><button type="button" onClick={() => ai.openWithPrompt(`Review opportunity ${opportunity.name || record.company?.name || id}. Summarize the latest activity, identify risks, and recommend the next best action.`)} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3.5 text-xs font-semibold text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[0.96]"><Bot className="size-4" />Ask AI</button><button type="button" onClick={() => void load()} disabled={loading} className="grid size-11 place-items-center rounded-xl text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[0.96]"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /><span className="sr-only">Refresh record</span></button></div>}
      />

      {error && <AdminSurface tone="attention" className="flex items-start gap-3"><TriangleAlert className="mt-0.5 size-5 shrink-0 text-rose-600" /><div><p className="text-sm font-semibold text-[var(--admin-ink)]">The last action did not complete</p><p className="admin-copy mt-1 text-xs">{error}</p></div></AdminSurface>}
      {saved && <AdminSurface className="flex items-center gap-3 bg-emerald-500/[0.055]"><CheckCircle2 className="size-5 shrink-0 text-emerald-600" /><p className="text-sm text-[var(--admin-ink)]" role="status">{saved}</p></AdminSurface>}

      <nav aria-label="Record context" className="flex snap-x gap-2 overflow-x-auto pb-1">
        {[{ href: "#opportunity", label: "Opportunity", icon: Target }, { href: "#contact", label: "Contact", icon: UserRound }, { href: "#company", label: "Company", icon: Building2 }, { href: "#activity", label: "Activity", icon: Clock3 }].map(({ href, label, icon: Icon }) => <a key={href} href={href} className="inline-flex min-h-10 shrink-0 snap-start items-center gap-2 rounded-xl px-3 text-xs font-semibold text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[0.96]"><Icon className="size-3.5" />{label}</a>)}
      </nav>

      <section id="opportunity" className="scroll-mt-24 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Stage", value: REVENUE_STAGE_META[stage].label, note: `${opportunity.probability}% probability`, icon: Target },
          { label: "Estimated value", value: money(opportunity.estimated_value), note: opportunity.won_value ? `${money(opportunity.won_value)} won` : "Current estimate", icon: CircleDollarSign },
          { label: "Next action", value: opportunity.next_action || "Not set", note: dateTime(opportunity.next_action_at), icon: CalendarClock },
          { label: "Open work", value: openTasks.length, note: `${record.conversations.length} conversations · ${record.meetings.length} meetings`, icon: CheckCircle2 },
        ].map(({ label, value, note, icon: Icon }) => <AdminSurface key={label} padding="lg"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="admin-eyebrow">{label}</p><p className="mt-3 break-words text-xl font-semibold tabular-nums tracking-[-0.035em] text-[var(--admin-ink)]">{value}</p><p className="admin-copy mt-1 text-xs tabular-nums">{note}</p></div><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-black/[0.045] dark:bg-white/[0.06]"><Icon className="size-4" /></span></div></AdminSurface>)}
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="space-y-4">
          <Section id="activity" title="Verified activity" count={record.activity.length}>
            {record.activity.length ? <ol className="relative space-y-1 before:absolute before:bottom-4 before:left-[15px] before:top-4 before:w-px before:bg-[var(--admin-border)]">{record.activity.map((item) => <li key={item.id} className="relative grid grid-cols-[32px_minmax(0,1fr)] gap-3 py-3"><span className="relative z-10 mt-1 grid size-8 place-items-center rounded-xl bg-[var(--admin-surface)] shadow-[var(--admin-shadow-border)]"><Clock3 className="size-3.5 text-[var(--admin-muted)]" /></span><div><div className="flex flex-wrap items-baseline justify-between gap-x-3"><p className="text-sm font-semibold text-[var(--admin-ink)]">{item.title}</p><time className="font-mono text-[10px] tabular-nums text-[var(--admin-muted)]">{dateTime(item.occurred_at)}</time></div>{item.summary && <p className="admin-copy mt-1 text-xs text-pretty">{item.summary}</p>}<p className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--admin-muted)]">{item.source.replaceAll("_", " ")}</p></div></li>)}</ol> : <p className="admin-copy rounded-xl bg-[var(--admin-surface-subtle)] p-4 text-sm">No verified activity has been recorded for this opportunity yet.</p>}
          </Section>

          <Section title="Related work" count={record.tasks.length + record.conversations.length + record.meetings.length + record.proposals.length}>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { title: "Tasks", icon: CheckCircle2, items: record.tasks, href: "/admin/tasks", line: (item: Item) => `${item.status || "pending"}${item.due_date ? ` · ${dateTime(item.due_date)}` : ""}` },
                { title: "Conversations", icon: MessageSquareText, items: record.conversations, href: "/admin/conversations", line: (item: Item) => `${item.channel || "message"} · ${item.status || "open"}` },
                { title: "Meetings", icon: CalendarClock, items: record.meetings, href: "/admin/bookings", line: (item: Item) => dateTime(item.start_at) },
                { title: "Proposals", icon: FileText, items: record.proposals, href: "/admin/proposals", line: (item: Item) => `${item.status || "draft"} · ${money(Number(item.total_one_time || 0) + Number(item.total_monthly || 0))}` },
              ].map(({ title, icon: Icon, items, href, line }) => <div key={title} className="rounded-2xl bg-[var(--admin-surface-subtle)] p-4"><div className="flex items-center justify-between"><p className="flex items-center gap-2 text-xs font-semibold text-[var(--admin-ink)]"><Icon className="size-4" />{title}</p><Link href={href} className="grid size-10 place-items-center rounded-xl text-[var(--admin-muted)] transition-[color,transform] hover:text-[var(--admin-ink)] active:scale-[0.96]"><ArrowUpRight className="size-4" /><span className="sr-only">Open {title}</span></Link></div>{items.length ? <ul className="mt-2 divide-y divide-[var(--admin-border)]">{items.slice(0, 4).map((item) => <li key={item.id} className="py-2.5"><p className="truncate text-xs font-semibold text-[var(--admin-ink)]">{String(item.title || item.subject || "Untitled")}</p><p className="admin-copy mt-0.5 text-[10px] capitalize tabular-nums">{line(item)}</p></li>)}</ul> : <p className="admin-copy mt-3 text-xs">None linked yet.</p>}</div>)}
            </div>
          </Section>
        </div>

        <aside className="space-y-4">
          <Section title="Revenue plan">
            <form onSubmit={(event) => void savePlan(event)} className="space-y-4">
              <label className="block text-xs font-semibold text-[var(--admin-ink)]">Estimated value<input name="estimatedValue" type="number" min="0" max="1000000000" defaultValue={opportunity.estimated_value ?? 0} key={`value-${opportunity.estimated_value}`} className="mt-1.5 min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-3.5 text-sm tabular-nums outline-none transition-[border-color,box-shadow] focus:border-[var(--admin-ink)] focus:ring-2 focus:ring-[var(--admin-ink)]/10" /></label>
              <label className="block text-xs font-semibold text-[var(--admin-ink)]">Next action<textarea name="nextAction" maxLength={500} rows={3} defaultValue={opportunity.next_action || ""} key={`action-${opportunity.next_action}`} placeholder="State the concrete next commitment" className="mt-1.5 w-full resize-y rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-3.5 py-3 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-[var(--admin-muted)]/70 focus:border-[var(--admin-ink)] focus:ring-2 focus:ring-[var(--admin-ink)]/10" /></label>
              <label className="block text-xs font-semibold text-[var(--admin-ink)]">Due at<input name="nextActionAt" type="datetime-local" defaultValue={localInputValue(opportunity.next_action_at)} key={`date-${opportunity.next_action_at}`} className="mt-1.5 min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-3.5 text-sm tabular-nums outline-none transition-[border-color,box-shadow] focus:border-[var(--admin-ink)] focus:ring-2 focus:ring-[var(--admin-ink)]/10" /></label>
              <button type="submit" disabled={saving} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--admin-ink)] px-4 text-xs font-semibold text-[var(--admin-surface)] transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.96] disabled:opacity-50">{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save revenue plan</button>
            </form>
          </Section>

          <Section id="contact" title="Contact">
            {record.contact ? <div className="space-y-3"><div><p className="text-sm font-semibold text-[var(--admin-ink)]">{record.contact.full_name}</p><p className="admin-copy mt-0.5 text-xs">{record.contact.title || "Role not recorded"}</p></div>{record.contact.primary_email && <a href={`mailto:${record.contact.primary_email}`} className="flex min-h-10 items-center gap-2 rounded-xl px-2 text-xs text-[var(--admin-ink)] transition-[background-color,transform] hover:bg-[var(--admin-surface-subtle)] active:scale-[0.96]"><Mail className="size-4 text-[var(--admin-muted)]" />{record.contact.primary_email}</a>}<div className="flex flex-wrap gap-2"><span className="rounded-full bg-black/[0.05] px-2.5 py-1 text-[10px] font-semibold capitalize text-[var(--admin-muted)] dark:bg-white/[0.07]">{record.contact.lifecycle_stage}</span><span className="rounded-full bg-black/[0.05] px-2.5 py-1 text-[10px] font-semibold capitalize text-[var(--admin-muted)] dark:bg-white/[0.07]">{record.contact.communication_status}</span></div>{record.contact.primary_email && <Link href={`/admin/contacts/${encodeURIComponent(record.contact.primary_email)}`} className="inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-[var(--admin-ink)]">Open contact history <ArrowUpRight className="size-3.5" /></Link>}</div> : <p className="admin-copy text-xs">No canonical contact is linked.</p>}
          </Section>

          <Section id="company" title="Company">
            {record.company ? <div className="space-y-3"><div><p className="text-sm font-semibold text-[var(--admin-ink)]">{record.company.name}</p><p className="admin-copy mt-0.5 text-xs">{[record.company.industry, record.company.location].filter(Boolean).join(" · ") || "Company details pending"}</p></div>{record.company.research_summary && <p className="admin-copy text-pretty text-xs">{record.company.research_summary}</p>}{record.company.website && <a href={record.company.website.startsWith("http") ? record.company.website : `https://${record.company.website}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-[var(--admin-ink)]">Open website <ArrowUpRight className="size-3.5" /></a>}</div> : <p className="admin-copy text-xs">No canonical company is linked.</p>}
          </Section>
        </aside>
      </div>
    </div>
  );
}
