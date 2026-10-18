"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminDemo } from "./AdminDemoBoundary";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { fetchJson } from "@/lib/admin/fetchJson";
import { AdminSurface } from "./AdminSurface";
import { AdminSwitch } from "./AdminSwitch";
import type { AiSpendPolicy } from "@/lib/ai/spend-controls-contract";

type Controls = {
  revision: number;
  policy: AiSpendPolicy;
  usage: {
    dailyCalls: number;
    dailyReservedUsd: number;
    monthlyReservedUsd: number;
    reportedUsd: number;
    uncertainCalls: number;
  };
  recent: Array<{
    id: string;
    job: string;
    model: string;
    reserved_usd: number;
    actual_usd: number | null;
    created_at: string;
  }>;
  coworkers: Array<{ id: string; name: string; status: string; work_kinds: string[] }>;
};
const usd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 6,
  }).format(value);
const limits: Array<{
  key: "dailyUsd" | "monthlyUsd" | "requestUsd" | "dailyCalls";
  label: string;
  max: number;
  step: string;
}> = [
  { key: "dailyUsd", label: "Daily budget (USD)", max: 10000, step: "0.01" },
  { key: "monthlyUsd", label: "Monthly budget (USD)", max: 100000, step: "0.01" },
  { key: "requestUsd", label: "Maximum per request (USD)", max: 100, step: "0.000001" },
  { key: "dailyCalls", label: "Maximum requests per day", max: 10000, step: "1" },
];

