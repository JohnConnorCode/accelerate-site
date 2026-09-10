"use client";

import { adminPageName } from "@/lib/admin/navigation";

import { AttentionList } from "@/components/admin/AttentionList";
import { projectOperatorAttention } from "@/lib/revenue-os/operator-attention";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "@/components/admin/AdminLink";
import { useAdminNavigation } from "@/components/admin/AdminLink";
import { ArrowRight, RefreshCw, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { LayoutCustomizeDialog } from "@/components/admin/LayoutCustomizeDialog";
import { CollectionCaseLinks } from "@/components/admin/CollectionsWorkspace";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { AdminAsyncRegion } from "@/components/admin/AdminAsyncRegion";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { ActionReviewDialog, type ActionRow } from "@/components/admin/ActionReviewDialog";
import { relativeTime } from "@/lib/admin/work-presentation";
import { RevenueAICommand } from "@/components/admin/RevenueAICommand";
import { RevenueSetupGate } from "@/components/admin/RevenueSetupGate";
import { fetchJson } from "@/lib/admin/fetchJson";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { useAdminDemo } from "@/components/admin/AdminDemoBoundary";
import { cn } from "@/lib/utils";
import { describeExpectedCheck } from "@/lib/revenue-os/health-expectation";
import { applyLayoutOverride, type LayoutDoc } from "@/lib/admin/layout-overrides";
import { TODAY_LAYOUT_REGIONS } from "@/lib/admin/layout-scopes";

interface QueueItem {
  id: string;
  kind: "reply" | "task" | "follow_up" | "proposal" | "meeting" | "approval" | "system";
  title: string;
  summary: string;
  urgency: "critical" | "high" | "normal" | "low";
  dueAt: string | null;
  sourceTimestamp: string;
  priorityReason: string;
  recommendedNextAction: string;
  href: string;
}
type HealthRun = import("@/lib/revenue-os/health").HealthRunView;
interface HealthWebhookFailure {
  id: string;
  provider: string;
  eventType: string | null;
  error: string | null;
  receivedAt: string | null;
  receiptHref?: string;
}
interface Overview {
  schemaReady: boolean;
  generatedAt: string;
  metrics: {
    openOpportunities: number;
    pipelineValue: number;
    weightedValue: number;
    wonRevenue: number;
    unreadConversations: number;
    activeCampaigns: number;
    pendingProposals: number;
  };
  queue: QueueItem[];
  integrations: Array<{
    provider: string;
    status: string;
    last_success_at: string | null;
    last_error: string | null;
  }>;
  health: {
    status: "ready" | "attention" | "not_configured";
    attentionCount: number;
    integrations: Array<{
      provider: string;
      status: string;
      lastSuccessAt: string | null;
      lastError: string | null;
      receiptHref?: string;
    }>;
    sourceRuns: HealthRun[];
    jobRuns: HealthRun[];
    webhookFailures: HealthWebhookFailure[];
    queueBacklog?: { pending: number; expired: number };
  };
}
function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

const focusOptions = [
  { id: "all", label: "All work" },
  { id: "reply", label: "Replies" },
  { id: "commitments", label: "Commitments" },
  { id: "approval", label: "Approvals" },
  { id: "proposal", label: "Proposals" },
] as const;

function observedTime(value: string) {
  if (value === "unknown" || Number.isNaN(Date.parse(value))) return "Source time unavailable";
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60_000));
  if (minutes < 1) return "Observed just now";
  if (minutes < 60) return `Observed ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Observed ${hours}h ago`;
  return `Observed ${Math.floor(hours / 24)}d ago`;
}

