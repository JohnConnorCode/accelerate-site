"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPlanPrice } from "@/lib/revenue-os/subscriptions-contract";

type Plan = { id: string; name: string; description?: string; currency: string; interval: string; amount: number };
type Billing = {
  customer: { email: string; name: string; stripe_customer_id: string } | null;
  plans: Plan[];
  subscriptions: Array<{
    id: string;
    stripe_subscription_id: string;
    status: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    pending_plan_id: string | null;
    plan: Plan | null;
  }>;
  invoices: Array<{ id: string; status: string; amountDue: number; currency: string; created: string | null; hostedInvoiceUrl: string | null }>;
  providerError: string | null;
};

export function AccountBilling({ tenantSlug, userEmail, userName, emailUpdates }: { tenantSlug: string; userEmail: string; userName: string; emailUpdates: boolean }) {
  const [data, setData] = useState<Billing | null>(null);
  const [name, setName] = useState(userName);
  const [billingEmails, setBillingEmails] = useState(emailUpdates);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<Record<string, string>>({});
  const router = useRouter();

  const load = useCallback(async () => {
    const response = await fetch(`/api/public/${tenantSlug}/billing`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Billing could not be read");
    setData(payload);
  }, [tenantSlug]);

  useEffect(() => {
    load().catch((cause) => setError(cause instanceof Error ? cause.message : "Billing could not be read"));
  }, [load]);

  async function act(action: "cancel" | "resume" | "change", subscriptionId: string) {
    setBusy(subscriptionId);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/public/${tenantSlug}/billing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, subscriptionId, planId: action === "change" ? selectedPlan[subscriptionId] : undefined, requestId: crypto.randomUUID() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Billing update failed");
      await load();
      setNotice(action === "cancel" ? "Your subscription will cancel at the next renewal." : action === "resume" ? "Your subscription will continue at the next renewal." : "Your plan change is scheduled for the next renewal.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Billing update failed");
    } finally {
      setBusy("");
    }
  }

  async function portal() {
    setBusy("portal");
    setError("");
    try {
      const response = await fetch(`/api/public/${tenantSlug}/billing/portal`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Payment settings unavailable");
      window.location.assign(payload.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Payment settings unavailable");
      setBusy("");
    }
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("profile");
    setError("");
    setNotice("");
    const result = await createClient().auth.updateUser({ data: { full_name: name.trim(), billing_emails: billingEmails } });
    if (result.error) setError(result.error.message);
    else setNotice("Profile saved.");
    setBusy("");
  }

  if (error && !data) return <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>;
  if (!data) return <p role="status" className="text-sm text-black/60">Loading your account…</p>;
  return (
    <div className="space-y-8">
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/10">
        <div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/50">Profile</p><p className="mt-2 text-sm text-black/60">{userEmail}</p></div><button type="button" onClick={() => void createClient().auth.signOut().then(() => router.replace("/login"))} className="text-sm font-semibold underline">Sign out</button></div>
        <form onSubmit={saveProfile} className="mt-5 flex flex-wrap items-end gap-3"><label className="min-w-56 flex-1 text-sm font-medium">Name<input className="mt-2 min-h-11 w-full rounded-xl border border-black/15 px-3" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={160} /></label><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={billingEmails} onChange={(event) => setBillingEmails(event.target.checked)} className="size-4 rounded" /> Billing emails</label><button type="submit" disabled={busy !== ""} className="min-h-11 rounded-xl bg-black px-4 text-sm font-semibold text-white disabled:opacity-50">{busy === "profile" ? "Saving…" : "Save profile"}</button></form>
      </section>
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/10"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/50">Billing account</p><p className="mt-2 text-sm">{data.customer?.email || "No billing account yet"}</p></div>{data.customer && <button type="button" onClick={() => void portal()} disabled={busy !== ""} className="min-h-11 rounded-xl border border-black/15 px-4 text-sm font-semibold hover:bg-black/5 disabled:opacity-50">{busy === "portal" ? "Opening…" : "Update payment method"}</button>}</section>
      <section><h2 className="text-xl font-semibold tracking-tight">Subscriptions</h2><div className="mt-4 space-y-4">{data.subscriptions.length ? data.subscriptions.map((subscription) => <article key={subscription.id} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/10"><div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="font-semibold">{subscription.plan?.name || "Subscription"}</h3><p className="mt-1 text-sm capitalize text-black/60">{subscription.status} · {subscription.plan ? `${formatPlanPrice(subscription.plan.amount, subscription.plan.currency)} / ${subscription.plan.interval}` : "Plan details unavailable"}</p></div><span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold">{subscription.cancel_at_period_end ? "Cancels at renewal" : "Renews"}</span></div><p className="mt-4 text-sm text-black/60">Next renewal: {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : "Not available"}</p>{subscription.pending_plan_id && <p className="mt-2 text-sm text-black/60">Plan change scheduled for the next renewal.</p>}<div className="mt-5 flex flex-wrap items-center gap-3">{subscription.cancel_at_period_end ? <button type="button" onClick={() => void act("resume", subscription.stripe_subscription_id)} disabled={busy !== ""} className="min-h-10 rounded-xl border border-black/15 px-4 text-sm font-semibold">Keep subscription</button> : <button type="button" onClick={() => void act("cancel", subscription.stripe_subscription_id)} disabled={busy !== ""} className="min-h-10 rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-700">Cancel at renewal</button>}{!subscription.pending_plan_id && data.plans.length > 1 && <><select aria-label="New plan" className="min-h-10 rounded-xl border border-black/15 bg-white px-3 text-sm" value={selectedPlan[subscription.stripe_subscription_id] || ""} onChange={(event) => setSelectedPlan((current) => ({ ...current, [subscription.stripe_subscription_id]: event.target.value }))}><option value="">Change plan…</option>{data.plans.filter((plan) => plan.id !== subscription.plan?.id).map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {formatPlanPrice(plan.amount, plan.currency)}/{plan.interval}</option>)}</select>{selectedPlan[subscription.stripe_subscription_id] && <button type="button" onClick={() => void act("change", subscription.stripe_subscription_id)} disabled={busy !== ""} className="min-h-10 rounded-xl border border-black/15 px-4 text-sm font-semibold">Schedule change</button>}</>}</div></article>) : <p className="rounded-2xl bg-white p-6 text-sm text-black/60 shadow-sm ring-1 ring-black/10">No subscriptions yet. <a className="font-semibold underline" href={`/t/${tenantSlug}/subscribe`}>View plans</a>.</p>}</div></section>
      <section><h2 className="text-xl font-semibold tracking-tight">Invoices</h2>{data.providerError && <p className="mt-3 text-sm text-black/60">{data.providerError}</p>}<div className="mt-4 divide-y divide-black/10 rounded-2xl bg-white shadow-sm ring-1 ring-black/10">{data.invoices.length ? data.invoices.map((invoice) => <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"><span>{invoice.created ? new Date(invoice.created).toLocaleDateString() : "Invoice"}</span><span className="tabular-nums">{formatPlanPrice(invoice.amountDue || 0, invoice.currency || "usd")}</span><span className="capitalize text-black/60">{invoice.status}</span>{invoice.hostedInvoiceUrl && <a className="font-semibold underline" href={invoice.hostedInvoiceUrl}>View</a>}</div>) : <p className="p-6 text-sm text-black/60">No invoices yet.</p>}</div></section>
    </div>
  );
}