export function AiCostControls() {
  const demo = useAdminDemo();
  const query = useAdminQuery<Controls>(["ai-cost-controls"], "/api/admin/ai-cost-controls");
  const client = useQueryClient();
  const [draft, setDraft] = useState<{ revision: number; policy: AiSpendPolicy } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const current = query.data;
  const policy = draft?.policy ?? current?.policy;
  const editPolicy = (next: AiSpendPolicy) => {
    if (current) setDraft({ revision: draft?.revision ?? current.revision, policy: next });
  };
  const save = async (next: AiSpendPolicy, revision = current?.revision) => {
    if (!current || revision === undefined) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const result = await fetchJson<Controls>("/api/admin/ai-cost-controls", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision, policy: next }),
      });
      client.setQueryData(["ai-cost-controls"], result);
      setDraft(null);
      setMessage(
        "AI controls saved. New requests use these limits. A request already running may finish.",
      );
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Controls could not be saved");
    } finally {
      setBusy(false);
    }
  };
  const controlCoworker = async (id: string, status: "active" | "paused") => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await fetchJson<Controls>("/api/admin/ai-cost-controls", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      client.setQueryData(["ai-cost-controls"], result);
      setMessage(
        status === "paused"
          ? "Coworker paused. A request already running may finish."
          : "Coworker active. Workspace AI and recurring-work controls still apply.",
      );
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Coworker control failed");
    } finally {
      setBusy(false);
    }
  };
  if (!current || !policy)
    return (
      <div>
        <p role={query.error ? "alert" : "status"} className="admin-copy">
          {query.error?.message ?? "Loading AI cost controls…"}
        </p>
        {query.error && (
          <button
            type="button"
            className="admin-button admin-button--secondary mt-3"
            onClick={() => void query.refetch()}
          >
            Retry loading controls
          </button>
        )}
      </div>
    );
  return (
    <div role="region" aria-label="AI cost controls" className="space-y-5 max-w-5xl">
      {demo && (
        <p className="admin-copy text-sm">
          Demo controls change only this browser session. They cannot enable live AI, start
          scheduled runs or purchase credits.
        </p>
      )}
      <AdminSurface className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="admin-section-title">Control AI spending</h2>
            <p className="admin-copy mt-1">
              Set workspace limits before allowing model requests. Saving a budget does not purchase
              provider credits.
            </p>
          </div>
          <button
            type="button"
            className="admin-button admin-button--secondary"
            disabled={busy}
            onClick={() => void save({ ...current.policy, enabled: false })}
          >
            Pause all AI now
          </button>
        </div>
        <form
          aria-label="AI spending controls"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save(policy, draft?.revision ?? current.revision);
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Allow model requests</p>
              <p className="admin-copy text-sm">
                Applies to chat, public assistants, drafts and background AI in this workspace.
              </p>
            </div>
            <AdminSwitch
              checked={policy.enabled}
              onCheckedChange={(enabled) => editPolicy({ ...policy, enabled })}
              label="Allow model requests"
              disabled={busy}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Run recurring AI and coworker work</p>
              <p className="admin-copy text-sm">
                Allows scheduled AI calls and the work engine to run coworkers. Checks that use
                saved records can run with model requests paused.
              </p>
            </div>
            <AdminSwitch
              checked={policy.recurringEnabled}
              onCheckedChange={(recurringEnabled) => editPolicy({ ...policy, recurringEnabled })}
              label="Run recurring AI and coworker work"
              disabled={busy}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {limits.map((field) => (
              <label key={field.key} className="text-sm font-medium">
                {field.label}
                <input
                  className="admin-field mt-1 w-full"
                  type="number"
                  required
                  min="0"
                  max={field.max}
                  step={field.step}
                  value={policy[field.key]}
                  disabled={busy}
                  onChange={(event) =>
                    editPolicy({
                      ...policy,
                      [field.key]: event.target.value === "" ? 0 : Number(event.target.value),
                    })
                  }
                />
              </label>
            ))}
          </div>
          <p className="admin-copy text-sm">
            Limits reset at midnight UTC and the first day of each month. Each attempt reserves its
            bounded model cost. A confirmed provider charge releases its unused reservation.
            Requests without a confirmed charge keep their reservation until the period resets. Free
            models require verified zero pricing and still count toward the request limit.
          </p>
          <button type="submit" className="admin-button admin-button--primary" disabled={busy}>
            {busy ? "Saving…" : "Save AI controls"}
          </button>
        </form>
        {error && (
          <p role="alert" className="text-sm text-[var(--admin-danger)]">
            {error}{" "}
            <button type="button" className="underline" onClick={() => window.location.reload()}>
              Refresh controls
            </button>
          </p>
        )}
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
      </AdminSurface>
      <AdminSurface className="space-y-3">
        <h2 className="admin-section-title">Individual coworkers</h2>
        <p className="admin-copy text-sm">
          Active coworkers can receive their daily, weekly or event-based work when recurring work
          is enabled. Pause an individual coworker to stop its queued execution.
        </p>
        {current.coworkers.length === 0 ? (
          <p className="admin-copy">No coworkers are registered.</p>
        ) : (
          <ul className="divide-y divide-[var(--admin-border)]">
            {current.coworkers.map((coworker) => (
              <li key={coworker.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {coworker.name} <span className="admin-copy text-sm">{coworker.status}</span>
                  </p>
                  <p className="admin-copy mt-1 text-sm break-words">
                    {coworker.work_kinds.map((kind) => kind.replaceAll("_", " ")).join(", ")}
                  </p>
                </div>
                {coworker.status !== "disabled" && (
                  <button
                    type="button"
                    className="admin-button admin-button--secondary shrink-0"
                    disabled={busy}
                    aria-label={
                      coworker.status === "active"
                        ? `Pause ${coworker.name}`
                        : `Resume ${coworker.name}`
                    }
                    onClick={() =>
                      void controlCoworker(
                        coworker.id,
                        coworker.status === "active" ? "paused" : "active",
                      )
                    }
                  >
                    {coworker.status === "active" ? "Pause" : "Resume"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </AdminSurface>
      <AdminSurface className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="admin-section-title">Current usage</h2>
          <button
            type="button"
            className="admin-button admin-button--secondary"
            disabled={busy || query.isFetching}
            onClick={() => void query.refetch()}
          >
            Refresh usage
          </button>
        </div>
        {query.error && (
          <p role="alert" className="admin-copy text-sm">
            Usage could not refresh. The last loaded values remain visible. Try Refresh usage again.
          </p>
        )}
        <p className="admin-copy text-xs">
          Last loaded {new Date(query.dataUpdatedAt).toLocaleString()}
        </p>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Requests today", `${current.usage.dailyCalls} / ${current.policy.dailyCalls}`],
            [
              "Budget used and held today",
              `${usd(current.usage.dailyReservedUsd)} / ${usd(current.policy.dailyUsd)}`,
            ],
            [
              "Budget used and held this month",
              `${usd(current.usage.monthlyReservedUsd)} / ${usd(current.policy.monthlyUsd)}`,
            ],
            ["Provider cost reported this month", usd(current.usage.reportedUsd)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="admin-copy text-sm">{label}</dt>
              <dd className="mt-1 font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="admin-copy text-sm">
          {current.usage.uncertainCalls} requests have no final provider charge reported. These
          totals cover requests admitted after cost controls were installed. They exclude other
          apps, credit purchase fees and hosting.
        </p>
        <a
          href="https://openrouter.ai/settings/credits"
          target="_blank"
          rel="noreferrer"
          className="admin-text-link"
        >
          Open provider billing and auto-top-up settings
        </a>
      </AdminSurface>
      <AdminSurface className="space-y-3">
        <h2 className="admin-section-title">Recent model requests</h2>
        {current.recent.length === 0 ? (
          <p className="admin-copy">
            No requests have been admitted since cost controls were installed.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--admin-border)]">
            {current.recent.map((row) => (
              <li key={row.id} className="py-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <strong>{row.job}</strong>
                  <time dateTime={row.created_at}>{new Date(row.created_at).toLocaleString()}</time>
                </div>
                <p className="admin-copy break-words">
                  {row.model} · Reserved {usd(Number(row.reserved_usd))} ·{" "}
                  {row.actual_usd === null
                    ? "Final charge unavailable"
                    : `Provider reported ${usd(Number(row.actual_usd))}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </AdminSurface>
    </div>
  );
}
