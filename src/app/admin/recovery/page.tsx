"use client";

import { FormEvent, useCallback, useState } from "react";
import {
  ArrowRight,
  CirclePause,
  DollarSign,
  Loader2,
  MailCheck,
  Play,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  UsersRound,
} from "lucide-react";
import { AdminReadBody } from "@/components/admin/AdminReadBody";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { EmptyState } from "@/components/admin/EmptyState";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { PageHeader } from "@/components/admin/PageHeader";
import { RevenueSetupGate } from "@/components/admin/RevenueSetupGate";
import { fetchJson } from "@/lib/admin/fetchJson";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { recoveryCopyTemplate, type RecoveryCopyMotion } from "@/lib/revenue-os/recovery-copy";

type Batch = {
  id: string;
  original_filename: string | null;
  status: string;
  completed_at: string | null;
  selected_row_count: number;
  created_at: string;
};
type Metrics = {
  eligible: number;
  excluded: number;
  replied: number;
  booked: number;
  won: number;
  estimatedValue: number;
  wonRevenue: number;
};
type Playbook = {
  id: string;
  campaign_id: string;
  motion_key: string;
  offer_label: string;
  booking_url: string;
  timezone: string;
  outcome_window_days: number;
  created_at: string;
  campaigns: {
    id: string;
    name: string;
    status: string;
    version: number;
    approved_version: number | null;
    campaign_members: Array<{ id: string; status: string }>;
  } | null;
  metrics: Metrics;
};
type Data = {
  schemaReady: boolean;
  defaultBookingUrl: string;
  batches: Batch[];
  playbooks: Playbook[];
};
type AudiencePreview = {
  totals: { candidates: number; eligible: number; excluded: number; estimatedValue: number };
  samples: Array<{
    email: string;
    status: "eligible" | "excluded";
    reason: string | null;
    estimatedValue: number;
  }>;
};

const motionLabels: Record<string, string> = {
  stale_lead: "Stale leads",
  unsold_estimate: "Unsold estimates",
  no_show: "No-shows",
  dormant_customer: "Dormant customers",
  lapsed_client: "Lapsed clients",
};
const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);

