"use client";

import { tenant } from "@/config/tenant";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  CirclePause,
  Eye,
  Loader2,
  Megaphone,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { RevenueSetupGate } from "@/components/admin/RevenueSetupGate";
import { fetchJson } from "@/lib/admin/fetchJson";
import { cn } from "@/lib/utils";

interface Campaign {
  id: string;
  name: string;
  status: string;
  version: number;
  approved_version: number | null;
  approved_at: string | null;
  sender_email: string | null;
  policy: {
    daily_limit?: number;
    stop_on_reply?: boolean;
    stop_on_booking?: boolean;
    stop_on_bounce?: boolean;
    stop_on_unsubscribe?: boolean;
  };
  campaign_steps: Array<{
    id: string;
    step_order: number;
    delay_days: number;
    subject_template: string;
  }>;
  campaign_members: Array<{
    id: string;
    status: string;
    current_step: number;
    next_send_at: string | null;
    stop_reason: string | null;
    send_attempts: number | null;
  }>;
  created_at: string;
}
interface Preview {
  campaign: Campaign;
  policy: Record<string, unknown>;
  steps: Array<{
    step_order: number;
    delay_days: number;
    subject_template: string;
    body_template: string;
  }>;
  totals: { members: number; eligible: number; excluded: number };
  exclusions: Array<{ email: string; reason: string }>;
  samples: Array<{ email: string; subject: string; body: string }>;
}

const statusClass: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  paused: "bg-amber-500/12 text-amber-800 dark:text-amber-300",
  review: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  draft: "bg-black/[0.045] text-[var(--admin-muted)] dark:bg-white/[0.06]",
  completed: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  archived: "bg-black/[0.035] text-[var(--admin-muted)] dark:bg-white/[0.05]",
};

