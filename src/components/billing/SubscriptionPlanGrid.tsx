"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatPlanInterval, formatPlanPrice } from "@/lib/revenue-os/subscriptions-contract";

type Plan = { id: string; name: string; description: string; currency: string; interval: string; amount: number };

export function SubscriptionPlanGrid({ tenantSlug, plans }: { tenantSlug: string; plans: Plan[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();
  async function choose(planId: string) {
    setBusy(planId);
    setError("");
    try {
      const response = await fetch(`/api/public/${tenantSlug}/billing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkout", planId, requestId: crypto.randomUUID() }),
      });
      const result = await response.json();
      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/t/${tenantSlug}/subscribe`)}`);
        return;
      }
      if (!response.ok) throw new Error(result.error || "Checkout could not start");
      if (result.url) window.location.assign(result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checkout could not start");
      setBusy(null);
    }
  }
  if (!plans.length)
    return <p className="rounded-2xl bg-[var(--admin-surface-subtle)] p-6 text-sm">No plans are available yet. Check back soon.</p>;
  return (
    <div>
      {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <article key={plan.id} className="flex flex-col rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold tracking-tight">{plan.name}</h2>
            <p className="mt-2 min-h-12 text-sm leading-6 text-black/60">{plan.description || "A clear recurring service plan for your business."}</p>
            <p className="mt-6 text-3xl font-semibold tabular-nums">{formatPlanPrice(plan.amount, plan.currency)}<span className="text-sm font-normal text-black/50"> / {formatPlanInterval(plan.interval)}</span></p>
            <button type="button" onClick={() => void choose(plan.id)} disabled={busy !== null} className="mt-6 min-h-11 rounded-xl bg-black px-4 text-sm font-semibold text-white transition-transform hover:opacity-85 active:scale-[0.96] disabled:opacity-50">
              {busy === plan.id ? "Opening secure checkout…" : "Continue to secure checkout"}
            </button>
          </article>
        ))}
      </div>
      <p className="mt-5 text-sm leading-6 text-black/55">Plans renew automatically. Payment details are handled by Stripe, and you can change or cancel at your next renewal from your account. <Link className="font-semibold underline" href="/docs/workspace/customer-billing">Billing help</Link>.</p>
    </div>
  );
}
