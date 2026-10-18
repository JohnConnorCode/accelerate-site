"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ActionReviewDialog, type ActionRow } from "./ActionReviewDialog";
import { AdminSurface } from "./AdminSurface";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { fetchJson } from "@/lib/admin/fetchJson";
import type { BillingReceipt } from "@/lib/revenue-os/billing-command-contract";
import { refreshBilling } from "./BillingActionControl";

type BillingAction = ActionRow & { result: BillingReceipt | null; error: string | null };
export function BillingActivity() {
  const cache = useQueryClient();
  const query = useAdminQuery<{ actions: BillingAction[] }>(
    ["admin", "actions"],
    "/api/admin/revenue-os/actions",
  );
  const [selected, setSelected] = useState<BillingAction | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const actions =
    query.data?.actions.filter((action) => action.action_type === "billing_change").slice(0, 8) ??
    [];
  async function decide(decision: "approve" | "reject" | "retry", action = selected) {
    if (!action) return;
    setBusy(true);
    setError("");
    try {
      await fetchJson("/api/admin/revenue-os/actions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: action.id, decision }),
      });
      if (decision === "retry") {
        setSelected({ ...action, status: "pending" });
        setOpen(true);
      } else setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The billing action could not be updated.");
    } finally {
      setBusy(false);
      await refreshBilling(cache);
    }
  }
  if (!actions.length && !query.error) return null;
  return (
    <AdminSurface padding="lg">
      <h2 className="text-lg font-semibold">Recent billing actions</h2>
      <p className="admin-copy mt-1 text-sm">
        Reviewed customer setup, invoice cancellations and refunds retain their original provider
        results.
      </p>
      {query.error && (
        <p role="alert" className="mt-3 text-sm">
          Action history could not refresh.{" "}
          <button
            className="admin-button admin-button--secondary"
            type="button"
            onClick={() => void query.refetch()}
          >
            Retry action history
          </button>
        </p>
      )}
      {!open && error && (
        <p role="alert" className="mt-3 text-sm text-[var(--admin-danger)]">
          {error}
        </p>
      )}
      <ul className="mt-4 divide-y divide-[var(--admin-border)]">
        {actions.map((action) => (
          <li key={action.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{action.title}</p>
              <p className="admin-copy mt-1 text-sm">
                {action.result?.message ?? action.error ?? action.description}
              </p>
              <p className="admin-copy mt-2 break-words text-xs">
                {action.status === "executed"
                  ? `Provider status: ${action.result?.status ?? "See receipt"}`
                  : action.status.replaceAll("_", " ")}
                {action.result?.providerId ? ` · ${action.result.providerId}` : ""}
              </p>
            </div>
            {action.status === "pending" && (
              <button
                className="admin-button admin-button--secondary"
                type="button"
                onClick={() => {
                  setSelected(action);
                  setError("");
                  setOpen(true);
                }}
              >
                Review billing action
              </button>
            )}
            {action.status === "failed" &&
              action.expires_at &&
              Date.parse(action.expires_at) > query.dataUpdatedAt && (
                <button
                  className="admin-button admin-button--secondary"
                  type="button"
                  disabled={busy}
                  onClick={() => void decide("retry", action)}
                >
                  Review same operation again
                </button>
              )}
          </li>
        ))}
      </ul>
      <ActionReviewDialog
        open={open}
        action={selected}
        busy={busy}
        error={error}
        onClose={() => setOpen(false)}
        onApprove={() => void decide("approve")}
        onReject={() => void decide("reject")}
      />
    </AdminSurface>
  );
}
