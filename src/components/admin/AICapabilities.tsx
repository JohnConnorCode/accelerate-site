"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/admin/AdminLink";
import {
  Check,
  CircleAlert,
  ExternalLink,
  Loader2,
  LockKeyhole,
  Search,
  Wrench,
} from "lucide-react";
import type { AiCapabilitiesPayload, AiCapability } from "@/lib/revenue-os/ai-operations-contract";
import { AdminSurface } from "./AdminSurface";
import { fetchJson } from "@/lib/admin/fetchJson";
import { AdminButton } from "./AdminButton";

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
              ? "Registered read"
              : item.confirmationRequired
                ? "Review required"
                : "Scoped execution"
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
  const [query, setQuery] = useState("");
  const [reload, setReload] = useState(0);
  const searchField = useRef<HTMLInputElement>(null);
  const jobs = [
    {
      title: "Understand a customer",
      detail:
        "Bring recent conversations, opportunities and outstanding work into a useful summary.",
      prompt:
        "Help me understand a customer. Ask which customer, then inspect the available conversations, opportunities and outstanding work. Cite the records you use.",
      guide: "/docs/contacts",
    },
    {
      title: "Prepare the next follow-up",
      detail: "Use an inquiry and its customer context to prepare a reply and dated task.",
      prompt:
        "Find an unanswered inquiry and prepare a relevant reply and follow-up task. Ask for missing details and show the exact proposals for review.",
      guide: "/docs/conversations/reply",
    },
    {
      title: "Start client delivery",
      detail: "Turn a won engagement into a checklist with owners and dates.",
      prompt:
        "Help prepare onboarding for a won opportunity. Ask which engagement and clarify the owners and dates before proposing the checklist.",
      guide: "/docs/plugins/client-onboarding",
    },
    {
      title: "Investigate an unpaid invoice",
      detail: "Read balance evidence and case history before deciding on payment follow-up.",
      prompt:
        "Help review an outstanding invoice. Check the available invoice evidence, payment promises, disputes and next action before proposing any follow-up.",
      guide: "/docs/billing",
    },
    {
      title: "Prepare business content",
      detail: "Use a supplied brief and existing page or editorial context for a useful draft.",
      prompt:
        "Help prepare content for my business. Ask for the audience, purpose and source material, then identify the supported page, editorial or social workflow before proposing changes.",
      guide: "/docs/outreach",
    },
  ];
  useEffect(() => {
    const controller = new AbortController();
    void fetchJson<AiCapabilitiesPayload>("/api/admin/revenue-os/ai/capabilities", {
      signal: controller.signal,
    })
      .then((payload) => {
        if (!controller.signal.aborted) setData(payload);
      })
      .catch((issue) => {
        if (!controller.signal.aborted)
          setError(issue instanceof Error ? issue.message : "Capabilities are unavailable.");
      });
    return () => controller.abort();
  }, [reload]);
  const matched = useMemo(() => {
    const search = query.trim().toLowerCase().replaceAll("_", " ");
    return (
      data?.capabilities.filter((item) =>
        `${item.name} ${item.label} ${item.description}`
          .toLowerCase()
          .replaceAll("_", " ")
          .includes(search),
      ) ?? []
    );
  }, [data, query]);
  const groups = useMemo(
    () => ({
      reads: matched.filter((item) => item.impact === "read"),
      gated: matched.filter((item) => item.impact !== "read"),
    }),
    [matched],
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
        <AdminButton
          className="mt-4"
          onClick={() => {
            setError("");
            setData(null);
            setReload((value) => value + 1);
          }}
        >
          Retry
        </AdminButton>
      </AdminSurface>
    );
  const policies = [
    { label: "Bounded reads may execute directly", good: data!.safety.readsMayExecuteDirectly },
    { label: "Routine work uses scoped permission", good: true },
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
            <h2 className="text-balance text-xl font-semibold tracking-[-0.035em] text-[var(--admin-ink)]">
              Find what AI can do for your business
            </h2>
            <p className="admin-copy mt-2 max-w-2xl text-sm">
              Each job opens an editable AI request. Add the customer or task details, then send it
              when you&apos;re ready.
            </p>
            {data?.coverage?.universalCoverage === false && (
              <p className="admin-copy mt-3 max-w-2xl text-xs">
                Some admin operations still need an AI equivalent. Search for the exact action here
                before planning a workflow around it.
              </p>
            )}
          </div>
          <details className="text-xs lg:w-[340px]">
            <summary className="min-h-10 cursor-pointer py-3 font-medium">
              Action policies and safeguards
            </summary>
            <div className="grid gap-2">
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
          </details>
        </div>
      </AdminSurface>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-label="Business jobs for AI">
        {jobs.map((job) => (
          <AdminSurface key={job.title} padding="md">
            <h3 className="text-sm font-semibold">{job.title}</h3>
            <p className="admin-copy mt-2 text-sm">{job.detail}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <AdminButton
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("admin:open-ai", { detail: { prompt: job.prompt } }),
                  )
                }
              >
                Start a request
              </AdminButton>
              <Link
                href={job.guide}
                className="inline-flex min-h-10 items-center text-xs underline underline-offset-4"
              >
                Setup and steps
              </Link>
            </div>
          </AdminSurface>
        ))}
      </div>
      <details className="rounded-xl bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow-border)]">
        <summary className="min-h-10 cursor-pointer py-2 font-medium">
          Search all registered operations and technical details
        </summary>
        <div className="space-y-2">
          <label
            htmlFor="ai-capability-search"
            className="text-sm font-medium text-[var(--admin-ink)]"
          >
            Find a capability
          </label>
          <input
            id="ai-capability-search"
            ref={searchField}
            type="search"
            className="admin-field w-full"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Reports, contacts, tasks…"
          />
          <p className="admin-copy text-xs tabular-nums" role="status">
            {matched.length} of {data?.capabilities.length ?? 0} registered tools
          </p>
        </div>
        {matched.length === 0 && (
          <AdminSurface tone="subtle">
            <p className="text-sm font-medium text-[var(--admin-ink)]">No matching capabilities</p>
            <p className="admin-copy mt-1 text-xs">
              Try a business term or a tool name. A missing operation needs a supported service
              before AI can use it.
            </p>
            <AdminButton
              className="mt-3"
              onClick={() => {
                setQuery("");
                searchField.current?.focus({ preventScroll: true });
              }}
            >
              Clear search
            </AdminButton>
          </AdminSurface>
        )}
        {groups.reads.length > 0 && (
          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="mt-1 text-lg font-semibold text-[var(--admin-ink)]">
                  Reads and reports
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
        )}
        {groups.gated.length > 0 && (
          <section>
            <div className="mb-3">
              <h2 className="mt-1 text-lg font-semibold text-[var(--admin-ink)]">
                Work and changes
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
      </details>
    </div>
  );
}
