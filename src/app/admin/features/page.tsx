"use client";

import { WorkAgents } from "@/components/admin/work-board/WorkAgents";
import { WorkViews, type WorkFilters } from "@/components/admin/work-board/WorkViews";
import { WorkControls, sendWork } from "@/components/admin/work-board/WorkControls";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { KanbanChecklist } from "@/components/kanban/KanbanChecklist";
import { KanbanListView } from "@/components/kanban/KanbanListView";
import { KanbanViewSwitcher, useKanbanView } from "@/components/kanban/KanbanViewSwitcher";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { toast } from "@/lib/admin/useToast";
import { useKanbanColumns } from "@/lib/kanban/useKanbanColumns";
import {
  parseWipLimit,
  type KanbanColumnMetadata,
  type KanbanColumnRecord,
} from "@/lib/kanban/types";
import {
  FEATURE_BOARD_WIP_LIMIT,
  FEATURE_PRIORITIES,
  hydrateSubtasks,
  isFeatureOverdue,
  moveSubtask,
  parseAcceptanceLines,
  remainingSubtasks,
  renameSubtask,
  subtaskProgress,
  toggleSubtask,
  type FeaturePriority,
  type FeatureRequest,
  type FeatureSubtask,
} from "@/lib/feature-board";
import { cn } from "@/lib/utils";
import { tenant } from "@/config/tenant";

interface BoardResponse {
  nextOffset?: number | null;
  schemaReady: boolean;
  features: FeatureRequest[];
}

/** Working set: Now plus Next. Now is kept small on purpose; opening onto
 *  it alone makes the board look empty. Unlabeled (unmanaged) cards stay
 *  visible so a newly added card doesn't vanish. */
const DEFAULT_MILESTONE_FILTER = "active";
const MILESTONE_OPTIONS = [
  "milestone:now",
  "milestone:next",
  "milestone:later",
  "milestone:done",
] as const;

function hasMilestoneLabel(labels: string[]) {
  return labels.some((label) => label.startsWith("milestone:"));
}

function matchesMilestone(labels: string[], milestone: string) {
  if (milestone === "all") return true;
  if (milestone === "active") {
    if (!hasMilestoneLabel(labels)) return true;
    return labels.includes("milestone:now") || labels.includes("milestone:next");
  }
  return labels.includes(milestone);
}

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
  initiative: "",
  work_kind: "feature",
  parent_id: "",
  subtasks: [] as FeatureSubtask[],
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
    initiative: feature.initiative ?? "",
    work_kind: feature.work_kind ?? "feature",
    parent_id: feature.parent_id ?? "",
    subtasks: hydrateSubtasks(feature),
  };
}

function dueLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

const FILTERS_STORAGE_KEY = "kanban-filters:features";

function readStoredFilters() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      milestone?: string;
      category?: string;
      capability?: string;
      ownerFilter?: string;
      priority?: "all" | FeaturePriority;
    };
    return parsed;
  } catch {
    return null;
  }
}

function assigneeOptions(owners: string[], current: string | null) {
  const unique = [
    ...new Set([tenant.founder.name, tenant.founder.fullName, ...owners, current].filter(Boolean)),
  ] as string[];
  return unique;
}