export default function CampaignsPage() {
  const [data, setData] = useState<{
    schemaReady: boolean;
    campaigns: Campaign[];
  } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await fetchJson("/api/admin/revenue-os/campaigns"));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load campaigns.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const loadPreview = async (id: string) => {
    setSaving(true);
    setError("");
    try {
      setPreview(
        await fetchJson(
          `/api/admin/revenue-os/campaigns/preview?id=${encodeURIComponent(id)}`,
        ),
      );
    } catch (previewError) {
      setError(
        previewError instanceof Error
          ? previewError.message
          : "Could not build campaign preview.",
      );
    } finally {
      setSaving(false);
    }
  };
  const campaignAction = async (
    id: string,
    action: "activate" | "pause" | "run",
  ) => {
    setSaving(true);
    setError("");
    try {
      await fetchJson("/api/admin/revenue-os/campaigns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      setPreview(null);
      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Could not update campaign.",
      );
    } finally {
      setSaving(false);
    }
  };

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const recipients = String(form.get("recipients") || "")
      .split(/[\n,;]/)
      .map((email) => email.trim())
      .filter(Boolean);
    try {
      const result = await fetchJson<{ campaign: Campaign }>(
        "/api/admin/revenue-os/campaigns",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.get("name"),
            senderEmail: form.get("senderEmail"),
            policy: {
              daily_limit: Math.min(10, Number(form.get("dailyLimit")) || 10),
              stop_on_reply: true,
              stop_on_booking: true,
              stop_on_bounce: true,
              stop_on_unsubscribe: true,
            },
            steps: [
              {
                delayDays: 0,
                subject: form.get("subject1"),
                body: form.get("body1"),
              },
            ],
          }),
        },
      );
      if (recipients.length)
        await fetchJson("/api/admin/revenue-os/campaigns/members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignId: result.campaign.id,
            members: recipients.map((email) => ({ email })),
          }),
        });
      setShowCreate(false);
      await load();
      await loadPreview(result.campaign.id);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not create campaign.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data)
    return (
      <div className="grid min-h-[55vh] place-items-center">
        <Loader2 className="size-6 animate-spin text-[var(--admin-muted)]" />
      </div>
    );
  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Campaigns"
        subtitle="Approve a campaign version once, then let controlled automation run inside its sender, audience, cadence, limit, and stop rules."
        actions={
          <>
            <button
              type="button"
              onClick={() => void load()}
              aria-label="Refresh campaigns"
              className="grid size-11 place-items-center rounded-xl text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[0.96]"
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--admin-ink)] pl-4 pr-3.5 text-xs font-semibold text-[var(--admin-surface)] transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.96]"
            >
              <Plus className="size-3.5" /> New campaign
            </button>
          </>
        }
      />
      {error && (
        <AdminSurface tone="attention" className="flex items-center gap-3">
          <TriangleAlert className="size-5 shrink-0 text-rose-600" />
          <p className="text-sm text-[var(--admin-ink)]">{error}</p>
        </AdminSurface>
      )}
      {data && !data.schemaReady ? (
        <RevenueSetupGate />
      ) : (
        data && (
          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-3">
              {data.campaigns.map((campaign) => {
                const memberCounts = campaign.campaign_members.reduce<
                  Record<string, number>
                >(
                  (counts, member) => ({
                    ...counts,
                    [member.status]: (counts[member.status] || 0) + 1,
                  }),
                  {},
                );
                return (
                  <AdminSurface key={campaign.id} padding="lg">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-lg font-semibold tracking-[-0.02em] text-[var(--admin-ink)]">
                            {campaign.name}
                          </h2>
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.08em]",
                              statusClass[campaign.status] || statusClass.draft,
                            )}
                          >
                            {campaign.status}
                          </span>
                        </div>
                        <p className="admin-copy mt-1 text-xs">
                          Version{" "}
                          <span className="tabular-nums">
                            {campaign.version}
                          </span>
                          {campaign.approved_version
                            ? ` · Approved v${campaign.approved_version}`
                            : " · Not approved"}
                        </p>
                      </div>
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-black/[0.045] text-[var(--admin-ink)] dark:bg-white/[0.06]">
                        <Megaphone className="size-[18px]" />
                      </span>
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-2">
                      {[
                        {
                          label: "Members",
                          value: campaign.campaign_members.length,
                        },
                        {
                          label: "Active",
                          value:
                            memberCounts.active || memberCounts.queued || 0,
                        },
                        { label: "Replies", value: memberCounts.replied || 0 },
                      ].map((metric) => (
                        <div
                          key={metric.label}
                          className="rounded-xl bg-black/[0.025] px-3 py-3 dark:bg-white/[0.025]"
                        >
                          <p className="font-mono text-lg font-semibold tabular-nums text-[var(--admin-ink)]">
                            {metric.value}
                          </p>
                          <p className="admin-copy mt-0.5 text-[10px]">
                            {metric.label}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void loadPreview(campaign.id)}
                        disabled={saving}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[0.96]"
                      >
                        <Eye className="size-3.5" /> Dry run
                      </button>
                      {campaign.status === "active" ? (
                        <button
                          type="button"
                          onClick={() =>
                            void campaignAction(campaign.id, "pause")
                          }
                          disabled={saving}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 text-xs font-semibold text-amber-800 transition-[opacity,transform] duration-150 active:scale-[0.96]"
                        >
                          <CirclePause className="size-3.5" /> Pause now
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void loadPreview(campaign.id)}
                          disabled={saving}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[var(--admin-ink)] px-3 text-xs font-semibold text-[var(--admin-surface)] transition-[opacity,transform] duration-150 active:scale-[0.96]"
                        >
                          <Play className="size-3.5" /> Review launch
                        </button>
                      )}
                    </div>
                  </AdminSurface>
                );
              })}
              {!data.campaigns.length && (
                <AdminSurface className="py-16 text-center">
                  <Megaphone className="mx-auto size-5 text-[var(--admin-muted)]" />
                  <p className="mt-3 text-sm font-semibold text-[var(--admin-ink)]">
                    No campaigns yet
                  </p>
                  <p className="admin-copy mt-1 text-xs">
                    Create an approved, bounded first campaign.
                  </p>
                </AdminSurface>
              )}
            </div>
            <div>
              {preview ? (
                <AdminSurface
                  padding="none"
                  className="sticky top-6 overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-4 p-5 sm:p-6">
                    <div>
                      <p className="admin-eyebrow">Preflight dry run</p>
                      <h2 className="mt-1 text-balance text-xl font-semibold tracking-[-0.03em] text-[var(--admin-ink)]">
                        {preview.campaign.name}
                      </h2>
                      <p className="admin-copy mt-1 text-pretty text-sm">
                        Nothing sends from this screen until the exact version
                        is activated.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreview(null)}
                      aria-label="Close preview"
                      className="grid size-10 place-items-center rounded-xl text-[var(--admin-muted)] transition-[background-color,color,transform] duration-150 hover:bg-black/[0.04] hover:text-[var(--admin-ink)] active:scale-[0.96] dark:hover:bg-white/[0.05]"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-px border-y border-[var(--admin-border)] bg-[var(--admin-border)]">
                    <div className="bg-[var(--admin-surface)] p-4">
                      <p className="font-mono text-2xl font-semibold tabular-nums text-[var(--admin-ink)]">
                        {preview.totals.eligible}
                      </p>
                      <p className="admin-copy mt-1 text-[10px]">Eligible</p>
                    </div>
                    <div className="bg-[var(--admin-surface)] p-4">
                      <p className="font-mono text-2xl font-semibold tabular-nums text-[var(--admin-ink)]">
                        {preview.totals.excluded}
                      </p>
                      <p className="admin-copy mt-1 text-[10px]">Excluded</p>
                    </div>
                    <div className="bg-[var(--admin-surface)] p-4">
                      <p className="font-mono text-2xl font-semibold tabular-nums text-[var(--admin-ink)]">
                        {String(preview.policy.daily_limit)}
                      </p>
                      <p className="admin-copy mt-1 text-[10px]">Daily limit</p>
                    </div>
                  </div>
                  <div className="space-y-5 p-5 sm:p-6">
                    <div>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="size-4 text-emerald-600" />
                        <h3 className="text-sm font-semibold text-[var(--admin-ink)]">
                          Stop controls
                        </h3>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {Object.entries(preview.policy)
                          .filter(
                            ([key, value]) => key.startsWith("stop_") && value,
                          )
                          .map(([key]) => (
                            <span
                              key={key}
                              className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300"
                            >
                              <Check className="mr-1 inline size-3" />
                              {key
                                .replace("stop_on_", "Stop on ")
                                .replaceAll("_", " ")}
                            </span>
                          ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--admin-ink)]">
                        Sequence
                      </h3>
                      <div className="mt-2 space-y-2">
                        {preview.steps.map((step) => (
                          <div
                            key={step.step_order}
                            className="flex items-start gap-3 rounded-xl bg-black/[0.025] p-3 dark:bg-white/[0.025]"
                          >
                            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[var(--admin-ink)] font-mono text-[10px] text-[var(--admin-surface)]">
                              {step.step_order}
                            </span>
                            <div>
                              <p className="text-xs font-semibold text-[var(--admin-ink)]">
                                {step.subject_template}
                              </p>
                              <p className="admin-copy mt-0.5 text-[10px]">
                                {step.delay_days
                                  ? `${step.delay_days} days after prior step`
                                  : "Immediately after activation"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {preview.samples[0] && (
                      <div>
                        <h3 className="text-sm font-semibold text-[var(--admin-ink)]">
                          Personalization sample
                        </h3>
                        <div className="mt-2 rounded-2xl bg-black/[0.025] p-2 dark:bg-white/[0.025]">
                          <div className="rounded-xl bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow-border)]">
                            <p className="font-mono text-[10px] text-[var(--admin-muted)]">
                              To {preview.samples[0].email}
                            </p>
                            <p className="mt-2 text-sm font-semibold text-[var(--admin-ink)]">
                              {preview.samples[0].subject}
                            </p>
                            <p className="mt-3 whitespace-pre-wrap text-pretty text-xs leading-5 text-[var(--admin-muted)]">
                              {preview.samples[0].body}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        void campaignAction(preview.campaign.id, "activate")
                      }
                      disabled={
                        saving ||
                        !preview.totals.eligible ||
                        !preview.steps.length
                      }
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--admin-ink)] px-4 text-xs font-semibold text-[var(--admin-surface)] transition-[opacity,transform] duration-150 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      {saving ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Play className="size-3.5" />
                      )}{" "}
                      Approve and activate version {preview.campaign.version}
                    </button>
                  </div>
                </AdminSurface>
              ) : (
                <AdminSurface className="grid min-h-80 place-items-center text-center">
                  <div>
                    <Eye className="mx-auto size-5 text-[var(--admin-muted)]" />
                    <h2 className="mt-4 text-balance text-lg font-semibold text-[var(--admin-ink)]">
                      Run a campaign preflight
                    </h2>
                    <p className="admin-copy mt-1 max-w-sm text-pretty text-sm">
                      Review eligible recipients, exclusions, stop rules,
                      sequence timing, and personalized copy before activation.
                    </p>
                  </div>
                </AdminSurface>
              )}
            </div>
          </div>
        )
      )}
      <AdminDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create campaign draft"
        labelledBy="new-campaign-title"
        maxWidth="lg"
      >
          <form
            onSubmit={(event) => void create(event)}
            className="admin-dialog-surface max-h-[92dvh] w-full overflow-y-auto rounded-[24px] bg-[var(--admin-surface)] p-2"
          >
            <div className="rounded-[20px] p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="admin-eyebrow">Controlled outbound</p>
                  <h2
                    id="new-campaign-title"
                    className="mt-1 text-balance text-xl font-semibold tracking-[-0.03em] text-[var(--admin-ink)]"
                  >
                    Create campaign draft
                  </h2>
                  <p className="admin-copy mt-1 text-pretty text-sm">
                    Create the version, recipients, limits, and sequence. You
                    will see a dry run before activation.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  aria-label="Close"
                  className="grid size-10 place-items-center rounded-xl text-[var(--admin-muted)] transition-[background-color,color,transform] duration-150 hover:bg-black/[0.04] active:scale-[0.96]"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-semibold text-[var(--admin-ink)]">
                  Campaign name
                  <input
                    name="name"
                    required
                    className="mt-1.5 min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-3.5 text-sm font-normal outline-none focus:border-[var(--admin-ink)]"
                  />
                </label>
                <label className="text-xs font-semibold text-[var(--admin-ink)]">
                  Sender email
                  <input
                    name="senderEmail"
                    type="email"
                    defaultValue={tenant.founder.email}
                    required
                    className="mt-1.5 min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-3.5 text-sm font-normal outline-none focus:border-[var(--admin-ink)]"
                  />
                </label>
                <label className="text-xs font-semibold text-[var(--admin-ink)]">
                  Daily limit
                  <input
                    name="dailyLimit"
                    type="number"
                    min="1"
                    max="200"
                    defaultValue="25"
                    required
                    className="mt-1.5 min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-3.5 text-sm font-normal outline-none focus:border-[var(--admin-ink)]"
                  />
                </label>
                <label className="text-xs font-semibold text-[var(--admin-ink)]">
                  Second-step delay
                  <input
                    name="delay2"
                    type="number"
                    min="1"
                    max="60"
                    defaultValue="3"
                    className="mt-1.5 min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-3.5 text-sm font-normal outline-none focus:border-[var(--admin-ink)]"
                  />
                </label>
              </div>
              <label className="mt-4 block text-xs font-semibold text-[var(--admin-ink)]">
                Recipients
                <textarea
                  name="recipients"
                  rows={4}
                  placeholder="one@example.com&#10;two@example.com"
                  className="mt-1.5 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-3.5 py-3 font-mono text-xs font-normal outline-none focus:border-[var(--admin-ink)]"
                />
              </label>
              <div className="mt-5 rounded-2xl bg-black/[0.025] p-2 dark:bg-white/[0.025]">
                <div className="rounded-xl bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow-border)]">
                  <p className="admin-eyebrow">Step 1</p>
                  <input
                    name="subject1"
                    required
                    placeholder="Subject — supports {{first_name}} and {{company}}"
                    className="mt-2 min-h-11 w-full rounded-xl border border-[var(--admin-border)] px-3.5 text-sm outline-none focus:border-[var(--admin-ink)]"
                  />
                  <textarea
                    name="body1"
                    required
                    rows={5}
                    placeholder="Personalized message"
                    className="mt-2 w-full rounded-xl border border-[var(--admin-border)] px-3.5 py-3 text-sm leading-6 outline-none focus:border-[var(--admin-ink)]"
                  />
                </div>
              </div>
              <details className="group mt-3 rounded-2xl shadow-[var(--admin-shadow-border)]">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-xs font-semibold text-[var(--admin-ink)]">
                  Add optional follow-up{" "}
                  <ChevronDown className="size-4 transition-transform duration-150 group-open:rotate-180" />
                </summary>
                <div className="border-t border-[var(--admin-border)] p-4">
                  <input
                    name="subject2"
                    placeholder="Follow-up subject"
                    className="min-h-11 w-full rounded-xl border border-[var(--admin-border)] px-3.5 text-sm outline-none focus:border-[var(--admin-ink)]"
                  />
                  <textarea
                    name="body2"
                    rows={4}
                    placeholder="Follow-up body"
                    className="mt-2 w-full rounded-xl border border-[var(--admin-border)] px-3.5 py-3 text-sm leading-6 outline-none focus:border-[var(--admin-ink)]"
                  />
                </div>
              </details>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="min-h-11 rounded-xl px-4 text-xs font-semibold text-[var(--admin-muted)] active:scale-[0.96]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--admin-ink)] px-4 text-xs font-semibold text-[var(--admin-surface)] transition-[opacity,transform] duration-150 active:scale-[0.96] disabled:opacity-50"
                >
                  {saving && <Loader2 className="size-3.5 animate-spin" />}{" "}
                  Create and preflight
                </button>
              </div>
            </div>
          </form>
      </AdminDialog>
    </div>
  );
}
