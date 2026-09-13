"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  formatPlanInterval,
  formatPlanPrice,
  stripeHostedUrl,
} from "@/lib/revenue-os/subscriptions-contract";

type Plan = {
  id: string;
  name: string;
  description: string;
  currency: string;
  interval: string;
  amount: number;
};

function checkoutError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("disabled"))
    return "Subscriptions are temporarily unavailable for this workspace. Please try again later or contact billing support.";
  if (normalized.includes("no longer available"))
    return "That plan is no longer available. Refresh the page to see the current plans.";
  if (normalized.includes("connect stripe"))
    return "Checkout is being prepared for this workspace. Please try again later.";
  return "Checkout could not start. Please try again, or contact billing support if the problem continues.";
}

export function SubscriptionPlanGrid({
  tenantSlug,
  plans,
  billingEnabled = true,
  plansAvailable = true,
}: {
  tenantSlug: string;
  plans: Plan[];
  billingEnabled?: boolean;
  plansAvailable?: boolean;
}) {
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
        router.push(
          `/login?tenant=${encodeURIComponent(tenantSlug)}&next=${encodeURIComponent(`/t/${tenantSlug}/subscribe`)}`,
        );
        return;
      }
      if (!response.ok) throw new Error(result.error || "Checkout could not start");
      if (!stripeHostedUrl(result.url, "checkout.stripe.com"))
        throw new Error("Stripe did not return a secure checkout link");
      window.location.assign(result.url);
    } catch (cause) {
      setError(checkoutError(cause instanceof Error ? cause.message : ""));
      setBusy(null);
    }
  }
  if (!plansAvailable)
    return (
      <p
        role="status"
        className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm leading-6 text-amber-950"
      >
        Plans are temporarily unavailable. Refresh the page and try again, or contact billing
        support if the problem continues.
      </p>
    );
  if (!billingEnabled)
    return (
      <p className="rounded-2xl border border-[color-mix(in_srgb,var(--billing-ink)_12%,transparent)] bg-white/75 p-6 text-sm leading-6 shadow-sm">
        Subscription plans are being prepared for this workspace. Please check back soon.
      </p>
    );
  if (!plans.length)
    return (
      <p className="rounded-2xl border border-[color-mix(in_srgb,var(--billing-ink)_12%,transparent)] bg-white/75 p-6 text-sm leading-6 shadow-sm">
        No plans are available yet. Check back soon, or contact billing support if you expected to
        see an option.
      </p>
    );
  return (
    <div>
      {error && (
        <p
          role="alert"
          className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"
        >
          {error}
        </p>
      )}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <article
            key={plan.id}
            className="flex flex-col rounded-2xl border border-[color-mix(in_srgb,var(--billing-ink)_13%,transparent)] bg-white p-6 shadow-[0_12px_28px_-22px_rgba(0,0,0,0.5)] transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[0_20px_38px_-24px_rgba(0,0,0,0.5)]"
          >
            <h2 className="text-xl font-semibold tracking-tight">{plan.name}</h2>
            <p className="mt-2 min-h-12 text-sm leading-6 text-[color-mix(in_srgb,var(--billing-ink)_65%,transparent)]">
              {plan.description || "A clear recurring service plan for your business."}
            </p>
            <p className="mt-6 text-3xl font-semibold tabular-nums">
              {formatPlanPrice(plan.amount, plan.currency)}
              <span className="text-sm font-normal text-[color-mix(in_srgb,var(--billing-ink)_54%,transparent)]">
                {" "}
                / {formatPlanInterval(plan.interval)}
              </span>
            </p>
            <button
              type="button"
              onClick={() => void choose(plan.id)}
              disabled={busy !== null}
              className="mt-6 min-h-12 rounded-xl bg-[var(--billing-accent)] px-4 text-sm font-semibold text-[var(--billing-accent-ink)] transition-[opacity,transform] hover:opacity-85 active:scale-[0.98] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--billing-accent)] focus-visible:ring-offset-2"
            >
              {busy === plan.id ? "Opening secure checkout…" : "Continue to secure checkout"}
            </button>
          </article>
        ))}
      </div>
      <p className="mt-5 text-sm leading-6 text-[color-mix(in_srgb,var(--billing-ink)_60%,transparent)]">
        Plans renew automatically at the interval shown. Payment details are handled by Stripe; you
        can change or cancel at your next renewal from your account.{" "}
        <Link
          className="font-semibold underline underline-offset-4"
          href="/docs/workspace/customer-billing"
        >
          Billing help
        </Link>
        .
      </p>
    </div>
  );
}