function FeatureCard({
  feature,
  opts,
  onOpen,
  onToggleSubtask,
  onAssign,
  onMove,
  assignees,
  columns,
}: {
  feature: FeatureRequest;
  opts: KanbanCardRenderOpts;
  onOpen?: () => void;
  onToggleSubtask?: (id: string) => void;
  onAssign?: (owner: string | null) => void;
  onMove?: (columnKey: string) => void;
  assignees?: string[];
  columns?: KanbanColumnRecord[];
}) {
  const { isDragging, isOverlay, disabled, dragHandleProps } = opts;
  const subtasks = hydrateSubtasks(feature);
  const progress = subtaskProgress(subtasks);
  const overdue = isFeatureOverdue(feature);
  const claimedBy =
    feature.lease_owner || (feature.status === "in_progress" ? feature.owner : null);
  const people = assigneeOptions(assignees ?? [], feature.owner);
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
            disabled
              ? "Reordering is unavailable while filters are active"
              : `Drag ${feature.title}`
          }
          disabled={disabled || isOverlay}
          className="hidden size-10 shrink-0 touch-none cursor-grab place-items-center rounded-xl text-[var(--admin-muted)] transition-[background-color,color,transform] duration-150 hover:bg-black/[0.04] hover:text-[var(--admin-ink)] active:cursor-grabbing active:scale-[0.96] disabled:cursor-default disabled:opacity-30 dark:hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-ink)]/40 sm:grid"
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
          <h3 className="text-pretty text-sm font-semibold leading-5 break-words text-[var(--admin-ink)]">
            {feature.title}
          </h3>
          {feature.description && (
            <p className="admin-copy mt-1.5 line-clamp-2 text-xs leading-5 break-words">
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
      <div className="mt-3 flex flex-wrap items-center gap-1.5 sm:pl-[50px]">
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
        {feature.status === "blocked" && (
          <span className="inline-flex min-h-6 items-center rounded-full bg-rose-500/10 px-2 text-[10px] font-semibold text-rose-700 dark:text-rose-300">
            Blocked
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
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--admin-border)] pt-2.5 sm:pl-[50px]">
        {!isOverlay && onAssign ? (
          <label className="inline-flex min-h-9 min-w-0 items-center gap-1.5 text-[10px] text-[var(--admin-muted)]">
            <UserRound className="size-3 shrink-0" />
            <select
              aria-label={`Assign ${feature.title}`}
              value={feature.owner ?? ""}
              onChange={(event) => onAssign(event.target.value || null)}
              className="max-w-[11rem] rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-1.5 py-1 text-[11px] font-medium text-[var(--admin-ink)] outline-none focus:border-[var(--admin-ink)]"
            >
              <option value="">Unassigned</option>
              {people.map((person) => (
                <option key={person} value={person}>
                  {person}
                </option>
              ))}
            </select>
          </label>
        ) : feature.owner ? (
          <span className="inline-flex items-center gap-1.5 text-[10px] text-[var(--admin-muted)]">
            <UserRound className="size-3" />
            {feature.owner}
          </span>
        ) : null}
        {!isOverlay && onMove && columns && columns.length > 0 && (
          <select
            aria-label={`Move ${feature.title}`}
            value={feature.status}
            onChange={(event) => onMove(event.target.value)}
            className="min-h-9 max-w-[10rem] rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-1.5 py-1 text-[11px] font-medium text-[var(--admin-ink)] outline-none focus:border-[var(--admin-ink)] md:hidden"
          >
            {columns.map((column) => (
              <option key={column.column_key} value={column.column_key}>
                {column.label}
              </option>
            ))}
          </select>
        )}
        {feature.target_date && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 font-mono text-[10px] tabular-nums text-[var(--admin-muted)]",
              overdue && "font-semibold text-rose-700 dark:text-rose-300",
            )}
          >
            <CalendarDays className="size-3" />
            {dueLabel(feature.target_date)}
            {overdue ? " overdue" : ""}
          </span>
        )}
        {claimedBy && (
          <span className="truncate text-[10px] text-[var(--admin-muted)]">
            Claimed {claimedBy.split(":")[0]}
          </span>
        )}
      </div>
      {progress.total > 0 && (
        <div className="mt-3 space-y-1.5 sm:pl-[50px]">
          <div className="flex items-center justify-between gap-2 text-[10px] font-medium text-[var(--admin-muted)]">
            <span>
              {progress.done}/{progress.total} subtasks
            </span>
            {claimedBy && feature.owner && (
              <span className="truncate">Claimed {claimedBy.split(":")[0]}</span>
            )}
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-black/[0.08] dark:bg-white/[0.1]">
            <div
              className="h-full rounded-full bg-[var(--admin-ink)]"
              style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
            />
          </div>
          {!isOverlay && remainingSubtasks(subtasks).length > 0 && (
            <KanbanChecklist
              compact
              compactLimit={2}
              items={subtasks}
              disabled={disabled}
              onToggle={onToggleSubtask}
            />
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
  onPersistSubtasks,
  cards,
  onWorkChanged,
}: {
  open: boolean;
  feature: FeatureRequest | null;
  cards: FeatureRequest[];
  onWorkChanged: (feature: FeatureRequest) => void;
  defaultStatus: string;
  columns: KanbanColumnRecord[];
  saving: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  onArchive: (feature: FeatureRequest) => Promise<void>;
  onPersistSubtasks?: (feature: FeatureRequest, subtasks: FeatureSubtask[]) => Promise<void>;
}) {
  const buildInitialForm = () => ({
    ...featureForm(feature),
    status: feature?.status ?? defaultStatus,
  });
  const [form, setForm] = useState(buildInitialForm);
  const [editRevision] = useState(feature?.revision);
  // Unsaved-change guard: the dialog is keyed per feature, so the mount-time
  // form serialized once is the pristine baseline (a ref read during render
  // trips react-hooks/refs, hence the lazy state snapshot). Closing via X,
  // Cancel, Escape, or the backdrop asks first when anything changed; a
  // successful save unmounts the dialog through the parent, so no reset
  // path is needed.
  const [pristineJson] = useState(() => JSON.stringify(buildInitialForm()));
  const snapshot = JSON.parse(pristineJson) as typeof form;
  const comparable = (value: typeof form) =>
    onPersistSubtasks ? { ...value, subtasks: [] } : value;
  const dirty = JSON.stringify(comparable(form)) !== JSON.stringify(comparable(snapshot));
  const requestClose = () => {
    if (!dirty || window.confirm("Discard unsaved changes to this card?")) onClose();
  };
  const inputClass =
    "mt-1.5 min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-3.5 text-sm font-normal text-[var(--admin-ink)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--admin-muted)]/65 focus:border-[var(--admin-ink)] focus:ring-2 focus:ring-[var(--admin-ink)]/10";
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const initial = snapshot;
    const changes: Record<string, unknown> = Object.fromEntries(
      Object.entries(form).filter(
        ([key, value]) =>
          key !== "status" &&
          (!feature ||
            JSON.stringify(value) !== JSON.stringify(initial[key as keyof typeof initial])),
      ),
    );
    if ("labels" in changes)
      changes.labels = form.labels
        .split(",")
        .map((label) => label.trim())
        .filter(Boolean);
    if ("parent_id" in changes && !changes.parent_id) changes.parent_id = null;
    if ("target_date" in changes && !changes.target_date) changes.target_date = null;
    await onSave({
      ...changes,
      ...(feature ? { id: feature.id, revision: editRevision } : { project_key: "accelerate" }),
    });
  };
  const commitSubtasks = (next: FeatureSubtask[]) => {
    setForm((current) => ({ ...current, subtasks: next }));
    if (feature && onPersistSubtasks) void onPersistSubtasks(feature, next);
  };
  const importAcceptance = () => {
    const lines = parseAcceptanceLines(form.acceptance_criteria);
    if (!lines.length) return;
    commitSubtasks(
      lines.map((title, index) => ({
        id: `${feature?.id ?? "new"}:acceptance:${index}`,
        title,
        done: false,
      })),
    );
  };
  return (
    <AdminDialog
      open={open}
      onClose={requestClose}
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
            onClick={requestClose}
            aria-label="Close feature details"
            className="grid size-10 place-items-center rounded-xl text-[var(--admin-muted)] transition-[background-color,color,transform] duration-150 hover:bg-black/[0.04] hover:text-[var(--admin-ink)] active:scale-[0.96] dark:hover:bg-white/[0.05]"
          >
            <X className="size-4" />
          </button>
        </div>
        {feature && <WorkControls feature={feature} cards={cards} onChanged={onWorkChanged} />}
        <p className="mx-6 mt-4 text-xs text-[var(--admin-muted)]">
          The live board is authoritative. Edits are versioned and preserved. Execution uses claims
          and review.
        </p>
        <div className="grid gap-5 px-5 py-5 pb-32 sm:grid-cols-2 sm:px-6 sm:py-6 sm:pb-32">
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
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-[var(--admin-ink)]">Subtasks</h3>
              {feature &&
                !form.subtasks.length &&
                parseAcceptanceLines(form.acceptance_criteria).length > 0 && (
                  <button
                    type="button"
                    onClick={importAcceptance}
                    className="text-[11px] font-semibold text-[var(--admin-ink)] underline-offset-2 hover:underline"
                  >
                    Import from definition of done
                  </button>
                )}
            </div>
            <div className="mt-2">
              <KanbanChecklist
                items={form.subtasks}
                disabled={saving}
                onToggle={(id) => commitSubtasks(toggleSubtask(form.subtasks, id))}
                onRename={(id, title) => commitSubtasks(renameSubtask(form.subtasks, id, title))}
                onRemove={(id) => commitSubtasks(form.subtasks.filter((item) => item.id !== id))}
                onMove={(id, direction) =>
                  commitSubtasks(moveSubtask(form.subtasks, id, direction))
                }
                onAdd={(title) =>
                  commitSubtasks([
                    ...form.subtasks,
                    { id: crypto.randomUUID(), title, done: false },
                  ])
                }
              />
            </div>
          </div>
          <label className="text-xs font-semibold text-[var(--admin-ink)]">
            Status
            <select
              disabled
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
            Initiative
            <input
              value={form.initiative}
              onChange={(event) => setForm({ ...form, initiative: event.target.value })}
              className={inputClass}
              placeholder="Business outcome or program"
            />
          </label>
          <label className="text-xs font-semibold text-[var(--admin-ink)]">
            Parent initiative or work item
            <select
              value={form.parent_id}
              onChange={(event) => setForm({ ...form, parent_id: event.target.value })}
              className={inputClass}
              disabled={Boolean(
                feature && ["in_progress", "in_review", "shipped"].includes(feature.status),
              )}
            >
              <option value="">No parent</option>
              {cards
                .filter(
                  (card) =>
                    card.id !== feature?.id &&
                    card.project_key === (feature?.project_key ?? "accelerate"),
                )
                .map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.title}
                  </option>
                ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-[var(--admin-ink)]">
            Kind
            <select
              value={form.work_kind}
              onChange={(event) => setForm({ ...form, work_kind: event.target.value })}
              className={inputClass}
              disabled={Boolean(
                feature && ["in_progress", "in_review", "shipped"].includes(feature.status),
              )}
            >
              {["initiative", "feature", "bug", "research", "operations"].map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
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
              Use the controlled category, milestone, phase, and capability dimensions.
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
              rows={12}
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
              onClick={requestClose}
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
  const [pageOffset, setPageOffset] = useState(0);
  const queryClient = useQueryClient();
  const featuresQuery = useAdminQuery<BoardResponse>(
    [...FEATURES_QUERY_KEY, pageOffset],
    `/api/admin/features?offset=${pageOffset}`,
    { refetchInterval: 15000 },
  );
  const data = featuresQuery.data ?? null;
  const setData = (
    updater: BoardResponse | null | ((current: BoardResponse | null) => BoardResponse | null),
  ) => {
    queryClient.setQueryData(
      [...FEATURES_QUERY_KEY, pageOffset],
      (current: BoardResponse | undefined) => {
        const next = typeof updater === "function" ? updater(current ?? null) : updater;
        return next ?? undefined;
      },
    );
  };
  const { columns: liveColumns, renameColumn } = useKanbanColumns("features");
  const columns = useMemo(
    () =>
      liveColumns.map((column) => {
        if (column.column_key !== "in_progress") return column;
        return { ...column, metadata: { ...column.metadata, wipLimit: FEATURE_BOARD_WIP_LIMIT } };
      }),
    [liveColumns],
  );
  const [view, setView] = useKanbanView("features");
  const [saving, setSaving] = useState(false);
  const [queue, setQueue] = useState("all");
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<"all" | FeaturePriority>(() => {
    const stored = readStoredFilters()?.priority;
    return stored && (stored === "all" || FEATURE_PRIORITIES.includes(stored)) ? stored : "all";
  });
  const [milestone, setMilestone] = useState<string>(
    () => readStoredFilters()?.milestone ?? DEFAULT_MILESTONE_FILTER,
  );
  const [category, setCategory] = useState(() => readStoredFilters()?.category ?? "all");
  const [capability, setCapability] = useState(() => readStoredFilters()?.capability ?? "all");
  const [ownerFilter, setOwnerFilter] = useState(() => readStoredFilters()?.ownerFilter ?? "all");
  const applyFilters = useCallback((filters: WorkFilters) => {
    setSearch(filters.search ?? "");
    setMilestone(filters.milestone ?? "all");
    setCategory(filters.category ?? "all");
    setCapability(filters.capability ?? "all");
    setOwnerFilter(filters.ownerFilter ?? "all");
    setPriority(
      FEATURE_PRIORITIES.includes(filters.priority as FeaturePriority)
        ? (filters.priority as FeaturePriority)
        : "all",
    );
    setQueue(filters.queue ?? "all");
  }, []);
  useEffect(() => {
    try {
      const value = new URL(location.href).searchParams.get("filters");
      if (value) applyFilters(JSON.parse(value));
    } catch {
      /* Ignore malformed shared links. */
    }
  }, [applyFilters]);
  const [openFeature, setOpenFeature] = useState<FeatureRequest | null>(null);
  const [featureDialogOpen, setFeatureDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<string>("backlog");
  const searchInputRef = useRef<HTMLInputElement>(null);

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
  const owners = useMemo(
    () =>
      [
        ...new Set(
          features
            .map((feature) => feature.owner)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
    [features],
  );
  useEffect(() => {
    try {
      window.localStorage.setItem(
        FILTERS_STORAGE_KEY,
        JSON.stringify({ milestone, category, capability, ownerFilter, priority }),
      );
    } catch {
      // Viewer preference only.
    }
  }, [capability, category, milestone, ownerFilter, priority]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (featureDialogOpen) return;
      const target = event.target as HTMLElement | null;
      const typing = Boolean(target?.closest("input, textarea, select, [contenteditable='true']"));
      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (
        (event.key === "n" || event.key === "N") &&
        !typing &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        event.preventDefault();
        setNewStatus("backlog");
        setOpenFeature(null);
        setFeatureDialogOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [featureDialogOpen]);

  // Never open onto an empty board: if neither Now nor Next is in use, show everything.
  useEffect(() => {
    if (
      features.length &&
      milestone === DEFAULT_MILESTONE_FILTER &&
      !labels.includes("milestone:now") &&
      !labels.includes("milestone:next")
    )
      setMilestone("all");
  }, [features.length, labels, milestone]);
  const filtered = useMemo(
    () =>
      features.filter((feature) => {
        if (queue === "ready" && (!feature.readiness || feature.readiness.length > 0)) return false;
        if (queue === "blocked" && feature.status !== "blocked" && !feature.work_blocker)
          return false;
        if (queue === "review" && feature.status !== "in_review") return false;
        if (
          queue === "stale" &&
          (feature.status !== "in_progress" ||
            (feature.lease_expires_at && new Date(feature.lease_expires_at) > new Date()))
        )
          return false;
        if (
          queue === "unmerged" &&
          (feature.status !== "shipped" || feature.work_delivery?.mergedAt)
        )
          return false;
        if (priority !== "all" && feature.priority !== priority) return false;
        if (!matchesMilestone(feature.labels, milestone)) return false;
        if (category !== "all" && !feature.labels.includes(category)) return false;
        if (capability !== "all" && !feature.labels.includes(capability)) return false;
        if (ownerFilter === "unassigned") {
          if (feature.owner) return false;
        } else if (ownerFilter === "mine") {
          const mine = [tenant.founder.name, tenant.founder.fullName, tenant.founder.email].map(
            (value) => value.toLowerCase(),
          );
          const owner = (feature.owner || "").toLowerCase();
          const lease = (feature.lease_owner || "").toLowerCase();
          if (
            !mine.some((value) => owner === value || owner.includes(value) || lease.includes(value))
          )
            return false;
        } else if (ownerFilter !== "all" && feature.owner !== ownerFilter) {
          return false;
        }
        const term = search.trim().toLowerCase();
        return (
          !term ||
          [
            feature.title,
            feature.description,
            feature.owner,
            feature.seed_key,
            feature.notes,
            ...feature.labels,
            ...hydrateSubtasks(feature).map((item) => item.title),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(term)
        );
      }),
    [capability, category, features, milestone, ownerFilter, priority, search, queue],
  );
  const filtersActive = Boolean(
    queue !== "all" ||
    search.trim() ||
    priority !== "all" ||
    category !== "all" ||
    capability !== "all" ||
    ownerFilter !== "all" ||
    (milestone !== "all" && milestone !== DEFAULT_MILESTONE_FILTER),
  );

  const applyFeatureUpdate = (updated: FeatureRequest, isCreate: boolean) => {
    setData((current) =>
      current
        ? {
            ...current,
            features: isCreate
              ? [...current.features, updated]
              : current.features.map((feature) => (feature.id === updated.id ? updated : feature)),
          }
        : current,
    );
    setOpenFeature((current) => (current?.id === updated.id ? updated : current));
  };

  const saveFeature = async (
    payload: Record<string, unknown>,
    options?: { close?: boolean; silent?: boolean },
  ) => {
    const close = options?.close !== false;
    setSaving(true);
    try {
      const { id, revision, ...changes } = payload;
      const { card: updated } = await sendWork(
        id ? "edit" : "create",
        id ? ({ id, revision } as FeatureRequest) : null,
        changes,
      );
      applyFeatureUpdate(updated, !payload.id);
      if (close) {
        setFeatureDialogOpen(false);
        toast.success(payload.id ? "Feature updated" : "Feature added to the board");
      } else if (!options?.silent) {
        toast.success(payload.id ? "Feature updated" : "Feature added to the board");
      }
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Could not save feature.");
    } finally {
      setSaving(false);
    }
  };

  const persistSubtasks = async (feature: FeatureRequest, subtasks: FeatureSubtask[]) => {
    setData((current) =>
      current
        ? {
            ...current,
            features: current.features.map((item) =>
              item.id === feature.id ? { ...item, subtasks } : item,
            ),
          }
        : current,
    );
    try {
      const { card: updated } = await sendWork("edit", feature, { subtasks });
      applyFeatureUpdate(updated, false);
    } catch (error) {
      setData((current) =>
        current
          ? {
              ...current,
              features: current.features.map((item) => (item.id === feature.id ? feature : item)),
            }
          : current,
      );
      toast.error(error instanceof Error ? error.message : "Could not update subtasks.");
    }
  };

  const persistOwner = async (feature: FeatureRequest, owner: string | null) => {
    setData((current) =>
      current
        ? {
            ...current,
            features: current.features.map((item) =>
              item.id === feature.id ? { ...item, owner } : item,
            ),
          }
        : current,
    );
    try {
      const { card: updated } = await sendWork("edit", feature, { owner });
      applyFeatureUpdate(updated, false);
    } catch (error) {
      setData((current) =>
        current
          ? {
              ...current,
              features: current.features.map((item) => (item.id === feature.id ? feature : item)),
            }
          : current,
      );
      toast.error(error instanceof Error ? error.message : "Could not assign this card.");
    }
  };

  const persistMove = async (feature: FeatureRequest, columnKey: string) => {
    if (feature.status === columnKey) return;
    const targetCount = features.filter((item) => item.status === columnKey).length;
    try {
      await commitReorder([
        { id: feature.id, column_key: columnKey, sort_order: (targetCount + 1) * 1000 },
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not move this card.");
    }
  };

  const clearFilters = () => {
    setQueue("all");
    setSearch("");
    setPriority("all");
    setMilestone(DEFAULT_MILESTONE_FILTER);
    setCategory("all");
    setCapability("all");
    setOwnerFilter("all");
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
      await sendWork("archive", feature, {
        message: "Archived by the board operator after review.",
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
      await sendWork("reorder", null, {
        updates: updates.map((update) => {
          const feature = features.find((card) => card.id === update.id);
          if (!feature) throw new Error("Card not found; refresh the board.");
          return {
            id: feature.id,
            revision: feature.revision,
            status: update.column_key,
            sort_order: update.sort_order,
          };
        }),
      });
      await featuresQuery.refetch();
    },
    [features, featuresQuery],
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
      <WorkAgents />
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
              {(pageOffset > 0 || data.nextOffset != null) && (
                <nav aria-label="Board pages" className="flex items-center gap-3 text-xs">
                  <button
                    type="button"
                    disabled={pageOffset === 0}
                    className="min-h-11 rounded-xl border px-4 disabled:opacity-40"
                    onClick={() => setPageOffset(Math.max(0, pageOffset - 500))}
                  >
                    Previous 500
                  </button>
                  <span>
                    Cards {pageOffset + 1}–{pageOffset + features.length}; filters apply to this
                    page
                  </span>
                  <button
                    type="button"
                    disabled={data.nextOffset == null}
                    className="min-h-11 rounded-xl border px-4 disabled:opacity-40"
                    onClick={() => setPageOffset(data.nextOffset!)}
                  >
                    Next 500
                  </button>
                </nav>
              )}
              <section className="grid grid-cols-3 gap-2 sm:gap-3">
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
                    label: "Verified",
                    value: features.filter((feature) => feature.status === "shipped").length,
                    note: "Verification accepted",
                    icon: CheckCircle2,
                  },
                ].map(({ label: metricLabel, value, note, icon: Icon }) => (
                  <AdminSurface key={metricLabel} padding="sm" className="min-w-0">
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      <div className="min-w-0">
                        <p className="admin-eyebrow truncate">{metricLabel}</p>
                        <p className="mt-1.5 text-xl font-semibold tabular-nums tracking-[-0.045em] text-[var(--admin-ink)] sm:mt-3 sm:text-3xl">
                          {value}
                        </p>
                        <p className="admin-copy mt-1 hidden text-xs sm:block">{note}</p>
                      </div>
                      <span className="hidden size-9 place-items-center rounded-xl bg-black/[0.045] text-[var(--admin-ink)] dark:bg-white/[0.06] sm:grid">
                        <Icon className="size-4" />
                      </span>
                    </div>
                  </AdminSurface>
                ))}
              </section>
              <AdminSurface padding="sm">
                <WorkViews
                  filters={{
                    search,
                    milestone,
                    category,
                    capability,
                    ownerFilter,
                    priority,
                    queue,
                  }}
                  onChange={applyFilters}
                />
                <div className="mt-4 flex flex-col gap-3">
                  <div className="relative min-w-0 w-full">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--admin-muted)]" />
                    <input
                      ref={searchInputRef}
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search title, outcome, owner, subtask, or capability"
                      className="min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] pl-10 pr-3.5 text-sm text-[var(--admin-ink)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--admin-muted)]/70 focus:border-[var(--admin-ink)] focus:ring-2 focus:ring-[var(--admin-ink)]/10"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center">
                    <Filter className="hidden size-4 text-[var(--admin-muted)] md:block" />
                    <select
                      value={milestone}
                      onChange={(event) => setMilestone(event.target.value)}
                      aria-label="Filter by milestone"
                      className="min-h-11 min-w-0 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-xs font-semibold text-[var(--admin-ink)] outline-none focus:border-[var(--admin-ink)] md:w-auto"
                    >
                      <option value="all">All milestones</option>
                      <option value="active">Now + Next</option>
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
                      className="min-h-11 min-w-0 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-xs font-semibold capitalize text-[var(--admin-ink)] outline-none focus:border-[var(--admin-ink)] md:w-auto md:max-w-48"
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
                      className="min-h-11 min-w-0 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-xs font-semibold capitalize text-[var(--admin-ink)] outline-none focus:border-[var(--admin-ink)] md:w-auto md:max-w-48"
                    >
                      <option value="all">All capabilities</option>
                      {capabilities.map((value) => (
                        <option key={value} value={value}>
                          {taxonomyLabel(value)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={ownerFilter}
                      onChange={(event) => setOwnerFilter(event.target.value)}
                      aria-label="Filter by owner"
                      className="min-h-11 min-w-0 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-xs font-semibold text-[var(--admin-ink)] outline-none focus:border-[var(--admin-ink)] md:w-auto"
                    >
                      <option value="all">All assignments</option>
                      <option value="mine">Assigned to me</option>
                      <option value="unassigned">Unassigned</option>
                      {owners.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                    <select
                      value={priority}
                      onChange={(event) =>
                        setPriority(event.target.value as "all" | FeaturePriority)
                      }
                      aria-label="Filter by priority"
                      className="min-h-11 min-w-0 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-xs font-semibold text-[var(--admin-ink)] outline-none focus:border-[var(--admin-ink)] md:w-auto"
                    >
                      <option value="all">All priorities</option>
                      {FEATURE_PRIORITIES.map((value) => (
                        <option key={value} value={value}>
                          {priorityMeta[value].label}
                        </option>
                      ))}
                    </select>
                    <div className="col-span-2 flex items-center gap-2 md:col-auto">
                      <span className="rounded-full bg-black/[0.045] px-2.5 py-1 font-mono text-[10px] tabular-nums text-[var(--admin-muted)] dark:bg-white/[0.06]">
                        {filtered.length}
                      </span>
                      {filtersActive && (
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="text-xs font-semibold text-[var(--admin-ink)] underline-offset-2 hover:underline"
                        >
                          Clear filters
                        </button>
                      )}
                      <KanbanViewSwitcher value={view} onChange={setView} />
                    </div>
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
                view === "board" ? (
                  <KanbanBoard<FeatureRequest>
                    columns={columns}
                    items={filtered}
                    getItemId={(feature) => feature.id}
                    getItemColumnKey={(feature) => feature.status}
                    getItemSortOrder={(feature) => Number(feature.sort_order)}
                    getItemLabel={(feature) => feature.title}
                    setItemPosition={(feature, columnKey, sortOrder) => ({
                      ...feature,
                      status: columnKey,
                      sort_order: sortOrder,
                    })}
                    renderCard={(feature, opts) => (
                      <FeatureCard
                        feature={feature}
                        opts={opts}
                        assignees={owners}
                        columns={columns}
                        onOpen={() => {
                          setOpenFeature(feature);
                          setFeatureDialogOpen(true);
                        }}
                        onToggleSubtask={(id) =>
                          void persistSubtasks(feature, toggleSubtask(hydrateSubtasks(feature), id))
                        }
                        onAssign={(owner) => void persistOwner(feature, owner)}
                        onMove={(columnKey) => void persistMove(feature, columnKey)}
                      />
                    )}
                    renderCardOverlay={(feature) => (
                      <FeatureCard
                        feature={feature}
                        opts={{
                          isDragging: true,
                          isOverlay: true,
                          disabled: true,
                          dragHandleProps: {},
                        }}
                      />
                    )}
                    onReorder={commitReorder}
                    onCrossColumnMove={async (_item, _from, to) => {
                      const column = columns.find((entry) => entry.column_key === to);
                      const limit = parseWipLimit(column?.metadata);
                      if (limit == null) return true;
                      const count = filtered.filter((feature) => feature.status === to).length;
                      if (count >= limit) {
                        toast.warning(
                          `${column?.label ?? to} is at its WIP limit (${count}/${limit}). The card still moved.`,
                        );
                      }
                      return true;
                    }}
                    dragDisabled={filtersActive}
                    onRenameColumn={(columnKey, label) => renameColumn(columnKey, { label })}
                    onUpdateColumnMetadata={(columnKey, metadata: KanbanColumnMetadata) =>
                      renameColumn(columnKey, { metadata })
                    }
                    onQuickAdd={(columnKey, title) =>
                      saveFeature(
                        { title, status: columnKey, priority: "medium" },
                        { close: false },
                      )
                    }
                    quickAddLabel="Add card"
                  />
                ) : (
                  <KanbanListView<FeatureRequest>
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
                    renderTitle={(feature) => feature.title}
                    onOpenItem={(feature) => {
                      setOpenFeature(feature);
                      setFeatureDialogOpen(true);
                    }}
                    onReorder={commitReorder}
                    extraColumns={[
                      {
                        key: "priority",
                        header: "Priority",
                        sortValue: (feature) => FEATURE_PRIORITIES.indexOf(feature.priority),
                        render: (feature) => (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                            <span
                              className={cn(
                                "size-1.5 rounded-full",
                                priorityMeta[feature.priority].dot,
                              )}
                            />
                            {priorityMeta[feature.priority].label}
                          </span>
                        ),
                      },
                      {
                        key: "subtasks",
                        header: "Subtasks",
                        sortValue: (feature) => subtaskProgress(hydrateSubtasks(feature)).done,
                        render: (feature) => {
                          const progress = subtaskProgress(hydrateSubtasks(feature));
                          if (!progress.total) return "—";
                          return (
                            <span className="inline-flex items-center gap-2">
                              <span className="h-1 w-12 overflow-hidden rounded-full bg-black/[0.08] dark:bg-white/[0.1]">
                                <span
                                  className="block h-full rounded-full bg-[var(--admin-ink)]"
                                  style={{
                                    width: `${Math.round((progress.done / progress.total) * 100)}%`,
                                  }}
                                />
                              </span>
                              {progress.done}/{progress.total}
                            </span>
                          );
                        },
                      },
                      {
                        key: "owner",
                        header: "Owner",
                        sortValue: (feature) => feature.owner ?? "",
                        render: (feature) => feature.owner || "—",
                      },
                      {
                        key: "target_date",
                        header: "Target date",
                        sortValue: (feature) => feature.target_date ?? "",
                        render: (feature) =>
                          feature.target_date ? (
                            <span
                              className={cn(
                                isFeatureOverdue(feature) &&
                                  "font-semibold text-rose-700 dark:text-rose-300",
                              )}
                            >
                              {feature.target_date}
                              {isFeatureOverdue(feature) ? " overdue" : ""}
                            </span>
                          ) : (
                            "—"
                          ),
                      },
                    ]}
                  />
                )
              ) : (
                <LoadingSkeleton variant="board" />
              )}
              <div className="flex flex-col gap-2 rounded-2xl bg-black/[0.025] px-4 py-3 text-xs text-[var(--admin-muted)] dark:bg-white/[0.025] sm:flex-row sm:items-center sm:justify-between">
                <p>
                  Check off subtasks on the card. Drag by the grip to reprioritize. Press / to
                  search, N to add a card.
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
        cards={features}
        onWorkChanged={(card) => {
          applyFeatureUpdate(card, false);
          void load();
        }}
        key={openFeature?.id ?? `new-${newStatus}`}
        open={featureDialogOpen}
        feature={openFeature}
        defaultStatus={newStatus}
        columns={columns}
        saving={saving}
        onClose={() => setFeatureDialogOpen(false)}
        onSave={(payload) => saveFeature(payload)}
        onArchive={archiveFeature}
      />
    </div>
  );
}
