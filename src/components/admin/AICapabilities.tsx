"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/components/admin/AdminLink";
import {
  Check,
  CircleAlert,
  ExternalLink,
  Loader2,
  LockKeyhole,
  Search,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import type { AiCapabilitiesPayload, AiCapability } from "@/lib/revenue-os/ai-operations-contract";
import { AdminSurface } from "./AdminSurface";
import { fetchJson } from "@/lib/admin/fetchJson";

function CapabilityCard({ item }: { item: AiCapability }) {
  const readOnly = item.impact === "read";
  return (
    <div className="rounded-xl bg-black/[0.022] p-4 shadow-[var(--admin-shadow-border)] dark:bg-white/[0.03]">
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--admin-surface)] shadow-[var(--admin-shadow-border)]">
          {readOnly ? (
            <Search className="size-4 text-sky-600 dark:text-sky-300" />
          ) : (
            <LockKeyhole className="size-4 text-amber-600 dark:text-amber-300" />
          )}
        </span>
        <span className="rounded-full bg-[var(--admin-surface)] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted)] shadow-[var(--admin-shadow-border)]">
          {item.state === "available"
            ? readOnly
              ? "Ready to read"
              : "Approval gated"
            : "Unavailable"}
        </span>
      </div>
      <h3 className="mt-4 text-sm font-semibold text-[var(--admin-ink)]">{item.label}</h3>
      <p className="admin-copy mt-1 text-pretty text-xs">{item.description}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {item.packs.map((pack) => (
          <span
            key={pack}
            className="rounded-md bg-black/[0.04] px-2 py-1 font-mono text-[10px] text-[var(--admin-muted)] dark:bg-white/[0.05]"
          >
            {pack}
          </span>
        ))}
      </div>
      <p className="admin-copy mt-3 text-[11px] leading-5">{item.availabilityReason}</p>
      <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--admin-muted)]">
        {item.serviceTarget} ·{" "}
        {item.connectionRequirement === "none"
          ? "No provider connection required"
          : "Connection required"}
      </p>
    </div>
  );
}

export function AICapabilities() {
  const [data, setData] = useState<AiCapabilitiesPayload | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void fetchJson<AiCapabilitiesPayload>("/api/admin/revenue-os/ai/capabilities")
      .then(setData)
      .catch((issue) =>
        setError(issue instanceof Error ? issue.message : "Capabilities are unavailable."),
      );
  }, []);
  const groups = useMemo(
    () => ({
      reads: data?.capabilities.filter((item) => item.impact === "read") ?? [],
      gated: data?.capabilities.filter((item) => item.impact !== "read") ?? [],
    }),
    [data],
  );
  if (!data && !error)
    return (
      <div className="grid min-h-[46vh] place-items-center" role="status">
        <Loader2 className="size-5 animate-spin text-[var(--admin-muted)]" aria-hidden="true" />
        <span className="sr-only">Loading capabilities…</span>
      </div>
    );
  if (error)
    return (
      <AdminSurface tone="attention">
        <CircleAlert className="size-5 text-rose-600" />
        <p className="mt-3 text-sm font-semibold">Capabilities could not be loaded</p>
        <p className="admin-copy mt-1 text-xs">{error}</p>
      </AdminSurface>
    );
  const policies = [
    { label: "Bounded reads may execute directly", good: data!.safety.readsMayExecuteDirectly },
    { label: "Writes require approval", good: data!.safety.writesRequireApproval },
    {
      label: "External actions require approval",
      good: data!.safety.externalActionsRequireApproval,
    },
    { label: "No destructive tools registered", good: !data!.safety.destructiveActionsAvailable },
  ];
  return (
    <div className="space-y-5">
      <AdminSurface padding="lg" className="overflow-hidden">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="size-4" />
              <p className="admin-eyebrow text-current">Runtime registry</p>
            </div>
            <h2 className="mt-2 text-balance text-xl font-semibold tracking-[-0.035em] text-[var(--admin-ink)]">
              Useful by default. Controlled where it matters.
            </h2>
            <p className="admin-copy mt-2 max-w-2xl text-sm">
              Availability is evaluated against the current registered service boundary. These tools
              can safely read or stage approval requests without calling a provider directly.
            </p>
          </div>
          <div className="grid gap-2 text-xs sm:grid-cols-2 lg:w-[340px]">
            {policies.map(({ label, good }) => (
              <div
                key={label}
                className="flex min-h-11 items-center gap-2 rounded-xl bg-black/[0.025] px-3 shadow-[var(--admin-shadow-border)] dark:bg-white/[0.035]"
              >
                {good ? (
                  <Check className="size-3.5 text-emerald-600" />
                ) : (
                  <CircleAlert className="size-3.5 text-rose-600" />
                )}
                <span className="font-medium text-[var(--admin-ink)]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </AdminSurface>
      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="admin-eyebrow">Runtime registry</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--admin-ink)]">
              Read capabilities
            </h2>
          </div>
          <span className="font-mono text-[10px] text-[var(--admin-muted)]">
            Registry {data?.registryVersion}
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {groups.reads.map((item) => (
            <CapabilityCard key={item.name} item={item} />
          ))}
        </div>
      </section>
      {groups.gated.length > 0 && (
        <section>
          <div className="mb-3">
            <p className="admin-eyebrow">Founder controlled</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--admin-ink)]">
              Proposals and actions
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {groups.gated.map((item) => (
              <CapabilityCard key={item.name} item={item} />
            ))}
          </div>
        </section>
      )}
      <AdminSurface
        tone="subtle"
        className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"
      >
        <div className="flex gap-3">
          <Wrench className="mt-0.5 size-4 shrink-0 text-[var(--admin-muted)]" />
          <div>
            <p className="text-sm font-semibold text-[var(--admin-ink)]">
              Execution stays separately verified
            </p>
            <p className="admin-copy mt-1 max-w-2xl text-xs">
              Provider health controls approved execution. The AI registry never bypasses those
              normal services or the approval queue.
            </p>
          </div>
        </div>
        <Link
          href="/admin/integrations"
          className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] hover:shadow-[var(--admin-shadow-border-hover)]"
        >
          Check integrations <ExternalLink className="size-3.5" />
        </Link>
      </AdminSurface>
    </div>
  );
}
