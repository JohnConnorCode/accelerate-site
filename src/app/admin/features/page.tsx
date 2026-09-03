"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  CalendarDays,
  CheckCircle2,
  Filter,
  GripVertical,
  KanbanSquare,
  Loader2,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Tag,
  TriangleAlert,
  UserRound,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { AdminReadBody } from "@/components/admin/AdminReadBody";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { PageHeader } from "@/components/admin/PageHeader";
import { RevenueSetupGate } from "@/components/admin/RevenueSetupGate";
import { KanbanBoard, type KanbanCardRenderOpts } from "@/components/kanban/KanbanBoard";
import { fetchJson } from "@/lib/admin/fetchJson";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { toast } from "@/lib/admin/useToast";
import { useKanbanColumns } from "@/lib/kanban/useKanbanColumns";
import type { KanbanColumnRecord } from "@/lib/kanban/types";
import { FEATURE_PRIORITIES, type FeaturePriority, type FeatureRequest } from "@/lib/feature-board";
import { cn } from "@/lib/utils";
import { tenant } from "@/config/tenant";

interface BoardResponse {
  schemaReady: boolean;
  features: FeatureRequest[];
}

const DEFAULT_MILESTONE_FILTER = "milestone:now";
const MILESTONE_OPTIONS = [
  "milestone:now",
  "milestone:next",
  "milestone:later",
  "milestone:done",
] as const;

function taxonomyLabel(label: string) {
  const [dimension, value] = label.split(":", 2);
  if (!value) return label.replaceAll("-", " ");
  if (dimension === "milestone") return value.charAt(0).toUpperCase() + value.slice(1);
  return value.replaceAll("-", " ");
}