export default function TodayPage() {
  const searchParams = useSearchParams();
  const router = useAdminNavigation();
  const demo = useAdminDemo();
  const queryClient = useQueryClient();
  const overviewQuery = useAdminQuery<Overview>(
    ["today", "overview"],
    "/api/admin/revenue-os/overview",
  );
  const actionsQuery = useAdminQuery<{ actions: ActionRow[] }>(
    ["today", "actions"],
    "/api/admin/revenue-os/actions",
  );
  const layoutQuery = useAdminQuery<{ doc: LayoutDoc | null }>(
    ["today", "layout"],
    "/api/admin/revenue-os/layout?scope=page.today",
  );
  const overview = overviewQuery.data ?? null;
  const todayLayoutDoc = layoutQuery.data?.doc ?? null;
  // Preserve the existing layout visibility setting while keeping the business
  // snapshot in a disclosure below the operator attention sections.
  const operatingSummaryHidden = Boolean(todayLayoutDoc?.hidden.includes("operating-summary"));
  const tailRegions = useMemo(
    () =>
      applyLayoutOverride(
        TODAY_LAYOUT_REGIONS.filter((region) => region.id !== "operating-summary"),
        ["revenue-copilot"],
        todayLayoutDoc,
      ),
    [todayLayoutDoc],
  );
  const actions = useMemo(() => {
    const now = Date.now();
    return (actionsQuery.data?.actions ?? []).filter(
      (action) =>
        action.status === "pending" && (!action.expires_at || Date.parse(action.expires_at) > now),
    );
  }, [actionsQuery.data]);
  const [reviewing, setReviewing] = useState<ActionRow | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [mutationError, setMutationError] = useState("");
  const [acting, setActing] = useState<string | null>(null);
  const [taskActioning, setTaskActioning] = useState<string | null>(null);
  const [focus, setFocus] = useState<(typeof focusOptions)[number]["id"]>("all");
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const dismissedActionRef = useRef<string | null>(null);
  const reviewTriggerRef = useRef<HTMLElement | null>(null);
  const loading = overviewQuery.isPending || actionsQuery.isPending;
  const refreshing = overviewQuery.isFetching || actionsQuery.isFetching;
  const error = mutationError || overviewQuery.error?.message || actionsQuery.error?.message || "";
  const refresh = async () => {
    setMutationError("");
    await Promise.all([overviewQuery.refetch(), actionsQuery.refetch()]);
  };

  useEffect(() => {
    const requestedFocus = searchParams.get("focus");
    if (requestedFocus === "approvals") {
      setFocus("approval");
    } else if (focusOptions.some((option) => option.id === requestedFocus))
      setFocus(requestedFocus as (typeof focusOptions)[number]["id"]);
  }, [searchParams]);

  useEffect(() => {
    const actionId = searchParams.get("action");
    if (!actionId) {
      dismissedActionRef.current = null;
      return;
    }
    if (dismissedActionRef.current === actionId) return;
    const requested = actions.find((action) => action.id === actionId);
    if (requested) {
      if (reviewing?.id !== requested.id) setReviewing(requested);
      setReviewOpen(true);
    }
  }, [actions, reviewing?.id, searchParams]);

  const closeReview = () => {
    const actionId = reviewing?.id ?? searchParams.get("action");
    dismissedActionRef.current = actionId;
    setReviewOpen(false);
    if (searchParams.has("action")) router.replace(`/admin/today?focus=${focus}`, "preserve");
    window.setTimeout(() => {
      const fallback = actionId
        ? document.querySelector<HTMLElement>(`[data-approval-review="${CSS.escape(actionId)}"]`)
        : null;
      (reviewTriggerRef.current?.isConnected ? reviewTriggerRef.current : fallback)?.focus();
    }, 260);
  };

  const openReview = (
    action: ActionRow,
    href = `/admin/today?focus=approval&action=${encodeURIComponent(action.id)}`,
    trigger?: HTMLElement,
  ) => {
    dismissedActionRef.current = null;
    reviewTriggerRef.current = trigger ?? null;
    setReviewing(action);
    setReviewOpen(true);
    router.push(href, "preserve");
  };

  const decide = async (id: string, decision: "approve" | "reject") => {
    setActing(id);
    try {
      await fetchJson("/api/admin/revenue-os/actions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, decision }),
      });
      closeReview();
      queryClient.setQueryData<{ actions: ActionRow[] }>(["today", "actions"], (current) =>
        current ? { actions: current.actions.filter((action) => action.id !== id) } : current,
      );
      queryClient.setQueryData<Overview>(["today", "overview"], (current) =>
        current
          ? { ...current, queue: current.queue.filter((item) => item.id !== `action:${id}`) }
          : current,
      );
      await refresh();
      window.dispatchEvent(new Event("admin:priority-refresh"));
    } catch (decisionError) {
      setMutationError(
        decisionError instanceof Error ? decisionError.message : "Could not handle the action.",
      );
    } finally {
      setActing(null);
    }
  };

  const updateTask = async (id: string, action: "complete" | "snooze") => {
    setTaskActioning(`${id}:${action}`);
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      await fetchJson("/api/admin/revenue-os/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action,
          ...(action === "snooze" ? { until: tomorrow.toISOString().slice(0, 10) } : {}),
        }),
      });
      queryClient.setQueryData<Overview>(["today", "overview"], (current) =>
        current
          ? { ...current, queue: current.queue.filter((item) => item.id !== `task:${id}`) }
          : current,
      );
      await refresh();
      window.dispatchEvent(new Event("admin:priority-refresh"));
    } catch (taskError) {
      setMutationError(taskError instanceof Error ? taskError.message : "Could not update task.");
    } finally {
      setTaskActioning(null);
    }
  };

  const urgentCount = useMemo(
    () => overview?.queue.filter((item) => ["critical", "high"].includes(item.urgency)).length ?? 0,
    [overview],
  );
  const visibleQueue = useMemo(() => {
    const queue = overview?.queue ?? [];
    if (focus === "all") return queue;
    if (focus === "commitments")
      return queue.filter(
        (item) => item.kind === "task" || item.kind === "follow_up" || item.kind === "meeting",
      );
    return queue.filter((item) => item.kind === focus);
  }, [focus, overview]);
  const healthItems = useMemo(() => {
    if (!overview) return [];
    const runExpectation = (item: HealthRun) =>
      item.stalled
        ? "Stalled: the next run takes the claim over"
        : describeExpectedCheck(item.nextExpectedAt, item.cadenceLabel);
    const webhookFailures = overview.health.webhookFailures ?? [];
    const queueBacklog = overview.health.queueBacklog;
    const attention = (status: string, error: string | null) =>
      Boolean(error) || ["failed", "partial", "degraded", "revoked", "expired"].includes(status);
    const items = [
      ...overview.health.integrations.map((item) => ({
        label: item.provider,
        status: item.status,
        at: item.lastSuccessAt,
        error: item.lastError,
        expectation: null as string | null,
        href: item.receiptHref ?? "/admin/integrations",
      })),
      ...overview.health.sourceRuns.map((item) => ({
        label: item.key,
        status: item.status,
        at: item.finishedAt || item.startedAt,
        error: item.error,
        expectation: [runExpectation(item), item.output?.detail].filter(Boolean).join(" "),
        href: item.receiptHref ?? "/admin/setup#operations",
      })),
      ...overview.health.jobRuns.map((item) => ({
        label: item.key,
        status: item.status,
        at: item.finishedAt || item.startedAt,
        error: item.error,
        expectation: runExpectation(item),
        href: item.receiptHref ?? "/admin/setup#operations",
      })),
      ...webhookFailures.slice(0, 1).map((item) => ({
        label: `Webhook failure: ${item.provider}`,
        status: "failed",
        at: item.receivedAt,
        error: item.error,
        expectation:
          webhookFailures.length > 1
            ? `+${webhookFailures.length - 1} more unprocessed in the last 48h`
            : "Unprocessed in the last 48h. See Setup Center",
        href: item.receiptHref ?? "/admin/setup#operations",
      })),
      ...(queueBacklog && (queueBacklog.pending || queueBacklog.expired)
        ? [
            {
              label: "Action queue",
              status: queueBacklog.expired ? "expired" : "pending",
              at: null as string | null,
              error: queueBacklog.expired ? `${queueBacklog.expired} expired` : null,
              expectation: `${queueBacklog.pending} pending · ${queueBacklog.expired} expired`,
              href: "/admin/today",
            },
          ]
        : []),
    ];
    return items
      .sort((a, b) => Number(attention(b.status, b.error)) - Number(attention(a.status, a.error)))
      .slice(0, 8);
  }, [overview]);

  if (!overview && error)
    return (
      <div className="space-y-7 pb-10">
        <PageHeader
          title={adminPageName("today")}
          subtitle="The founder queue could not be assembled yet."
        />
        <AdminSurface
          tone="attention"
          className="mx-auto flex max-w-2xl flex-col items-start gap-4 p-6 sm:flex-row sm:items-center"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-300">
            <TriangleAlert className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-[var(--admin-ink)]">
              Today is temporarily unavailable
            </h2>
            <p className="admin-copy mt-1 text-sm">
              {error} No work was hidden or changed. Retry the live read, or open Setup Center to
              inspect system health.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void refresh()}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--admin-ink)] px-4 text-xs font-semibold text-[var(--admin-surface)]"
              >
                <RefreshCw className="size-3.5" /> Retry
              </button>
              <Link
                href="/admin/setup"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-xs font-semibold text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)]"
              >
                Open Setup <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </AdminSurface>
      </div>
    );

  const tailRegionNodes: Record<string, React.ReactNode> = {
    "operational-ledger": (
      <AdminSurface padding="none" className="hidden overflow-hidden md:block">
        <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <div>
            <p className="admin-eyebrow">Operational ledger</p>
            <h2 className="mt-1 text-balance text-lg font-semibold tracking-[-0.02em] text-[var(--admin-ink)]">
              Connection and job health
            </h2>
          </div>
          <Link
            href="/admin/setup"
            className="text-xs font-semibold text-[var(--admin-ink)] underline decoration-[var(--admin-border)] underline-offset-4 hover:decoration-[var(--admin-ink)]"
          >
            Details
          </Link>
        </div>
        <div className="admin-health-grid">
          {healthItems.map((item) => (
            <Link
              key={`${item.label}-${item.status}`}
              href={item.href}
              className="min-h-[96px] px-5 py-4 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    item.status === "success" || item.status === "connected"
                      ? "bg-emerald-500"
                      : item.status === "failed" ||
                          item.status === "partial" ||
                          item.status === "degraded" ||
                          item.status === "revoked" ||
                          item.status === "expired"
                        ? "bg-amber-500"
                        : "bg-[var(--admin-muted)]",
                  )}
                />
                <p className="truncate text-xs font-semibold text-[var(--admin-ink)]">
                  {item.label}
                </p>
              </div>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted)]">
                {item.status.replace(/_/g, " ")}
              </p>
              <p className="admin-copy mt-1 line-clamp-2 text-xs">
                {item.error ||
                  (item.at ? `Last activity ${relativeTime(item.at)}` : "No run recorded yet")}
              </p>
              {item.expectation && (
                <p className="mt-1 text-[11px] font-medium text-[var(--admin-muted)]">
                  {item.expectation}
                </p>
              )}
            </Link>
          ))}
          {!healthItems.length && (
            <div className="px-6 py-8 text-sm text-[var(--admin-muted)] sm:col-span-2 lg:col-span-6">
              No connections or job receipts have been recorded. Setup Center will show exactly what
              needs configuration.
            </div>
          )}
        </div>
      </AdminSurface>
    ),
    "revenue-copilot": (
      <div id="revenue-copilot" className="scroll-mt-24">
        <RevenueAICommand onProposed={() => void refresh()} />
      </div>
    ),
  };

  return (
    <div className="space-y-4 pb-10 sm:space-y-7">
      <PageHeader
        title={adminPageName("today")}
        subtitle="See urgent priorities, upcoming commitments, and the next steps that need your attention."
        actions={
          <button
            type="button"
            onClick={() => setCustomizeOpen(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-xs font-semibold text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] transition-[box-shadow] hover:shadow-[var(--admin-shadow-border-hover)]"
          >
            <SlidersHorizontal className="size-3.5" /> Customize
          </button>
        }
        utilityActions={
          <>
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted)] sm:inline">
              {overview?.generatedAt
                ? `Updated ${observedTime(overview.generatedAt).replace(/^Observed /, "")}`
                : "Live read"}
            </span>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
              aria-label={refreshing ? "Refreshing Today" : "Refresh Today"}
              className="admin-icon-button shadow-[var(--admin-shadow-border)] disabled:opacity-60"
            >
              <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
            </button>
          </>
        }
      />
      {error && overview && (
        <AdminSurface
          tone="attention"
          className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
        >
          <TriangleAlert className="size-5 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--admin-ink)]">
              Showing the last successful snapshot
            </p>
            <p className="admin-copy mt-0.5 text-xs">
              {error} Existing data remains visible and no counters were reset.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)]"
          >
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} /> Retry live read
          </button>
        </AdminSurface>
      )}
      <AdminAsyncRegion
        loading={loading}
        hasData={Boolean(overview)}
        loadingFallback={<LoadingSkeleton variant="today" rows={4} />}
        label="Loading today's operating queue"
      >
        {overview && !overview.schemaReady ? (
          <RevenueSetupGate />
        ) : (
          overview && (
            <div className="space-y-5 sm:space-y-7" data-today-content-stack>
              {!demo && overview.health.status === "attention" && (
                <AdminSurface
                  tone="default"
                  className="hidden flex-col gap-3 p-4 sm:flex sm:flex-row sm:items-center sm:justify-between sm:px-5"
                  style={
                    overview.health.status === "attention"
                      ? {
                          background: "color-mix(in srgb, var(--admin-surface) 86%, #f59e0b 14%)",
                          boxShadow: "inset 3px 0 0 rgba(245,158,11,.72), var(--admin-shadow)",
                        }
                      : undefined
                  }
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        "grid size-10 shrink-0 place-items-center rounded-full",
                        overview.health.status === "attention"
                          ? "bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/15 dark:text-amber-300"
                          : overview.health.status === "ready"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "bg-black/[0.045] text-[var(--admin-muted)] dark:bg-white/[0.06]",
                      )}
                    >
                      <TriangleAlert className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--admin-ink)]">
                        {overview.health.status === "attention"
                          ? `${overview.health.attentionCount} operational item${overview.health.attentionCount === 1 ? "" : "s"} need attention`
                          : overview.health.status === "ready"
                            ? "Revenue operations are reporting normally"
                            : "Revenue integrations are not configured yet"}
                      </p>
                      <p className="admin-copy mt-0.5 text-xs">
                        {overview.health.status === "attention"
                          ? "Review failures before they silently delay customer work."
                          : overview.health.status === "ready"
                            ? "Recent connections and job runs are healthy."
                            : "Setup Center verifies live behavior once connections are enabled."}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/admin/setup"
                    className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[0.98]"
                  >
                    Open Setup <ArrowRight className="size-3.5" />
                  </Link>
                </AdminSurface>
              )}

              <div
                className="scrollbar-hide flex gap-2 overflow-x-auto"
                data-priority-tabs
                aria-label="Filter attention"
              >
                {focusOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setFocus(option.id)}
                    aria-pressed={focus === option.id}
                    className={cn(
                      "min-h-11 shrink-0 rounded-lg px-3 text-sm font-medium",
                      focus === option.id
                        ? "bg-[var(--admin-ink)] text-[var(--admin-surface)]"
                        : "text-[var(--admin-muted)] hover:bg-[var(--admin-surface-subtle)]",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <AttentionList
                items={projectOperatorAttention(visibleQueue)}
                busyTask={taskActioning}
                onTask={(id, action) => void updateTask(id, action)}
                onReview={(id, trigger) => {
                  const action = actions.find((item) => item.id === id);
                  if (action) openReview(action, undefined, trigger);
                  else
                    setMutationError(
                      "This approval is no longer pending. Refresh to see its current state.",
                    );
                }}
              />
              <Link
                href="/admin/work"
                className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--admin-ink)]"
              >
                Open all work <ArrowRight className="size-4" />
              </Link>

              <details className="admin-disclosure">
                <summary className="cursor-pointer text-sm font-semibold text-[var(--admin-ink)]">
                  Business snapshot and App follow-up
                </summary>
                <div className="space-y-4 px-4 pb-4">
                  <CollectionCaseLinks />
                  {!operatingSummaryHidden && (
                    <AdminSurface
                      padding="none"
                      className="overflow-hidden"
                      aria-label="Operating summary"
                    >
                      <dl className="grid grid-cols-2 divide-x divide-y divide-[var(--admin-border)] xl:grid-cols-4 xl:divide-y-0">
                        {[
                          {
                            label: "Priority work",
                            value: urgentCount,
                            note: `${overview.queue.length} total`,
                          },
                          {
                            label: "Open pipeline",
                            value: formatMoney(overview.metrics.pipelineValue),
                            note: `${formatMoney(overview.metrics.weightedValue)} weighted`,
                          },
                          {
                            label: "Unread replies",
                            value: overview.metrics.unreadConversations,
                            note: "Synced conversations",
                          },
                          {
                            label: "Active campaigns",
                            value: overview.metrics.activeCampaigns,
                            note: `${overview.metrics.pendingProposals} proposals awaiting`,
                          },
                        ].map(({ label, value, note }) => (
                          <div
                            key={label}
                            className="min-w-0 px-4 py-3.5 sm:min-h-[96px] sm:px-5 sm:py-4"
                          >
                            <dt className="truncate text-[9px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-muted)] sm:text-[10px] sm:normal-case sm:tracking-normal">
                              {label}
                            </dt>
                            <dd className="mt-1 truncate text-[clamp(1.25rem,6vw,1.75rem)] font-semibold tabular-nums tracking-[-0.045em] text-[var(--admin-ink)] sm:text-2xl">
                              {value}
                            </dd>
                            <p className="admin-copy mt-0.5 truncate text-[9px] sm:text-[10px]">
                              {note}
                            </p>
                          </div>
                        ))}
                      </dl>
                    </AdminSurface>
                  )}
                </div>
              </details>

              {tailRegions.map((region) => (
                <Fragment key={region.id}>{tailRegionNodes[region.id]}</Fragment>
              ))}

              <ActionReviewDialog
                error={mutationError}
                open={reviewOpen}
                action={reviewing}
                busy={Boolean(reviewing && acting === reviewing.id)}
                onClose={closeReview}
                onApprove={() => {
                  if (reviewing) void decide(reviewing.id, "approve");
                }}
                onReject={() => {
                  if (reviewing) void decide(reviewing.id, "reject");
                }}
              />
              <LayoutCustomizeDialog
                open={customizeOpen}
                onClose={() => setCustomizeOpen(false)}
                scope="page.today"
                currentDoc={todayLayoutDoc}
                onSaved={() => void layoutQuery.refetch()}
              />
            </div>
          )
        )}
      </AdminAsyncRegion>
    </div>
  );
}
