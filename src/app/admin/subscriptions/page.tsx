"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSurface } from "@/components/admin/AdminSurface";
import AdminLink from "@/components/admin/AdminLink";
import { formatPlanInterval, formatPlanPrice, subscriptionStatusPresentation } from "@/lib/revenue-os/subscriptions-contract";

type Plan = { id: string; name: string; description: string; currency: string; interval: string; amount: number; active: boolean };
type Subscription = { id: string; status: string; current_period_end: string | null; cancel_at_period_end: boolean; plan: { name: string; currency: string; interval: string; amount: number } | null; customer: { email: string; name: string } | null };
type Workspace = { plans: Plan[]; subscriptions: Subscription[] };

const field = "mt-2 min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm";
const button = "min-h-11 rounded-xl px-4 text-sm font-semibold transition-transform active:scale-[0.96] disabled:opacity-50";

function subscriptionTiming(subscription: Subscription) {
  const presentation = subscriptionStatusPresentation(subscription.status, subscription.cancel_at_period_end);
  const end = subscription.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : null;
  if (presentation.label === "Renews automatically" || presentation.label === "Trial in progress") return end ? `Renews ${end}` : "Renewal date unavailable";
  if (presentation.label === "Cancels at renewal") return end ? `Access through ${end}` : "Access end date unavailable";
  if (presentation.label === "Ended") return end ? `Ended ${end}` : "Subscription ended";
  if (presentation.label === "Payment needs attention") return end ? `Current period ends ${end}` : "Renewal needs attention";
  return presentation.label;
}

export default function SubscriptionsPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [currency, setCurrency] = useState("usd");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    const response = await fetch("/api/admin/subscriptions", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Subscriptions could not be read");
    setWorkspace(payload);
  }
  useEffect(() => { load().catch((cause) => setError(cause instanceof Error ? cause.message : "Subscriptions could not be read")); }, []);

  async function createPlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("create"); setError(""); setNotice("");
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) { setError("Enter a valid amount."); setBusy(""); return; }
    try {
      const response = await fetch("/api/admin/subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create_plan", requestId: crypto.randomUUID(), plan: { name, description, amount: Math.round(value * 100), currency, interval } }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Plan could not be created");
      setName(""); setDescription(""); setAmount(""); setNotice("Plan created in Stripe and this workspace."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Plan could not be created"); }
    finally { setBusy(""); }
  }

  async function archive(planId: string) {
    if (!window.confirm("Archive this plan? Existing subscriptions will continue; new checkouts will stop.")) return;
    setBusy(planId); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "archive_plan", requestId: crypto.randomUUID(), planId }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Plan could not be archived");
      setNotice("Plan archived."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Plan could not be archived"); }
    finally { setBusy(""); }
  }

  return <div className="space-y-7 pb-10"><PageHeader title="Subscriptions" subtitle="Create recurring plans and review customer subscription status." />{error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}{notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}<AdminSurface padding="lg"><h2 className="text-lg font-semibold">Create a plan</h2><p className="mt-1 text-sm text-[var(--admin-muted)]">Plans are created in Stripe with an idempotent request and saved to this workspace. Connect Stripe in <AdminLink className="font-semibold underline" href="/admin/integrations">Integrations</AdminLink> before creating your first plan.</p><form onSubmit={createPlan} className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-sm font-medium">Name<input className={field} value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required /></label><label className="text-sm font-medium">Price per interval<input className={field} value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="250" required /></label><label className="text-sm font-medium">Interval<select className={field} value={interval} onChange={(event) => setInterval(event.target.value as "month" | "year")}><option value="month">Monthly</option><option value="year">Annual</option></select></label><label className="text-sm font-medium">Currency<select className={field} value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="usd">USD</option><option value="eur">EUR</option><option value="gbp">GBP</option><option value="cad">CAD</option><option value="aud">AUD</option></select></label><label className="text-sm font-medium md:col-span-2">Description<textarea className="mt-2 min-h-24 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} /></label><div><button className={`${button} bg-[var(--admin-ink)] text-[var(--admin-surface)]`} disabled={busy !== ""}>{busy === "create" ? "Creating…" : "Create plan"}</button></div></form></AdminSurface><AdminSurface padding="none" className="overflow-hidden"><div className="border-b border-[var(--admin-border)] px-6 py-5"><h2 className="text-lg font-semibold">Plans</h2></div>{workspace?.plans.length ? <div className="divide-y divide-[var(--admin-border)]">{workspace.plans.map((plan) => <div key={plan.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-5"><div><p className="font-semibold">{plan.name} <span className="ml-2 rounded-full bg-[var(--admin-surface-subtle)] px-2 py-1 text-[10px] uppercase tracking-wider">{plan.active ? "Active" : "Archived"}</span></p><p className="mt-1 text-sm text-[var(--admin-muted)]">{formatPlanPrice(plan.amount, plan.currency)} / {formatPlanInterval(plan.interval)} · {plan.description || "No description"}</p></div>{plan.active && <button type="button" onClick={() => void archive(plan.id)} disabled={busy !== ""} className={`${button} border border-red-200 text-red-700`}>Archive</button>}</div>)}</div> : <p className="px-6 py-8 text-sm text-[var(--admin-muted)]">No plans yet.</p>}</AdminSurface><AdminSurface padding="none" className="overflow-hidden"><div className="border-b border-[var(--admin-border)] px-6 py-5"><h2 className="text-lg font-semibold">Customer subscriptions</h2></div>{workspace?.subscriptions.length ? <div className="divide-y divide-[var(--admin-border)]">{workspace.subscriptions.map((subscription) => { const presentation = subscriptionStatusPresentation(subscription.status, subscription.cancel_at_period_end); return <div key={subscription.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 text-sm"><div><p className="font-semibold">{subscription.customer?.name || subscription.customer?.email || "Customer"}</p><p className="mt-1 text-[var(--admin-muted)]">{subscription.plan?.name || "Plan unavailable"} · <span>{presentation.label}</span></p></div><p className="text-[var(--admin-muted)]">{subscriptionTiming(subscription)}</p></div>; })}</div> : <p className="px-6 py-8 text-sm text-[var(--admin-muted)]">No customer subscriptions yet.</p>}</AdminSurface></div>;
}