const priorityMeta: Record<FeaturePriority, { label: string; tone: string; dot: string }> = {
  urgent: {
    label: "Urgent",
    tone: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  high: {
    label: "High",
    tone: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
    dot: "bg-orange-500",
  },
  medium: {
    label: "Medium",
    tone: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  low: {
    label: "Low",
    tone: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
    dot: "bg-slate-400",
  },
};

const emptyForm = {
  title: "",
  description: "",
  status: "backlog",
  priority: "medium" as FeaturePriority,
  labels: "",
  owner: "",
  target_date: "",
  acceptance_criteria: "",
  notes: "",
};

function featureForm(feature?: FeatureRequest | null) {
  if (!feature) return emptyForm;
  return {
    title: feature.title,
    description: feature.description ?? "",
    status: feature.status,
    priority: feature.priority,
    labels: feature.labels.join(", "),
    owner: feature.owner ?? "",
    target_date: feature.target_date ?? "",
    acceptance_criteria: feature.acceptance_criteria ?? "",
    notes: feature.notes ?? "",
  };
}

function dueLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function FeatureCard({
  feature,
  opts,
  onOpen,
}: {
  feature: FeatureRequest;
  opts: KanbanCardRenderOpts;
  onOpen?: () => void;
}) {
  const { isDragging, isOverlay, disabled, dragHandleProps } = opts;
  return (
    <article
      className={cn(
        "group rounded-2xl bg-[var(--admin-surface)] p-3.5 shadow-[var(--admin-shadow-border)] transition-[box-shadow,opacity,scale] duration-150",
        !isOverlay && "hover:-translate-y-px hover:shadow-[var(--admin-shadow-border-hover)]",
        isDragging &&
          !isOverlay &&
          "opacity-20 shadow-none ring-1 ring-dashed ring-[var(--admin-ink)]/20",
        isOverlay &&
          "w-[286px] scale-[1.015] cursor-grabbing shadow-[0_24px_60px_-22px_rgba(0,0,0,0.42)] ring-1 ring-black/8",
      )}
    >
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          aria-label={
            disabled ? "Reordering is unavailable while filters are active" : `Drag ${feature.title}`
          }
          disabled={disabled || isOverlay}
          className="grid size-10 shrink-0 touch-none cursor-grab place-items-center rounded-xl text-[var(--admin-muted)] transition-[background-color,color,transform] duration-150 hover:bg-black/[0.04] hover:text-[var(--admin-ink)] active:cursor-grabbing active:scale-[0.96] disabled:cursor-default disabled:opacity-30 dark:hover:bg-white/[0.05]"
          {...(!isOverlay ? dragHandleProps : {})}
        >
          <GripVertical className="size-4" />
        </button>
        <button
          type="button"
          onClick={onOpen}
          disabled={isOverlay}
          className="min-w-0 flex-1 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-ink)]/30"
        >
          <h3 className="text-pretty text-sm font-semibold leading-5 text-[var(--admin-ink)]">
            {feature.title}
          </h3>
          {feature.description && (
            <p className="admin-copy mt-1.5 line-clamp-2 text-xs leading-5">
              {feature.description}
            </p>
          )}
        </button>
        {!isOverlay && (
          <button
            type="button"
            onClick={onOpen}
            aria-label={`Edit ${feature.title}`}
            className="grid size-10 shrink-0 place-items-center rounded-xl text-[var(--admin-muted)] opacity-70 transition-[background-color,color,opacity,transform] duration-150 hover:bg-black/[0.04] hover:text-[var(--admin-ink)] active:scale-[0.96] group-hover:opacity-100 dark:hover:bg-white/[0.05]"
          >
            <Pencil className="size-3.5" />
          </button>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 pl-[50px]">
        <span
          className={cn(
            "inline-flex min-h-6 items-center gap-1.5 rounded-full px-2 text-[10px] font-semibold",
            priorityMeta[feature.priority].tone,
          )}
        >
          <span className={cn("size-1.5 rounded-full", priorityMeta[feature.priority].dot)} />
          {priorityMeta[feature.priority].label}
        </span>
        {feature.seed_key && (
          <span
            title="Managed by scripts/feature-backlog-data.mjs"
            className="inline-flex min-h-6 items-center gap-1 rounded-full bg-black/[0.045] px-2 text-[10px] font-medium text-[var(--admin-muted)] dark:bg-white/[0.06]"
          >
            <Lock className="size-2.5" />
            Managed
          </span>
        )}
        {feature.labels
          .filter((label) => label.startsWith("category:") || label.startsWith("capability:"))
          .map((label) => (
            <span
              key={label}
              title={label}
              className="inline-flex min-h-6 items-center rounded-full bg-black/[0.045] px-2 text-[10px] font-medium capitalize text-[var(--admin-muted)] dark:bg-white/[0.06]"
            >
              {taxonomyLabel(label)}
            </span>
          ))}
      </div>
      {(feature.owner || feature.target_date) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--admin-border)] pt-2.5 pl-[50px] text-[10px] text-[var(--admin-muted)]">
          {feature.owner && (
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="size-3" />
              {feature.owner}
            </span>
          )}
          {feature.target_date && (
            <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
              <CalendarDays className="size-3" />
              {dueLabel(feature.target_date)}
            </span>
          )}
        </div>
      )}
    </article>
  );
}

function FeatureDialog({
  open,
  feature,
  defaultStatus,
  columns,
  saving,
  onClose,
  onSave,
  onArchive,
}: {
  open: boolean;
  feature: FeatureRequest | null;
  defaultStatus: string;
  columns: KanbanColumnRecord[];
  saving: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  onArchive: (feature: FeatureRequest) => Promise<void>;
}) {
  const [form, setForm] = useState(() => ({
    ...featureForm(feature),
    status: feature?.status ?? defaultStatus,
  }));
  const inputClass =
    "mt-1.5 min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-3.5 text-sm font-normal text-[var(--admin-ink)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--admin-muted)]/65 focus:border-[var(--admin-ink)] focus:ring-2 focus:ring-[var(--admin-ink)]/10";
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSave({
      ...form,
      id: feature?.id,
      labels: form.labels
        .split(",")
        .map((label) => label.trim())
        .filter(Boolean),
    });
  };
  return (
    <AdminDialog
      open={open}
      onClose={onClose}
      title={feature ? "Edit feature" : "Add feature"}
      labelledBy="feature-dialog-title"
      maxWidth="lg"
    >
      <form
        onSubmit={(event) => void submit(event)}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[24px] bg-[var(--admin-surface)] shadow-2xl sm:rounded-[24px]"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface)]/95 px-5 py-4 backdrop-blur-xl sm:px-6">
          <div>
            <p className="admin-eyebrow">Feature board</p>
            <h2
              id="feature-dialog-title"
              className="mt-1 text-balance text-xl font-semibold tracking-[-0.03em] text-[var(--admin-ink)]"
            >
              {feature ? "Feature details" : "Add feature"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close feature details"
            className="grid size-10 place-items-center rounded-xl text-[var(--admin-muted)] transition-[background-color,color,transform] duration-150 hover:bg-black/[0.04] hover:text-[var(--admin-ink)] active:scale-[0.96] dark:hover:bg-white/[0.05]"
          >
            <X className="size-4" />
          </button>
        </div>
        {feature?.seed_key && (
          <div className="mx-5 mt-5 flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-3.5 py-3 sm:mx-6">
            <TriangleAlert className="mt-px size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="admin-copy text-[11px] leading-5">
              <span className="font-semibold text-[var(--admin-ink)]">
                Managed card ({feature.seed_key}).
              </span>{" "}
              Edits saved here are overwritten the next time the backlog is reconciled. Change it in{" "}
              <span className="font-mono">scripts/feature-backlog-data.mjs</span>, then run{" "}
              <span className="font-mono">npm run seed:features -- --apply</span>. Status and Owner
              are the exception only while a card is actively claimed.
            </p>
          </div>
        )}
        {!feature && (
          <div className="mx-5 mt-5 flex items-start gap-2.5 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-3.5 py-3 sm:mx-6">
            <TriangleAlert className="mt-px size-4 shrink-0 text-[var(--admin-muted)]" />
            <p className="admin-copy text-[11px] leading-5">
              Cards added here are not in the managed manifest and are archived the next time the
              backlog is reconciled. For work that should persist, add it to{" "}
              <span className="font-mono">scripts/feature-backlog-data.mjs</span> with a stable key.
            </p>
          </div>
        )}
        <div className="grid gap-5 px-5 py-5 sm:grid-cols-2 sm:px-6 sm:py-6">
          <label className="text-xs font-semibold text-[var(--admin-ink)] sm:col-span-2">
            Title
            <input
              autoFocus
              required
              maxLength={180}
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              className={inputClass}
              placeholder="What should we build?"
            />
          </label>
          <label className="text-xs font-semibold text-[var(--admin-ink)] sm:col-span-2">
            Description
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className={cn(inputClass, "min-h-24 py-3 leading-6")}
              placeholder="Why it matters and what should change"
            />
          </label>
          <label className="text-xs font-semibold text-[var(--admin-ink)]">
            Status
            <select
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
              className={inputClass}
            >
              {columns.map((column) => (
                <option key={column.column_key} value={column.column_key}>
                  {column.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-[var(--admin-ink)]">
            Priority
            <select
              value={form.priority}
              onChange={(event) =>
                setForm({ ...form, priority: event.target.value as FeaturePriority })
              }
              className={inputClass}
            >
              {FEATURE_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priorityMeta[priority].label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-[var(--admin-ink)]">
            Owner
            <input
              value={form.owner}
              onChange={(event) => setForm({ ...form, owner: event.target.value })}
              className={inputClass}
              placeholder={tenant.founder.name}
            />
          </label>
          <label className="text-xs font-semibold text-[var(--admin-ink)]">
            Target date
            <input
              type="date"
              value={form.target_date}
              onChange={(event) => setForm({ ...form, target_date: event.target.value })}
              className={inputClass}
            />
          </label>
          <label className="text-xs font-semibold text-[var(--admin-ink)] sm:col-span-2">
            Labels
            <input
              value={form.labels}
              onChange={(event) => setForm({ ...form, labels: event.target.value })}
              className={inputClass}
              placeholder="category:operator, milestone:later, phase:2, capability:admin-ux"
            />
            <span className="admin-copy mt-1.5 block text-[10px]">
              Use the controlled category, milestone, phase, and capability dimensions. Managed-card
              labels come from the manifest.
            </span>
          </label>
          <label className="text-xs font-semibold text-[var(--admin-ink)] sm:col-span-2">
            Definition of done
            <textarea
              rows={3}
              value={form.acceptance_criteria}
              onChange={(event) => setForm({ ...form, acceptance_criteria: event.target.value })}
              className={cn(inputClass, "min-h-24 py-3 leading-6")}
              placeholder="The observable result that proves this is shipped"
            />
          </label>
          <label className="text-xs font-semibold text-[var(--admin-ink)] sm:col-span-2">
            Internal notes
            <textarea
              rows={3}
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              className={cn(inputClass, "min-h-24 py-3 leading-6")}
              placeholder="Dependencies, decisions, links, or implementation notes"
            />
          </label>
        </div>
        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface)]/95 px-5 py-4 backdrop-blur-xl sm:px-6">
          <div>
            {feature && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void onArchive(feature)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-rose-700 transition-[background-color,transform] duration-150 hover:bg-rose-500/10 active:scale-[0.96] disabled:opacity-50 dark:text-rose-300"
              >
                <Archive className="size-3.5" /> Archive
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-xl px-4 text-xs font-semibold text-[var(--admin-muted)] transition-[color,transform] duration-150 hover:text-[var(--admin-ink)] active:scale-[0.96]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--admin-ink)] px-4 text-xs font-semibold text-[var(--admin-surface)] transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.96] disabled:opacity-50"
            >
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              {feature ? "Save changes" : "Add to board"}
            </button>
          </div>
        </div>
      </form>
    </AdminDialog>
  );
}

const FEATURES_QUERY_KEY = ["admin", "features"] as const;

export default function FeaturesPage() {
  const queryClient = useQueryClient();
  const featuresQuery = useAdminQuery<BoardResponse>(FEATURES_QUERY_KEY, "/api/admin/features");
  const data = featuresQuery.data ?? null;
  const setData = (
    updater: BoardResponse | null | ((current: BoardResponse | null) => BoardResponse | null),
  ) => {
    queryClient.setQueryData(FEATURES_QUERY_KEY, (current: BoardResponse | undefined) => {
      const next = typeof updater === "function" ? updater(current ?? null) : updater;
      return next ?? undefined;
    });
  };
  const { columns, createColumn, renameColumn, deleteColumn } = useKanbanColumns("features");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<"all" | FeaturePriority>("all");
  const [milestone, setMilestone] = useState<string>(DEFAULT_MILESTONE_FILTER);
  const [category, setCategory] = useState("all");
  const [capability, setCapability] = useState("all");
  const [openFeature, setOpenFeature] = useState<FeatureRequest | null>(null);
  const [featureDialogOpen, setFeatureDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<string>("backlog");

  const loading = featuresQuery.isPending;
  const error = featuresQuery.error?.message || "";
  const load = useCallback(async () => {
    await featuresQuery.refetch();
  }, [featuresQuery]);

  const features = useMemo(() => data?.features ?? [], [data?.features]);
  const labels = useMemo(
    () => [...new Set(features.flatMap((feature) => feature.labels))].sort(),
    [features],
  );
  const categories = useMemo(
    () => labels.filter((label) => label.startsWith("category:")),
    [labels],
  );
  const capabilities = useMemo(
    () => labels.filter((label) => label.startsWith("capability:")),
    [labels],
  );
  // Never open onto an empty board: if the milestone label is not in use, show everything.
  useEffect(() => {
    if (
      features.length &&
      milestone === DEFAULT_MILESTONE_FILTER &&
      !labels.includes(DEFAULT_MILESTONE_FILTER)
    )
      setMilestone("all");
  }, [features.length, labels, milestone]);
  const filtered = useMemo(
    () =>
      features.filter((feature) => {
        if (priority !== "all" && feature.priority !== priority) return false;
        if (milestone !== "all" && !feature.labels.includes(milestone)) return false;
        if (category !== "all" && !feature.labels.includes(category)) return false;
        if (capability !== "all" && !feature.labels.includes(capability)) return false;
        const term = search.trim().toLowerCase();
        return (
          !term ||
          [feature.title, feature.description, feature.owner, ...feature.labels]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(term)
        );
      }),
    [capability, category, features, milestone, priority, search],
  );
  const filtersActive = Boolean(
    search.trim() ||
    priority !== "all" ||
    milestone !== "all" ||
    category !== "all" ||
    capability !== "all",
  );

  const saveFeature = async (payload: Record<string, unknown>) => {
    setSaving(true);
    try {
      const updated = await fetchJson<FeatureRequest>("/api/admin/features", {
        method: payload.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setData((current) =>
        current
          ? {
              ...current,
              features: payload.id
                ? current.features.map((feature) => (feature.id === updated.id ? updated : feature))
                : [...current.features, updated],
            }
          : current,
      );
      setFeatureDialogOpen(false);
      toast.success(payload.id ? "Feature updated" : "Feature added to the board");
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Could not save feature.");
    } finally {
      setSaving(false);
    }
  };

  const archiveFeature = async (feature: FeatureRequest) => {
    if (
      !window.confirm(
        `Archive “${feature.title}”? It will leave the active board but remain in the audit history.`,
      )
    )
      return;
    setSaving(true);
    try {
      await fetchJson(`/api/admin/features?id=${encodeURIComponent(feature.id)}`, {
        method: "DELETE",
      });
      setData((current) =>
        current
          ? { ...current, features: current.features.filter((item) => item.id !== feature.id) }
          : current,
      );
      setFeatureDialogOpen(false);
      toast.success("Feature archived");
    } catch (archiveError) {
      toast.error(
        archiveError instanceof Error ? archiveError.message : "Could not archive feature.",
      );
    } finally {
      setSaving(false);
    }
  };

  const commitReorder = useCallback(
    async (updates: { id: string; column_key: string; sort_order: number }[]) => {
      await fetchJson("/api/admin/features", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reorder: updates }),
      });
      // The board already reflects the new order optimistically; refetch to
      // reconcile the shared query cache with the truthful server state.
      await featuresQuery.refetch();
    },
    [featuresQuery],
  );

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Feature Board"
        subtitle="A dependency-ordered execution queue. Milestone says when, category says who owns it, and capability says what it changes."
        utilityActions={
          <button
            type="button"
            onClick={() => void load()}
            disabled={featuresQuery.isFetching}
            aria-label="Refresh feature board"
            className="admin-icon-button shadow-[var(--admin-shadow-border)]"
          >
            <RefreshCw className={cn("size-4", featuresQuery.isFetching && "animate-spin")} />
          </button>
        }
        actions={
          <button
            type="button"
            onClick={() => {
              setNewStatus("backlog");
              setOpenFeature(null);
              setFeatureDialogOpen(true);
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--admin-ink)] px-4 text-xs font-semibold text-[var(--admin-surface)] transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.96]"
          >
            <Plus className="size-3.5" /> New feature
          </button>
        }
      />
      <AdminReadBody
        loading={loading}
        hasData={Boolean(data)}
        error={error}
        onRetry={() => void load()}
        refreshing={featuresQuery.isFetching}
        loadingFallback={<LoadingSkeleton variant="board" />}
        label="Loading feature board"
      >
        {data && !data.schemaReady ? (
          <RevenueSetupGate
            title="Activate the Feature Board"
            migration="migrations/20260816-feature-board.sql"
            detail="The migration seeds the known Revenue OS roadmap without overwriting future edits."
          />
        ) : (
          data && (
            <>
              <section className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    label: "Open work",
                    value: features.filter((feature) => feature.status !== "shipped").length,
                    note: "Across the active roadmap",
                    icon: KanbanSquare,
                  },
                  {
                    label: "Urgent",
                    value: features.filter(
                      (feature) => feature.priority === "urgent" && feature.status !== "shipped",
                    ).length,
                    note: "Requires the next decision",
                    icon: TriangleAlert,
                  },
                  {
                    label: "Shipped",
                    value: features.filter((feature) => feature.status === "shipped").length,
                    note: "Delivered and verified",
                    icon: CheckCircle2,
                  },
                ].map(({ label: metricLabel, value, note, icon: Icon }) => (
                  <AdminSurface key={metricLabel} padding="lg">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="admin-eyebrow">{metricLabel}</p>
                        <p className="mt-3 text-3xl font-semibold tabular-nums tracking-[-0.045em] text-[var(--admin-ink)]">
                          {value}
                        </p>
                        <p className="admin-copy mt-1 text-xs">{note}</p>
                      </div>
                      <span className="grid size-9 place-items-center rounded-xl bg-black/[0.045] text-[var(--admin-ink)] dark:bg-white/[0.06]">
                        <Icon className="size-4" />
                      </span>
                    </div>
                  </AdminSurface>
                ))}
              </section>
              <AdminSurface padding="sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--admin-muted)]" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search title, outcome, owner, or capability"
                      className="min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] pl-10 pr-3.5 text-sm text-[var(--admin-ink)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--admin-muted)]/70 focus:border-[var(--admin-ink)] focus:ring-2 focus:ring-[var(--admin-ink)]/10"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Filter className="size-4 text-[var(--admin-muted)]" />
                    <select
                      value={milestone}
                      onChange={(event) => setMilestone(event.target.value)}
                      aria-label="Filter by milestone"
                      className="min-h-11 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-xs font-semibold text-[var(--admin-ink)] outline-none focus:border-[var(--admin-ink)]"
                    >
                      <option value="all">All milestones</option>
                      {MILESTONE_OPTIONS.filter((value) => labels.includes(value)).map((value) => (
                        <option key={value} value={value}>
                          {taxonomyLabel(value)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                      aria-label="Filter by category"
                      className="min-h-11 max-w-48 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-xs font-semibold capitalize text-[var(--admin-ink)] outline-none focus:border-[var(--admin-ink)]"
                    >
                      <option value="all">All categories</option>
                      {categories.map((value) => (
                        <option key={value} value={value}>
                          {taxonomyLabel(value)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={capability}
                      onChange={(event) => setCapability(event.target.value)}
                      aria-label="Filter by capability"
                      className="min-h-11 max-w-48 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-xs font-semibold capitalize text-[var(--admin-ink)] outline-none focus:border-[var(--admin-ink)]"
                    >
                      <option value="all">All capabilities</option>
                      {capabilities.map((value) => (
                        <option key={value} value={value}>
                          {taxonomyLabel(value)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={priority}
                      onChange={(event) =>
                        setPriority(event.target.value as "all" | FeaturePriority)
                      }
                      aria-label="Filter by priority"
                      className="min-h-11 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-xs font-semibold text-[var(--admin-ink)] outline-none focus:border-[var(--admin-ink)]"
                    >
                      <option value="all">All priorities</option>
                      {FEATURE_PRIORITIES.map((value) => (
                        <option key={value} value={value}>
                          {priorityMeta[value].label}
                        </option>
                      ))}
                    </select>
                    <span className="rounded-full bg-black/[0.045] px-2.5 py-1 font-mono text-[10px] tabular-nums text-[var(--admin-muted)] dark:bg-white/[0.06]">
                      {filtered.length}
                    </span>
                  </div>
                </div>
                {filtersActive && (
                  <p className="mt-3 flex items-center gap-2 rounded-lg bg-[var(--admin-warning-soft)] px-3 py-2 text-xs font-medium text-[var(--admin-ink)]">
                    <Tag className="size-3.5 shrink-0 text-[var(--admin-warning)]" />
                    Dragging is off while a filter is active, so a card hidden by the filter keeps
                    its exact priority. Clear the filters above to reorder.
                  </p>
                )}
              </AdminSurface>
              {columns.length > 0 ? (
                <KanbanBoard<FeatureRequest>
                  columns={columns}
                  items={filtered}
                  getItemId={(feature) => feature.id}
                  getItemColumnKey={(feature) => feature.status}
                  getItemSortOrder={(feature) => Number(feature.sort_order)}
                  setItemPosition={(feature, columnKey, sortOrder) => ({
                    ...feature,
                    status: columnKey,
                    sort_order: sortOrder,
                  })}
                  renderCard={(feature, opts) => (
                    <FeatureCard
                      feature={feature}
                      opts={opts}
                      onOpen={() => {
                        setOpenFeature(feature);
                        setFeatureDialogOpen(true);
                      }}
                    />
                  )}
                  renderCardOverlay={(feature) => (
                    <FeatureCard
                      feature={feature}
                      opts={{ isDragging: true, isOverlay: true, disabled: true, dragHandleProps: {} }}
                    />
                  )}
                  onReorder={commitReorder}
                  dragDisabled={filtersActive}
                  onAddColumn={(input) => createColumn(input)}
                  onRenameColumn={(columnKey, label) => renameColumn(columnKey, { label })}
                  onDeleteColumn={(columnKey, options) => deleteColumn(columnKey, options)}
                />
              ) : (
                <LoadingSkeleton variant="board" />
              )}
              <div className="flex flex-col gap-2 rounded-2xl bg-black/[0.025] px-4 py-3 text-xs text-[var(--admin-muted)] dark:bg-white/[0.025] sm:flex-row sm:items-center sm:justify-between">
                <p>
                  Drag by the grip to reprioritize or move work. Open a card for its definition of
                  done and implementation notes.
                </p>
                <p className="shrink-0 font-mono text-[10px] tabular-nums">
                  Order saves automatically
                </p>
              </div>
            </>
          )
        )}
      </AdminReadBody>
      <FeatureDialog
        key={openFeature?.id ?? `new-${newStatus}`}
        open={featureDialogOpen}
        feature={openFeature}
        defaultStatus={newStatus}
        columns={columns}
        saving={saving}
        onClose={() => setFeatureDialogOpen(false)}
        onSave={saveFeature}
        onArchive={archiveFeature}
      />
    </div>
  );
}
