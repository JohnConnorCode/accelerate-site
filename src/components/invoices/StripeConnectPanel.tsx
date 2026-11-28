"use client";
import { useState, type FormEvent } from "react";
import { ReceiptText } from "lucide-react";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { fetchJson } from "@/lib/admin/fetchJson";

const field = "admin-field mt-2";

/** Connects the workspace's own Stripe account so issued invoices can take
 * payment. The keys are verified against the account ID and stored encrypted. */
export function StripeConnectPanel({
  connected,
  onConnected,
}: {
  connected: boolean;
  onConnected: () => Promise<void> | void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [publishableKey, setPublishableKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const accountId = String(new FormData(event.currentTarget).get("accountId") || "").trim();
    setBusy(true);
    setError("");
    setNotice("");
    void (async () => {
      try {
        await fetchJson("/api/admin/tenant/providers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "configure_stripe",
            apiKey,
            accountId,
            publishableKey: publishableKey.trim(),
            ...(webhookSecret.trim() ? { webhookSecret: webhookSecret.trim() } : {}),
          }),
        });
        setApiKey("");
        setPublishableKey("");
        setWebhookSecret("");
        setNotice("Stripe connected for this workspace.");
        await onConnected();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Stripe could not be connected");
      } finally {
        setBusy(false);
      }
    })();
  }

  return (
    <AdminSurface padding="lg">
      <div className="flex items-start gap-3">
        <ReceiptText className="mt-1 size-6 shrink-0" aria-hidden="true" />
        <div>
          <h2 className="text-lg font-semibold">
            {connected ? "Finish Stripe setup to take payments" : "Connect your Stripe account"}
          </h2>
          <p className="admin-copy mt-2 max-w-2xl text-sm leading-6">
            {connected
              ? "Clients can pay online once the publishable key is saved. You can keep saving and editing drafts in the meantime."
              : "Payment links need your Stripe account. You can save and edit drafts now and connect Stripe when you are ready."}{" "}
            Use a secret or restricted key with Payment Intents and Refunds write access. The keys
            stay encrypted in this workspace.
          </p>
        </div>
      </div>
      <form onSubmit={submit} className="mt-5 max-w-xl">
        <label className="text-sm font-medium" htmlFor="stripe-account-id">
          Stripe account ID
        </label>
        <input
          id="stripe-account-id"
          name="accountId"
          className={field}
          required
          pattern="acct_[A-Za-z0-9]+"
          placeholder="acct_…"
          autoComplete="off"
        />
        <p className="admin-copy mt-2 text-sm">
          Find it in Stripe under Settings. Keys from a different account are rejected.
        </p>
        <label className="mt-4 block text-sm font-medium" htmlFor="stripe-key">
          Stripe API key
        </label>
        <input
          id="stripe-key"
          type="password"
          autoComplete="new-password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          className={field}
          required
          minLength={20}
        />
        <label className="mt-4 block text-sm font-medium" htmlFor="stripe-publishable-key">
          Publishable key
        </label>
        <input
          id="stripe-publishable-key"
          className={field}
          autoComplete="off"
          required
          value={publishableKey}
          onChange={(event) => setPublishableKey(event.target.value)}
          placeholder="pk_live_… or pk_test_…"
        />
        <label className="mt-4 block text-sm font-medium" htmlFor="stripe-webhook-secret">
          Webhook signing secret{" "}
          <span className="font-normal text-[var(--admin-muted)]">(optional now)</span>
        </label>
        <input
          id="stripe-webhook-secret"
          type="password"
          autoComplete="new-password"
          value={webhookSecret}
          onChange={(event) => setWebhookSecret(event.target.value)}
          className={field}
          minLength={10}
        />
        <p className="admin-copy mt-2 text-sm">
          With the webhook, invoices change to Paid as soon as Stripe confirms. Without it, they
          update when you or your client open the invoice.
        </p>
        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-[var(--admin-danger-soft)] p-3 text-sm">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="mt-4 text-sm">
            {notice}
          </p>
        )}
        <button type="submit" className="admin-button admin-button--primary mt-4" disabled={busy}>
          {busy ? "Connecting…" : "Connect Stripe"}
        </button>
      </form>
    </AdminSurface>
  );
}
