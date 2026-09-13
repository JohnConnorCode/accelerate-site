"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  formatPlanInterval,
  formatPlanPrice,
  stripeHostedUrl,
  subscriptionStatusPresentation,
} from "@/lib/revenue-os/subscriptions-contract";

type Plan = {
  id: string;
  name: string;
  description?: string;
  currency: string;
  interval: string;
  amount: number;
};

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
    pending_change_at: string | null;
    plan: Plan | null;
  }>;
  invoices: Array<{
    id: string;
    status: string;
    amountDue: number;
    amountPaid?: number;
    currency: string;
    created: string | null;
    hostedInvoiceUrl: string | null;
  }>;
  providerError: string | null;
};

function statusStyle(tone: ReturnType<typeof subscriptionStatusPresentation>["tone"]) {
  if (tone === "danger") return "bg-red-50 text-red-800";
  if (tone === "warning") return "bg-amber-100 text-amber-950";
  if (tone === "neutral")
    return "bg-[color-mix(in_srgb,var(--billing-ink)_8%,transparent)] text-[color-mix(in_srgb,var(--billing-ink)_70%,transparent)]";
  return "bg-emerald-50 text-emerald-900";
}

function localDate(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Not available";
}

function periodText(status: string, cancelling: boolean, value: string | null) {
  if (cancelling)
    return value ? `Access through: ${localDate(value)}` : "Access end date is not available.";
  if (status === "active" || status === "trialing")
    return value ? `Renews on: ${localDate(value)}` : "Renewal date is not available.";
  if (status === "past_due" || status === "unpaid")
    return value
      ? `Current period ends: ${localDate(value)}`
      : "The renewal date is unavailable while payment needs attention.";
  if (status === "incomplete") return "Finish checkout to activate this subscription.";
  if (status === "canceled" || status === "incomplete_expired")
    return value ? `Ended on: ${localDate(value)}` : "This subscription has ended.";
  return value ? `Current period ends: ${localDate(value)}` : "Renewal date is unavailable.";
}

function invoiceLabel(status: string) {
  if (status === "paid") return "Paid";
  if (status === "open") return "Due";
  if (status === "uncollectible") return "Needs attention";
  if (status === "void") return "Voided";
  if (status === "draft") return "Processing";
  return "Status unavailable";
}

function billingError(message: string, fallback: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("sign in"))
    return "Your session has expired. Sign in again to view billing.";
  if (normalized.includes("temporarily unavailable") || normalized.includes("could not be read"))
    return "We could not load your billing details. Refresh the page and try again.";
  if (normalized.includes("no billing account"))
    return "Payment settings will be available after your first checkout.";
  if (normalized.includes("not found"))
    return "That subscription is no longer available in this account. Refresh to see the latest status.";
  return fallback;
}