export default function RecoveryPage() {
  const query = useAdminQuery<Data>(["admin", "recovery"], "/api/admin/revenue-os/recovery");
  const data = query.data ?? null;
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sourceBatchId, setSourceBatchId] = useState("");
  const [motion, setMotion] = useState<RecoveryCopyMotion>("stale_lead");
  const [subject, setSubject] = useState(() => recoveryCopyTemplate("stale_lead").subject);
  const [body, setBody] = useState(() => recoveryCopyTemplate("stale_lead").body);
  const [audiencePreview, setAudiencePreview] = useState<AudiencePreview | null>(null);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    setError("");
    const result = await query.refetch();
    if (result.error) setError(result.error.message);
  }, [query]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await fetchJson("/api/admin/revenue-os/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          sourceBatchId: form.get("sourceBatchId"),
          motion: form.get("motion"),
          relationshipBasis: form.get("relationshipBasis"),
          offerLabel: form.get("offerLabel"),
          bookingUrl: form.get("bookingUrl"),
          timezone: form.get("timezone"),
          outcomeWindowDays: form.get("outcomeWindowDays"),
          steps: [{ delayDays: 0, subject: form.get("subject"), body: form.get("body") }],
        }),
      });
      event.currentTarget.reset();
      setMotion("stale_lead");
      setSubject(recoveryCopyTemplate("stale_lead").subject);
      setBody(recoveryCopyTemplate("stale_lead").body);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create recovery playbook");
    } finally {
      setCreating(false);
    }
  }
  async function action(playbook: Playbook, action: "activate" | "pause" | "run") {
    setBusyId(playbook.id);
    setError("");
    try {
      await fetchJson("/api/admin/revenue-os/recovery", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: playbook.campaign_id, action }),
      });
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update recovery playbook");
    } finally {
      setBusyId(null);
    }
  }
  async function previewAudience() {
    const batchId = sourceBatchId || data?.batches[0]?.id;
    if (!batchId) return;
    setError("");
    setAudiencePreview(null);
    try {
      setAudiencePreview(
        await fetchJson<AudiencePreview>(
          `/api/admin/revenue-os/recovery?batchId=${encodeURIComponent(batchId)}`,
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not preview the recovery audience");
    }
  }
  const topMetrics: Array<{ label: string; value: string | number; Icon: typeof UsersRound }> = data
    ? [
        {
          label: "Eligible",
          value: data.playbooks.reduce((sum, item) => sum + item.metrics.eligible, 0),
          Icon: UsersRound,
        },
        {
          label: "Replies",
          value: data.playbooks.reduce((sum, item) => sum + item.metrics.replied, 0),
          Icon: MailCheck,
        },
        {
          label: "Booked",
          value: data.playbooks.reduce((sum, item) => sum + item.metrics.booked, 0),
          Icon: Sparkles,
        },
        {
          label: "Recovered",
          value: money(data.playbooks.reduce((sum, item) => sum + item.metrics.wonRevenue, 0)),
          Icon: DollarSign,
        },
      ]
    : [];
  return (
    <div className="space-y-7 pb-10">
      <PageHeader
        title="Revenue Recovery"
        subtitle="Turn reviewed past relationships into governed, attributable opportunities. No email leaves until you approve an exact playbook version."
        actions={
          <button
            type="button"
            onClick={() => void reload()}
            aria-label="Refresh recovery"
            className="admin-icon-button shadow-[var(--admin-shadow-border)]"
          >
            <RefreshCw className={query.isFetching ? "size-3.5 animate-spin" : "size-3.5"} />
          </button>
        }
      />
      {error && (
        <AdminSurface tone="attention" className="flex gap-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p className="text-sm">{error}</p>
        </AdminSurface>
      )}
      <AdminReadBody
        loading={query.isPending}
        hasData={Boolean(data)}
        error={query.error?.message || ""}
        onRetry={() => void reload()}
        refreshing={query.isFetching}
        loadingFallback={<LoadingSkeleton variant="page" />}
        label="Loading recovery"
      >
        {data && !data.schemaReady ? (
          <RevenueSetupGate />
        ) : (
          data && (
            <>
              <AdminSurface padding="none" className="overflow-hidden">
                <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto]">
                  <div>
                    <p className="admin-eyebrow">First revenue machine</p>
                    <h2 className="mt-1 text-balance text-xl font-semibold tracking-[-0.03em]">
                      Recover the money already in the room
                    </h2>
                    <p className="admin-copy mt-2 max-w-2xl text-pretty text-sm">
                      Start with a reviewed import. The system excludes suppressed, active,
                      advanced, and already-enrolled records before it stages a campaign.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {topMetrics.map(({ label, value, Icon }) => (
                      <div
                        key={label}
                        className="rounded-xl bg-black/[0.035] px-3 py-3 dark:bg-white/[0.04]"
                      >
                        <Icon className="size-3.5 text-[var(--admin-muted)]" />
                        <p className="mt-2 font-mono text-lg font-semibold tabular-nums">{value}</p>
                        <p className="admin-copy text-[10px]">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </AdminSurface>
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="space-y-3">
                  {data.playbooks.map((playbook) => {
                    const campaign = playbook.campaigns;
                    const active = campaign?.status === "active";
                    const busy = busyId === playbook.id;
                    return (
                      <AdminSurface key={playbook.id} padding="lg">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-lg font-semibold">
                                {campaign?.name || "Recovery playbook"}
                              </p>
                              <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[.08em] text-violet-700 dark:text-violet-300">
                                {campaign?.status || "draft"}
                              </span>
                            </div>
                            <p className="admin-copy mt-1 text-xs">
                              {motionLabels[playbook.motion_key] || playbook.motion_key} ·{" "}
                              {playbook.offer_label} · v{campaign?.version || 1}
                            </p>
                          </div>
                          <span className="rounded-xl bg-black/[.04] px-3 py-2 font-mono text-xs font-semibold tabular-nums dark:bg-white/[.05]">
                            {playbook.metrics.eligible} staged
                          </span>
                        </div>
                        <div className="mt-5 grid grid-cols-4 gap-2">
                          {[
                            ["Eligible", playbook.metrics.eligible],
                            ["Excluded", playbook.metrics.excluded],
                            ["Replies", playbook.metrics.replied],
                            ["Won", playbook.metrics.won],
                          ].map(([label, value]) => (
                            <div
                              key={String(label)}
                              className="rounded-xl bg-[var(--admin-surface-subtle)] px-3 py-2.5"
                            >
                              <p className="font-mono text-base font-semibold tabular-nums">
                                {value as number}
                              </p>
                              <p className="admin-copy text-[10px]">{label}</p>
                            </div>
                          ))}
                        </div>
                        <div className="mt-5 flex flex-wrap gap-2">
                          {active ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void action(playbook, "pause")}
                              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 text-xs font-semibold text-amber-800 transition-[opacity,transform] active:scale-[.96] disabled:opacity-50 dark:text-amber-300"
                            >
                              <CirclePause className="size-3.5" />
                              Pause
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={busy || !playbook.metrics.eligible}
                              onClick={() => void action(playbook, "activate")}
                              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[var(--admin-ink)] px-3 text-xs font-semibold text-[var(--admin-surface)] transition-[opacity,transform] active:scale-[.96] disabled:opacity-50"
                            >
                              {busy ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Play className="size-3.5" />
                              )}
                              Approve and launch
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busy || !active}
                            onClick={() => void action(playbook, "run")}
                            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold shadow-[var(--admin-shadow-border)] transition-[box-shadow,transform] active:scale-[.96] disabled:opacity-50"
                          >
                            <ArrowRight className="size-3.5" />
                            Run due work
                          </button>
                        </div>
                      </AdminSurface>
                    );
                  })}
                  {!data.playbooks.length && (
                    <AdminSurface padding="none">
                      <EmptyState
                        icon={Sparkles}
                        title="No recovery playbook yet"
                        description="Complete a contact import, then stage a bounded recovery campaign from its reviewed records."
                        actionLabel="Open contact intake"
                        actionHref="/admin/contact-imports"
                      />
                    </AdminSurface>
                  )}
                </div>
                <AdminSurface padding="lg">
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-violet-500/10 text-violet-700 dark:text-violet-300">
                      <ShieldCheck className="size-4" />
                    </span>
                    <div>
                      <p className="admin-eyebrow">Create a recovery launch</p>
                      <h2 className="mt-1 text-balance text-lg font-semibold">
                        One approved audience, one useful next step
                      </h2>
                    </div>
                  </div>
                  {data.batches.length ? (
                    <form className="mt-5 space-y-3" onSubmit={(event) => void create(event)}>
                      <label className="admin-field-label">
                        <span>Reviewed import</span>
                        <select
                          required
                          name="sourceBatchId"
                          value={sourceBatchId || data.batches[0]?.id || ""}
                          onChange={(event) => {
                            setSourceBatchId(event.target.value);
                            setAudiencePreview(null);
                          }}
                          className="admin-field"
                        >
                          {data.batches.map((batch) => (
                            <option key={batch.id} value={batch.id}>
                              {batch.original_filename || "Untitled import"} ·{" "}
                              {batch.selected_row_count} selected
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => void previewAudience()}
                        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold shadow-[var(--admin-shadow-border)] transition-[box-shadow,transform] active:scale-[.96]"
                      >
                        <ScanSearch className="size-3.5" />
                        Preview exact audience
                      </button>
                      {audiencePreview && (
                        <div className="rounded-xl bg-[var(--admin-surface-subtle)] p-3">
                          <div className="grid grid-cols-3 gap-2">
                            <p className="font-mono text-sm font-semibold tabular-nums">
                              {audiencePreview.totals.eligible}
                              <span className="admin-copy ml-1 text-[10px]">eligible</span>
                            </p>
                            <p className="font-mono text-sm font-semibold tabular-nums">
                              {audiencePreview.totals.excluded}
                              <span className="admin-copy ml-1 text-[10px]">excluded</span>
                            </p>
                            <p className="font-mono text-sm font-semibold tabular-nums">
                              {money(audiencePreview.totals.estimatedValue)}
                              <span className="admin-copy ml-1 text-[10px]">est.</span>
                            </p>
                          </div>
                          <p className="admin-copy mt-2 text-[11px] leading-4">
                            {audiencePreview.samples
                              .filter((sample) => sample.status === "excluded")
                              .slice(0, 2)
                              .map((sample) => sample.reason)
                              .filter(Boolean)
                              .join(" · ") || "No exclusions in this reviewed sample."}
                          </p>
                        </div>
                      )}
                      <label className="admin-field-label">
                        <span>Recovery motion</span>
                        <select
                          name="motion"
                          value={motion}
                          onChange={(event) => setMotion(event.target.value as RecoveryCopyMotion)}
                          className="admin-field"
                        >
                          {Object.entries(motionLabels).map(([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const template = recoveryCopyTemplate(motion);
                          setSubject(template.subject);
                          setBody(template.body);
                        }}
                        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-violet-500/10 px-3 text-xs font-semibold text-violet-800 transition-[background-color,transform] active:scale-[.96] dark:text-violet-200"
                      >
                        <Sparkles className="size-3.5" />
                        Use vetted {motionLabels[motion]} copy
                      </button>
                      <label className="admin-field-label">
                        <span>Playbook name</span>
                        <input
                          required
                          name="name"
                          className="admin-field"
                          placeholder="Spring estimate recovery"
                        />
                      </label>
                      <label className="admin-field-label">
                        <span>Relationship basis</span>
                        <input
                          required
                          name="relationshipBasis"
                          className="admin-field"
                          placeholder="They requested an estimate in the last 12 months"
                        />
                      </label>
                      <label className="admin-field-label">
                        <span>Approved offer or next step</span>
                        <input
                          required
                          name="offerLabel"
                          className="admin-field"
                          placeholder="Book a 20-minute review"
                        />
                      </label>
                      <label className="admin-field-label">
                        <span>Booking URL</span>
                        <input
                          required
                          name="bookingUrl"
                          type="url"
                          defaultValue={data.defaultBookingUrl}
                          className="admin-field"
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="admin-field-label">
                          <span>Timezone</span>
                          <input
                            required
                            name="timezone"
                            defaultValue="America/Detroit"
                            className="admin-field"
                          />
                        </label>
                        <label className="admin-field-label">
                          <span>Outcome window</span>
                          <select name="outcomeWindowDays" className="admin-field">
                            <option value="30">30 days</option>
                            <option value="60">60 days</option>
                            <option value="90">90 days</option>
                          </select>
                        </label>
                      </div>
                      <label className="admin-field-label">
                        <span>Email subject</span>
                        <input
                          required
                          name="subject"
                          value={subject}
                          onChange={(event) => setSubject(event.target.value)}
                          className="admin-field"
                        />
                      </label>
                      <label className="admin-field-label">
                        <span>First email</span>
                        <textarea
                          required
                          name="body"
                          value={body}
                          onChange={(event) => setBody(event.target.value)}
                          rows={9}
                          className="admin-field resize-y py-3"
                        />
                      </label>
                      <p className="admin-copy -mt-1 text-pretty text-[11px] leading-4">
                        The vetted copy resolves your approved offer and booking URL at send time.
                        Edit every word before staging.
                      </p>
                      <button
                        type="submit"
                        disabled={creating}
                        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--admin-ink)] px-4 text-xs font-semibold text-[var(--admin-surface)] transition-[opacity,transform] active:scale-[.96] disabled:opacity-50"
                      >
                        {creating ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="size-3.5" />
                        )}
                        Stage recovery playbook
                      </button>
                      <p className="admin-copy text-pretty text-[11px] leading-4">
                        Staging creates a draft and receipts only. The exact audience, copy,
                        cadence, and stops remain visible before activation.
                      </p>
                    </form>
                  ) : (
                    <div className="mt-5 rounded-xl bg-[var(--admin-surface-subtle)] p-4">
                      <p className="text-sm font-semibold">Start with a reviewed import</p>
                      <p className="admin-copy mt-1 text-xs">
                        Recovery never emails an unreviewed list.
                      </p>
                    </div>
                  )}
                </AdminSurface>
              </div>
            </>
          )
        )}
      </AdminReadBody>
    </div>
  );
}
