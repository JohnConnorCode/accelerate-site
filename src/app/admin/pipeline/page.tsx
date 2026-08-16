"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Building2, CalendarClock, CircleDollarSign, Filter, Loader2, Mail, Plus, RefreshCw, Search, Target, TriangleAlert, X } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { RevenueSetupGate } from "@/components/admin/RevenueSetupGate";
import { fetchJson } from "@/lib/admin/fetchJson";
import { REVENUE_STAGE_META, REVENUE_STAGES, type RevenueStage } from "@/lib/revenue-os/types";
import { cn } from "@/lib/utils";

interface Opportunity {
  id: string; name: string | null; email: string | null; stage: string; canonical_stage: RevenueStage | null; estimated_value: number; won_value: number; probability: number; next_action: string | null; next_action_at: string | null; source: string | null; created_at: string;
  contact?: { full_name: string; primary_email: string | null; phone: string | null; title: string | null } | null;
  company?: { name: string; domain: string | null; industry: string | null; website: string | null } | null;
}

function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0); }

const stageTone: Record<RevenueStage, string> = {
  new: "bg-black/[0.05] text-[var(--admin-muted)] dark:bg-white/[0.07]",
  contacted: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  qualified: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  meeting: "bg-amber-500/12 text-amber-800 dark:text-amber-300",
  proposal: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  negotiation: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
  won: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  lost: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  nurture: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

export default function PipelinePage() {
  const [data, setData] = useState<{ schemaReady: boolean; opportunities: Opportunity[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try { setData(await fetchJson("/api/admin/revenue-os/pipeline")); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Could not load pipeline."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => (data?.opportunities ?? []).filter((item) => {
    const canonical = item.canonical_stage ?? item.stage;
    if (stage !== "all" && canonical !== stage) return false;
    const haystack = [item.name, item.email, item.contact?.full_name, item.company?.name, item.company?.domain].filter(Boolean).join(" ").toLowerCase();
    return !search.trim() || haystack.includes(search.trim().toLowerCase());
  }), [data, search, stage]);

  const metrics = useMemo(() => {
    const items = data?.opportunities ?? [];
    const open = items.filter((item) => !["won", "lost"].includes(item.canonical_stage ?? item.stage));
    return { open: open.length, value: open.reduce((sum, item) => sum + Number(item.estimated_value || 0), 0), proposals: items.filter((item) => ["proposal", "negotiation"].includes(item.canonical_stage ?? item.stage)).length, won: items.reduce((sum, item) => sum + Number(item.won_value || 0), 0) };
  }, [data]);

  const updateStage = async (item: Opportunity, next: RevenueStage) => {
    const lossReason = next === "lost" ? window.prompt("Why was this opportunity lost?")?.trim() : undefined;
    if (next === "lost" && !lossReason) return;
    setSaving(true);
    try {
      await fetchJson("/api/admin/revenue-os/pipeline", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, stage: next, lossReason, reason: "Founder pipeline update" }) });
      await load();
    } catch (updateError) { setError(updateError instanceof Error ? updateError.message : "Could not move opportunity."); }
    finally { setSaving(false); }
  };

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    try {
      await fetchJson("/api/admin/revenue-os/pipeline", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
      setShowCreate(false);
      await load();
    } catch (createError) { setError(createError instanceof Error ? createError.message : "Could not create opportunity."); }
    finally { setSaving(false); }
  };

  if (loading && !data) return <div className="grid min-h-[55vh] place-items-center"><Loader2 className="size-6 animate-spin text-[var(--admin-muted)]" /></div>;
  return (
    <div className="space-y-6 pb-10">
      <PageHeader title="Pipeline" subtitle="One revenue pipeline for inbound and outbound, from first signal through won client." actions={<><button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh pipeline" className="grid size-11 place-items-center rounded-xl text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[0.96]"><RefreshCw className={cn("size-4", loading && "animate-spin")} /></button><button type="button" onClick={() => setShowCreate(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--admin-ink)] pl-4 pr-3.5 text-xs font-semibold text-[var(--admin-surface)] transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.96]"><Plus className="size-3.5" /> New opportunity</button></>} />
      {error && <AdminSurface tone="attention" className="flex items-center gap-3"><TriangleAlert className="size-5 shrink-0 text-rose-600" /><p className="text-sm text-[var(--admin-ink)]">{error}</p></AdminSurface>}
      {data && !data.schemaReady ? <RevenueSetupGate /> : data && <>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[{ label: "Open", value: metrics.open, note: "Active opportunities", icon: Target }, { label: "Pipeline value", value: money(metrics.value), note: "Unweighted", icon: CircleDollarSign }, { label: "At proposal", value: metrics.proposals, note: "Proposal or negotiation", icon: CalendarClock }, { label: "Won revenue", value: money(metrics.won), note: "Recorded outcomes", icon: Building2 }].map(({ label, value, note, icon: Icon }) => <AdminSurface key={label} padding="lg"><div className="flex items-start justify-between gap-3"><div><p className="admin-eyebrow">{label}</p><p className="mt-3 text-3xl font-semibold tabular-nums tracking-[-0.045em] text-[var(--admin-ink)]">{value}</p><p className="admin-copy mt-1 text-xs">{note}</p></div><span className="grid size-9 place-items-center rounded-xl bg-black/[0.045] text-[var(--admin-ink)] dark:bg-white/[0.06]"><Icon className="size-4" /></span></div></AdminSurface>)}
        </section>

        <AdminSurface padding="none" className="overflow-hidden">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="relative min-w-0 flex-1 sm:max-w-sm"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--admin-muted)]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search company, person, or email" className="min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] pl-10 pr-3.5 text-sm text-[var(--admin-ink)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--admin-muted)]/70 focus:border-[var(--admin-ink)] focus:ring-2 focus:ring-[var(--admin-ink)]/10" /></div>
            <div className="flex items-center gap-2"><Filter className="size-4 text-[var(--admin-muted)]" /><select value={stage} onChange={(event) => setStage(event.target.value)} className="min-h-11 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-xs font-semibold text-[var(--admin-ink)] outline-none focus:border-[var(--admin-ink)]"><option value="all">All stages</option>{REVENUE_STAGES.map((value) => <option key={value} value={value}>{REVENUE_STAGE_META[value].label}</option>)}</select><span className="rounded-full bg-black/[0.045] px-2.5 py-1 font-mono text-[10px] tabular-nums text-[var(--admin-muted)] dark:bg-white/[0.06]">{filtered.length}</span></div>
          </div>
          <div className="overflow-x-auto border-t border-[var(--admin-border)]">
            <table className="w-full min-w-[1040px] text-left text-sm"><thead className="bg-black/[0.018] font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--admin-muted)] dark:bg-white/[0.018]"><tr><th className="px-5 py-3.5">Opportunity</th><th className="px-4 py-3.5">Contact</th><th className="px-4 py-3.5">Source</th><th className="px-4 py-3.5 text-right">Value</th><th className="px-4 py-3.5">Next action</th><th className="px-5 py-3.5">Stage</th></tr></thead><tbody className="divide-y divide-[var(--admin-border)]">
              {filtered.map((item) => { const canonical = item.canonical_stage ?? "new"; return <tr key={item.id} className="transition-[background-color] duration-150 hover:bg-black/[0.018] dark:hover:bg-white/[0.018]"><td className="px-5 py-4"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-black/[0.045] text-[var(--admin-muted)] dark:bg-white/[0.06]"><Building2 className="size-4" /></span><div><p className="font-semibold text-[var(--admin-ink)]">{item.name || item.company?.name || "Untitled opportunity"}</p><p className="admin-copy mt-0.5 text-xs">{item.company?.industry || item.company?.domain || "Company details pending"}</p></div></div></td><td className="px-4 py-4"><p className="text-sm text-[var(--admin-ink)]">{item.contact?.full_name || item.email || "Unknown"}</p>{(item.contact?.primary_email || item.email) && <p className="admin-copy mt-0.5 flex items-center gap-1 text-xs"><Mail className="size-3" />{item.contact?.primary_email || item.email}</p>}</td><td className="px-4 py-4 text-xs capitalize text-[var(--admin-muted)]">{item.source || "Unknown"}</td><td className="px-4 py-4 text-right font-mono text-sm tabular-nums text-[var(--admin-ink)]">{money(item.estimated_value)}</td><td className="max-w-[240px] px-4 py-4"><p className="truncate text-xs text-[var(--admin-ink)]">{item.next_action || "Set next action"}</p><p className="admin-copy mt-0.5 text-[10px] tabular-nums">{item.next_action_at ? new Date(item.next_action_at).toLocaleDateString() : "No date"}</p></td><td className="px-5 py-4"><select value={canonical} disabled={saving} onChange={(event) => void updateStage(item, event.target.value as RevenueStage)} className={cn("min-h-10 rounded-xl border-0 px-3 text-xs font-semibold outline-none ring-1 ring-inset ring-black/5 transition-[opacity,box-shadow] duration-150 focus:ring-2 focus:ring-[var(--admin-ink)]/35 dark:ring-white/10", stageTone[canonical])}>{REVENUE_STAGES.map((value) => <option key={value} value={value}>{REVENUE_STAGE_META[value].label}</option>)}</select></td></tr>; })}
              {!filtered.length && <tr><td colSpan={6} className="px-6 py-16 text-center"><Target className="mx-auto size-5 text-[var(--admin-muted)]" /><p className="mt-3 text-sm font-semibold text-[var(--admin-ink)]">No matching opportunities</p><p className="admin-copy mt-1 text-xs">Adjust the filters or create the first opportunity.</p></td></tr>}
            </tbody></table>
          </div>
        </AdminSurface>
      </>}

      {showCreate && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="new-opportunity-title"><form onSubmit={(event) => void create(event)} className="w-full max-w-lg rounded-3xl bg-[var(--admin-surface)] p-2 shadow-2xl"><div className="rounded-[20px] p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="admin-eyebrow">Pipeline</p><h2 id="new-opportunity-title" className="mt-1 text-balance text-xl font-semibold tracking-[-0.03em] text-[var(--admin-ink)]">New opportunity</h2><p className="admin-copy mt-1 text-pretty text-sm">Creates or resolves the contact and company before opening the opportunity.</p></div><button type="button" onClick={() => setShowCreate(false)} aria-label="Close" className="grid size-10 place-items-center rounded-xl text-[var(--admin-muted)] transition-[background-color,color,transform] duration-150 hover:bg-black/[0.04] hover:text-[var(--admin-ink)] active:scale-[0.96] dark:hover:bg-white/[0.05]"><X className="size-4" /></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2">{[{ name: "name", label: "Contact name", type: "text", required: true }, { name: "email", label: "Email", type: "email", required: true }, { name: "companyName", label: "Company", type: "text", required: false }, { name: "website", label: "Website", type: "text", required: false }, { name: "estimatedValue", label: "Estimated value", type: "number", required: false }, { name: "nextActionAt", label: "Next action date", type: "datetime-local", required: false }].map((field) => <label key={field.name} className="text-xs font-semibold text-[var(--admin-ink)]">{field.label}<input name={field.name} type={field.type} required={field.required} min={field.type === "number" ? "0" : undefined} className="mt-1.5 min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-3.5 text-sm font-normal text-[var(--admin-ink)] outline-none transition-[border-color,box-shadow] duration-150 focus:border-[var(--admin-ink)] focus:ring-2 focus:ring-[var(--admin-ink)]/10" /></label>)}</div><label className="mt-4 block text-xs font-semibold text-[var(--admin-ink)]">Next action<input name="nextAction" type="text" placeholder="Send audit follow-up" className="mt-1.5 min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-3.5 text-sm font-normal text-[var(--admin-ink)] outline-none transition-[border-color,box-shadow] duration-150 focus:border-[var(--admin-ink)] focus:ring-2 focus:ring-[var(--admin-ink)]/10" /></label><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setShowCreate(false)} className="min-h-11 rounded-xl px-4 text-xs font-semibold text-[var(--admin-muted)] transition-[color,transform] duration-150 hover:text-[var(--admin-ink)] active:scale-[0.96]">Cancel</button><button type="submit" disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--admin-ink)] px-4 text-xs font-semibold text-[var(--admin-surface)] transition-[opacity,transform] duration-150 active:scale-[0.96] disabled:opacity-50">{saving && <Loader2 className="size-3.5 animate-spin" />} Create opportunity</button></div></div></form></div>}
    </div>
  );
}