export function AccountBilling({
  tenantSlug,
  userEmail,
  userName,
  emailUpdates,
}: {
  tenantSlug: string;
  userEmail: string;
  userName: string;
  emailUpdates: boolean;
}) {
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
    if (!response.ok)
      throw new Error(billingError(payload.error || "", "Billing could not be read"));
    setData(payload);
    setError("");
  }, [tenantSlug]);

  useEffect(() => {
    load().catch((cause) =>
      setError(
        cause instanceof Error
          ? cause.message
          : "We could not load your billing details. Refresh the page and try again.",
      ),
    );
  }, [load]);

  async function act(action: "cancel" | "resume" | "change", subscriptionId: string) {
    if (
      action === "cancel" &&
      !window.confirm("Cancel this subscription at the next renewal? You keep access until then.")
    )
      return;
    setBusy(subscriptionId);
    setError("");
    setNotice("");
    const nextPlan =
      action === "change"
        ? data?.plans.find((plan) => plan.id === selectedPlan[subscriptionId])
        : null;
    try {
      const response = await fetch(`/api/public/${tenantSlug}/billing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          subscriptionId,
          planId: nextPlan?.id,
          requestId: crypto.randomUUID(),
        }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(
          billingError(
            payload.error || "",
            "We could not update this subscription. Refresh the page and try again.",
          ),
        );
      await load();
      setNotice(
        action === "cancel"
          ? "Your subscription will cancel at the next renewal."
          : action === "resume"
            ? "Cancellation removed. Your subscription will continue to renew."
            : `Your change to ${nextPlan?.name || "the new plan"} is scheduled for the next renewal.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "We could not update this subscription. Refresh the page and try again.",
      );
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
      if (!response.ok)
        throw new Error(
          billingError(
            payload.error || "",
            "Payment settings are temporarily unavailable. Try again shortly.",
          ),
        );
      if (!stripeHostedUrl(payload.url, "billing.stripe.com"))
        throw new Error("Payment settings are temporarily unavailable. Try again shortly.");
      window.location.assign(payload.url);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Payment settings are temporarily unavailable. Try again shortly.",
      );
      setBusy("");
    }
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("profile");
    setError("");
    setNotice("");
    try {
      const result = await createClient().auth.updateUser({
        data: { full_name: name.trim(), billing_emails: billingEmails },
      });
      if (result.error)
        setError("Your profile could not be saved. Check your connection and try again.");
      else setNotice("Profile saved.");
    } catch {
      setError("Your profile could not be saved. Check your connection and try again.");
    } finally {
      setBusy("");
    }
  }

  if (error && !data)
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"
      >
        <p>{error}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() =>
              void load().catch((cause) =>
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "We could not load your billing details. Refresh the page and try again.",
                ),
              )
            }
            className="min-h-11 rounded-xl border border-red-300 px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            Try again
          </button>
          {error.includes("session") && (
            <a
              className="font-semibold underline underline-offset-4"
              href={`/login?tenant=${encodeURIComponent(tenantSlug)}`}
            >
              Sign in again
            </a>
          )}
        </div>
      </div>
    );
  if (!data)
    return (
      <p
        role="status"
        className="text-sm text-[color-mix(in_srgb,var(--billing-ink)_62%,transparent)]"
      >
        Loading your account…
      </p>
    );

  return (
    <div className="space-y-8">
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900"
        >
          {notice}
        </p>
      )}

      <section className="rounded-2xl border border-[color-mix(in_srgb,var(--billing-ink)_12%,transparent)] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--billing-accent)]">
              Profile
            </p>
            <p className="mt-2 text-sm text-[color-mix(in_srgb,var(--billing-ink)_66%,transparent)]">
              {userEmail}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              void createClient()
                .auth.signOut()
                .then(() => router.replace(`/login?tenant=${encodeURIComponent(tenantSlug)}`))
            }
            className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--billing-accent)]"
          >
            Sign out
          </button>
        </div>
        <form onSubmit={saveProfile} className="mt-5 flex flex-wrap items-end gap-3">
          <label className="min-w-56 flex-1 text-sm font-medium">
            Name
            <input
              className="mt-2 min-h-11 w-full rounded-xl border border-[color-mix(in_srgb,var(--billing-ink)_18%,transparent)] bg-white px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--billing-accent)]"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              maxLength={160}
            />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={billingEmails}
              onChange={(event) => setBillingEmails(event.target.checked)}
              className="size-4 rounded"
            />
            <span>
              Billing emails
              <span className="block text-xs font-normal text-[color-mix(in_srgb,var(--billing-ink)_58%,transparent)]">
                Receipts, subscription changes, and payment reminders
              </span>
            </span>
          </label>
          <button
            type="submit"
            disabled={busy !== ""}
            className="min-h-11 rounded-xl bg-[var(--billing-accent)] px-4 text-sm font-semibold text-[var(--billing-accent-ink)] transition-opacity hover:opacity-85 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--billing-accent)] focus-visible:ring-offset-2"
          >
            {busy === "profile" ? "Saving…" : "Save profile"}
          </button>
        </form>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[color-mix(in_srgb,var(--billing-ink)_12%,transparent)] bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--billing-accent)]">
            Billing account
          </p>
          <p className="mt-2 text-sm">{data.customer?.email || "No billing account yet"}</p>
          <p className="mt-1 text-sm text-[color-mix(in_srgb,var(--billing-ink)_58%,transparent)]">
            Payment details stay in Stripe’s secure portal.
          </p>
        </div>
        {data.customer && (
          <button
            type="button"
            onClick={() => void portal()}
            disabled={busy !== ""}
            className="min-h-11 rounded-xl border border-[color-mix(in_srgb,var(--billing-ink)_18%,transparent)] px-4 text-sm font-semibold transition-colors hover:bg-[color-mix(in_srgb,var(--billing-ink)_6%,transparent)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--billing-accent)]"
          >
            {busy === "portal" ? "Opening secure portal…" : "Manage payment method"}
          </button>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-tight">Subscriptions</h2>
        <div className="mt-4 space-y-4">
          {data.subscriptions.length ? (
            data.subscriptions.map((subscription) => (
              <article
                key={subscription.id}
                className="rounded-2xl border border-[color-mix(in_srgb,var(--billing-ink)_12%,transparent)] bg-white p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">{subscription.plan?.name || "Subscription"}</h3>
                    <p className="mt-1 text-sm text-[color-mix(in_srgb,var(--billing-ink)_65%,transparent)]">
                      {
                        subscriptionStatusPresentation(
                          subscription.status,
                          subscription.cancel_at_period_end,
                        ).label
                      }{" "}
                      ·{" "}
                      {subscription.plan
                        ? `${formatPlanPrice(subscription.plan.amount, subscription.plan.currency)} / ${formatPlanInterval(subscription.plan.interval)}`
                        : "Plan details unavailable"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle(subscriptionStatusPresentation(subscription.status, subscription.cancel_at_period_end).tone)}`}
                  >
                    {
                      subscriptionStatusPresentation(
                        subscription.status,
                        subscription.cancel_at_period_end,
                      ).label
                    }
                  </span>
                </div>
                <p className="mt-4 text-sm text-[color-mix(in_srgb,var(--billing-ink)_65%,transparent)]">
                  {periodText(
                    subscription.status,
                    subscription.cancel_at_period_end,
                    subscription.current_period_end,
                  )}
                </p>
                <p className="mt-2 text-sm leading-6 text-[color-mix(in_srgb,var(--billing-ink)_65%,transparent)]">
                  {
                    subscriptionStatusPresentation(
                      subscription.status,
                      subscription.cancel_at_period_end,
                    ).detail
                  }
                </p>
                {subscription.status === "incomplete" && (
                  <p className="mt-3 text-sm leading-6 text-[color-mix(in_srgb,var(--billing-ink)_65%,transparent)]">
                    If you did not finish checkout, return to the plans page to try again.{" "}
                    <a
                      className="font-semibold underline underline-offset-4"
                      href={`/t/${tenantSlug}/subscribe`}
                    >
                      View plans
                    </a>
                    .
                  </p>
                )}
                {subscription.pending_plan_id && (
                  <p className="mt-2 text-sm text-[color-mix(in_srgb,var(--billing-ink)_65%,transparent)]">
                    {data.plans.find((plan) => plan.id === subscription.pending_plan_id)?.name ||
                      "Plan change"}{" "}
                    starts at the next renewal
                    {subscription.pending_change_at
                      ? ` on ${localDate(subscription.pending_change_at)}`
                      : ""}
                    .
                  </p>
                )}
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  {subscriptionStatusPresentation(
                    subscription.status,
                    subscription.cancel_at_period_end,
                  ).canResume ? (
                    <button
                      type="button"
                      onClick={() => void act("resume", subscription.stripe_subscription_id)}
                      disabled={busy !== ""}
                      className="min-h-11 rounded-xl border border-[color-mix(in_srgb,var(--billing-ink)_18%,transparent)] px-4 text-sm font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--billing-accent)]"
                    >
                      Keep subscription
                    </button>
                  ) : subscriptionStatusPresentation(
                      subscription.status,
                      subscription.cancel_at_period_end,
                    ).canCancel ? (
                    <button
                      type="button"
                      onClick={() => void act("cancel", subscription.stripe_subscription_id)}
                      disabled={busy !== ""}
                      className="min-h-11 rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      Cancel at renewal
                    </button>
                  ) : null}
                  {!subscription.pending_plan_id &&
                    subscriptionStatusPresentation(
                      subscription.status,
                      subscription.cancel_at_period_end,
                    ).canChange &&
                    data.plans.filter(
                      (plan) =>
                        plan.currency === subscription.plan?.currency &&
                        plan.id !== subscription.plan?.id,
                    ).length > 0 && (
                      <>
                        <select
                          aria-label="New plan"
                          className="min-h-11 rounded-xl border border-[color-mix(in_srgb,var(--billing-ink)_18%,transparent)] bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--billing-accent)]"
                          value={selectedPlan[subscription.stripe_subscription_id] || ""}
                          onChange={(event) =>
                            setSelectedPlan((current) => ({
                              ...current,
                              [subscription.stripe_subscription_id]: event.target.value,
                            }))
                          }
                        >
                          <option value="">Change plan…</option>
                          {data.plans
                            .filter(
                              (plan) =>
                                plan.currency === subscription.plan?.currency &&
                                plan.id !== subscription.plan?.id,
                            )
                            .map((plan) => (
                              <option key={plan.id} value={plan.id}>
                                {plan.name} · {formatPlanPrice(plan.amount, plan.currency)}/
                                {formatPlanInterval(plan.interval)}
                              </option>
                            ))}
                        </select>
                        {selectedPlan[subscription.stripe_subscription_id] && (
                          <button
                            type="button"
                            onClick={() => void act("change", subscription.stripe_subscription_id)}
                            disabled={busy !== ""}
                            className="min-h-11 rounded-xl border border-[color-mix(in_srgb,var(--billing-ink)_18%,transparent)] px-4 text-sm font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--billing-accent)]"
                          >
                            Schedule change
                          </button>
                        )}
                      </>
                    )}
                </div>
              </article>
            ))
          ) : (
            <p className="rounded-2xl border border-[color-mix(in_srgb,var(--billing-ink)_12%,transparent)] bg-white p-6 text-sm text-[color-mix(in_srgb,var(--billing-ink)_65%,transparent)] shadow-sm">
              No subscriptions yet.{" "}
              <a
                className="font-semibold underline underline-offset-4"
                href={`/t/${tenantSlug}/subscribe`}
              >
                View plans
              </a>
              .
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-tight">Invoices</h2>
        {data.providerError && (
          <p
            role="status"
            className="mt-3 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950"
          >
            {data.providerError}
          </p>
        )}
        <div className="mt-4 divide-y divide-[color-mix(in_srgb,var(--billing-ink)_10%,transparent)] overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--billing-ink)_12%,transparent)] bg-white shadow-sm">
          {data.invoices.length ? (
            data.invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"
              >
                <span>{localDate(invoice.created)}</span>
                <span className="tabular-nums">
                  {formatPlanPrice(
                    invoice.status === "paid"
                      ? invoice.amountPaid || invoice.amountDue || 0
                      : invoice.amountDue || 0,
                    invoice.currency || "usd",
                  )}
                </span>
                <span className="text-[color-mix(in_srgb,var(--billing-ink)_62%,transparent)]">
                  {invoiceLabel(invoice.status)}
                </span>
                {invoice.hostedInvoiceUrl && (
                  <a
                    className="font-semibold underline underline-offset-4"
                    href={invoice.hostedInvoiceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View invoice
                  </a>
                )}
              </div>
            ))
          ) : (
            <p className="p-6 text-sm text-[color-mix(in_srgb,var(--billing-ink)_65%,transparent)]">
              No invoices yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
