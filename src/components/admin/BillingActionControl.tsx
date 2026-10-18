"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminDialog } from "./AdminDialog";
import { ActionReviewDialog, type ActionRow } from "./ActionReviewDialog";
import { fetchJson } from "@/lib/admin/fetchJson";
import { formatInvoiceAmount } from "@/lib/revenue-os/stripe-contract";
import type {
  BillingCommand,
  BillingPreview,
  BillingReceipt,
} from "@/lib/revenue-os/billing-command-contract";

type Intent<T = BillingCommand> = T extends BillingCommand ? Omit<T, "requestId"> : never;
export async function refreshBilling(cache: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    cache.invalidateQueries({ queryKey: ["admin", "invoicing"] }),
    cache.invalidateQueries({ queryKey: ["admin", "actions"] }),
  ]);
}
const post = <T,>(body: unknown) =>
  fetchJson<T>("/api/admin/invoicing/commands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export function BillingActionControl({
  intent,
  label,
  currency = "usd",
}: {
  intent: Intent;
  label: string;
  currency?: string;
}) {
  const cache = useQueryClient();
  const original = intent.operation === "refund_payment" ? intent.amount : 0;
  const [amount, setAmount] = useState(String(original / 100));
  const [reason, setReason] = useState<"requested_by_customer" | "duplicate">(
    "requested_by_customer",
  );
  const [editing, setEditing] = useState(false);
  const [action, setAction] = useState<ActionRow | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const request = useRef<BillingCommand | null>(null);
  const refreshAfterClose = useRef(false);
  const supportsPartial = ["usd", "eur", "gbp", "cad", "aud"].includes(currency);
  async function prepare() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      let command: Intent = intent;
      if (intent.operation === "refund_payment") command = { ...intent, reason };
      if (intent.operation === "refund_payment" && supportsPartial) {
        const match = amount.trim().match(/^(0|[1-9]\d{0,6})(?:\.(\d{1,2}))?$/);
        if (!match) throw new Error("Enter an amount with at most two decimal places.");
        const minor = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
        if (minor < 1 || minor > original)
          throw new Error("Choose an amount up to the available refund balance.");
        command = { ...intent, amount: minor, reason };
      }
      const previous = request.current;
      if (
        !previous ||
        JSON.stringify({ ...previous, requestId: undefined }) !== JSON.stringify(command)
      )
        request.current = { ...command, requestId: crypto.randomUUID() } as BillingCommand;
      const preview = await post<BillingPreview>({ mode: "preview", command: request.current });
      const proposed = await post<ActionRow>({
        mode: "propose",
        command: request.current,
        digest: preview.digest,
      });
      if (proposed.status !== "pending")
        throw new Error(
          "This request already has a result. Inspect Recent billing actions and re-review the original failed operation when available.",
        );
      setAction(proposed);
      setEditing(false);
      setReviewing(true);
      await cache.invalidateQueries({ queryKey: ["admin", "actions"] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Billing review could not be prepared.");
    } finally {
      setBusy(false);
    }
  }
  async function decide(decision: "approve" | "reject") {
    if (!action) return;
    setBusy(true);
    refreshAfterClose.current = true;
    setError("");
    try {
      const result = await fetchJson<{ result?: BillingReceipt }>("/api/admin/revenue-os/actions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: action.id, decision }),
      });
      setNotice(
        decision === "reject"
          ? "Billing action rejected."
          : (result.result?.message ?? "Check the recorded billing result below."),
      );
      setReviewing(false);
      request.current = null;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Billing action did not complete. Inspect its recorded result before retrying.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="min-w-0">
      <button
        type="button"
        className="admin-button admin-button--secondary"
        disabled={busy}
        onClick={() => {
          if (intent.operation === "refund_payment") {
            setAmount(String(original / 100));
            setError("");
            setEditing(true);
          } else void prepare();
        }}
      >
        {busy ? "Preparing…" : label}
      </button>
      {!reviewing && !editing && error && (
        <p role="alert" className="mt-2 max-w-sm text-sm text-[var(--admin-danger)]">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="admin-copy mt-2 max-w-sm text-sm">
          {notice}
        </p>
      )}
      <AdminDialog
        open={editing}
        onClose={() => {
          if (!busy) setEditing(false);
        }}
        title="Refund payment"
        maxWidth="sm"
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void prepare();
          }}
        >
          <p className="admin-copy text-sm">
            Available to refund: {formatInvoiceAmount(original, currency)}. The next screen shows
            the exact operation for approval.
          </p>
          {supportsPartial ? (
            <label className="block text-sm font-medium">
              Refund amount ({currency.toUpperCase()})
              <input
                className="admin-field mt-2 w-full"
                inputMode="decimal"
                value={amount}
                required
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>
          ) : (
            <p className="text-sm">This currency supports a full remaining-balance refund here.</p>
          )}
          <label className="block text-sm font-medium">
            Reason
            <select
              className="admin-field mt-2 w-full"
              aria-label="Reason"
              value={reason}
              onChange={(event) => setReason(event.target.value as typeof reason)}
            >
              <option value="requested_by_customer">Requested by customer</option>
              <option value="duplicate">Duplicate payment</option>
            </select>
          </label>
          {error && (
            <p role="alert" className="text-sm text-[var(--admin-danger)]">
              {error}
            </p>
          )}
          <button type="submit" className="admin-button admin-button--primary" disabled={busy}>
            {busy ? "Preparing…" : "Review refund"}
          </button>
        </form>
      </AdminDialog>
      <ActionReviewDialog
        open={reviewing}
        action={action}
        busy={busy}
        error={error}
        onClose={() => setReviewing(false)}
        onExitComplete={() => {
          if (!refreshAfterClose.current) return;
          refreshAfterClose.current = false;
          void refreshBilling(cache);
        }}
        onApprove={() => void decide("approve")}
        onReject={() => void decide("reject")}
      />
    </div>
  );
}
