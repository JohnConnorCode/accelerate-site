"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "@/components/admin/AdminLink";
import {
  ArrowUpRight,
  BookmarkPlus,
  Check,
  Columns3,
  GripVertical,
  List,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { AdminReadBody } from "@/components/admin/AdminReadBody";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { PageHeader } from "@/components/admin/PageHeader";
import { RevenueSetupGate } from "@/components/admin/RevenueSetupGate";
import { KanbanBoard, type KanbanCardRenderOpts } from "@/components/kanban/KanbanBoard";
import { fetchJson } from "@/lib/admin/fetchJson";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { useKanbanColumns } from "@/lib/kanban/useKanbanColumns";
import type { KanbanColumnRecord } from "@/lib/kanban/types";
import type { KanbanReorderUpdate } from "@/lib/kanban/useKanbanDnd";
import {
  DEFAULT_PIPELINE_VIEW,
  PIPELINE_VISIBLE_FIELDS,
  SYSTEM_PIPELINE_VIEWS,
  applyPipelineView,
  countPipelineSystemViews,
  hasLastPipelineView,
  loadLastPipelineView,
  loadSavedPipelineViews,
  removePipelineView,
  saveLastPipelineView,
  savePipelineView,
  type PipelineViewState,
  type PipelineVisibleField,
  type SavedPipelineView,
} from "@/lib/admin/pipelineViews";
import { cn } from "@/lib/utils";

interface Opportunity {
  id: string;
  name: string | null;
  email: string | null;
  stage: string;
  sort_order: number;
  canonical_stage: string | null;
  estimated_value: number;
  won_value: number;
  next_action: string | null;
  next_action_at: string | null;
  source: string | null;
  owner_email?: string | null;
  last_activity_at?: string | null;
  next_meeting_at?: string | null;
  closed_at?: string | null;
  updated_at?: string | null;
  created_at: string;
  contact?: { full_name: string; primary_email: string | null } | null;
  company?: { name: string; domain: string | null; industry: string | null } | null;
}

/** Role-driven tone for the stage badge/dropdown — replaces the old
 * hardcoded per-canonical-stage-name lookup so a custom admin-created stage
 * still gets a sensible color instead of falling through undefined. */
const ROLE_TONE: Record<"open" | "won" | "lost", string> = {
  open: "bg-black/[0.05] text-[var(--admin-muted)] dark:bg-white/[0.07]",
  won: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  lost: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
};
function toneForColumn(column: KanbanColumnRecord | undefined): string {
  const role = column?.metadata?.role;
  return ROLE_TONE[role === "won" || role === "lost" ? role : "open"];
}
const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
const shortDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "No date";
const has = (state: PipelineViewState, field: PipelineVisibleField) =>
  state.visibleFields.includes(field);

export default function PipelinePage() {
  const [state, setState] = useState<PipelineViewState>(DEFAULT_PIPELINE_VIEW);
  const [saved, setSaved] = useState<SavedPipelineView[]>([]);
  const [activeSaved, setActiveSaved] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [dialog, setDialog] = useState<"create" | "customize" | "save" | "add-stage" | null>(null);
  const [stageLabel, setStageLabel] = useState("");
  const [stageRole, setStageRole] = useState<"open" | "won" | "lost">("open");
  const [stageProbability, setStageProbability] = useState(20);
  const [viewName, setViewName] = useState("");
  const patchState = (patch: Partial<PipelineViewState>) => {
    setActiveSaved(null);
    setState((current) => ({ ...current, ...patch }));
  };
  const pipelineQuery = useAdminQuery<{
    schemaReady: boolean;
    signalsReady?: { calendar: boolean };
    opportunities: Opportunity[];
  }>(["admin", "pipeline"], "/api/admin/revenue-os/pipeline");
  const data = pipelineQuery.data ?? null;
  const loading = pipelineQuery.isPending;
  const refreshing = pipelineQuery.isFetching;
  const error = actionError || pipelineQuery.error?.message || "";
  const refetchPipeline = pipelineQuery.refetch;
  const load = useCallback(async () => {
    setActionError("");
    const result = await refetchPipeline();
    if (result.error) setActionError(result.error.message || "Could not load pipeline.");
  }, [refetchPipeline]);
  useEffect(() => {
    const restored = loadLastPipelineView();
    const deviceDefault =
      !hasLastPipelineView() && window.matchMedia("(max-width: 767px)").matches
        ? { ...restored, layout: "list" as const }
        : restored;
    const params = new URLSearchParams(window.location.search);
    const query = params.get("opportunity")?.trim() || params.get("search")?.trim();
    setState(
      query
        ? { ...deviceDefault, systemView: "all", stage: "all", owner: "all", search: query }
        : deviceDefault,
    );
    setSaved(loadSavedPipelineViews());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) saveLastPipelineView(state);
  }, [ready, state]);

  const items = useMemo(() => data?.opportunities ?? [], [data]);
  const [referenceNow] = useState(() => new Date());
  const shown = useMemo(
    () => applyPipelineView(items, state, referenceNow),
    [items, state, referenceNow],
  );
  const counts = useMemo(
    () => countPipelineSystemViews(items, referenceNow),
    [items, referenceNow],
  );
  const currentView =
    SYSTEM_PIPELINE_VIEWS.find((item) => item.id === state.systemView) ?? SYSTEM_PIPELINE_VIEWS[0]!;
  const owners = useMemo(
    () => [...new Set(items.map((item) => item.owner_email || "unassigned"))].sort(),
    [items],
  );
  const {
    columns: pipelineColumns,
    createColumn,
    renameColumn,
    deleteColumn,
  } = useKanbanColumns("pipeline");
  const shownColumns = useMemo(
    () =>
      state.stage === "all"
        ? pipelineColumns
        : pipelineColumns.filter((column) => column.column_key === state.stage),
    [pipelineColumns, state.stage],
  );
  const columnByKey = useMemo(
    () => new Map(pipelineColumns.map((column) => [column.column_key, column])),
    [pipelineColumns],
  );
  const roleOf = useCallback(
    (canonicalOrRaw: string | null) => {
      if (!canonicalOrRaw) return "open" as const;
      const role = columnByKey.get(canonicalOrRaw)?.metadata?.role;
      return role === "won" || role === "lost" ? role : ("open" as const);
    },
    [columnByKey],
  );
  const metrics = useMemo(() => {
    const open = items.filter((item) => roleOf(item.canonical_stage ?? item.stage) === "open");
    return {
      open: open.length,
      value: open.reduce((sum, item) => sum + Number(item.estimated_value || 0), 0),
      // "At proposal" stays tied to the two default sales-path stage names —
      // there's no generic "position in funnel" concept for a custom stage
      // (same accepted trim as src/lib/revenue-os/analytics.ts's funnel
      // buckets), so a renamed/removed proposal/negotiation stage won't be
      // reflected here.
      proposals: items.filter((item) =>
        ["proposal", "negotiation"].includes(item.canonical_stage ?? item.stage),
      ).length,
      won: items.reduce((sum, item) => sum + Number(item.won_value || 0), 0),
    };
  }, [items, roleOf]);

  const moveToStage = useCallback(
    async (item: Opportunity, columnKey: string, sortOrder?: number): Promise<boolean> => {
      const role = roleOf(columnKey);
      const lossReason =
        role === "lost" ? window.prompt("Why was this opportunity lost?")?.trim() : undefined;
      if (role === "lost" && !lossReason) return false;
      setSaving(true);
      try {
        await fetchJson("/api/admin/revenue-os/pipeline", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: item.id,
            stage: columnKey,
            lossReason,
            sortOrder,
            reason: "Founder pipeline update",
          }),
        });
        await load();
        return true;
      } catch (reason) {
        setActionError(reason instanceof Error ? reason.message : "Could not move opportunity.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [load, roleOf],
  );
  // Kept for the plain <select> dropdown (Card/ListView/StageSelect), which
  // doesn't need a drag position — always appends to the end of the target
  // column server-side by omitting sortOrder.
  const updateStage = (item: Opportunity, stage: string) => moveToStage(item, stage);

  const commitReorder = useCallback(
    async (updates: KanbanReorderUpdate[]) => {
      await fetchJson("/api/admin/revenue-os/pipeline", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reorder: updates }),
      });
      await load();
    },
    [load],
  );
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await fetchJson("/api/admin/revenue-os/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
      });
      setDialog(null);
      await load();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Could not create opportunity.");
    } finally {
      setSaving(false);
    }
  };
  const storeView = (event: FormEvent) => {
    event.preventDefault();
    const next = savePipelineView(viewName, state);
    setSaved(next);
    setActiveSaved(
      next.find((item) => item.name.toLowerCase() === viewName.trim().toLowerCase())?.id ?? null,
    );
    setViewName("");
    setDialog(null);
  };

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Pipeline"
        subtitle="Prioritize the work that moves revenue, then review every opportunity from one operating view."
        utilityActions={
          <button
            type="button"
            onClick={() => void load()}
            aria-label="Refresh pipeline"
            className="admin-icon-button shadow-[var(--admin-shadow-border)]"
          >
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
          </button>
        }
        actions={
          <button
            type="button"
            onClick={() => setDialog("create")}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--admin-ink)] px-4 text-xs font-semibold text-[var(--admin-surface)] transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.96]"
          >
            <Plus className="size-4" /> New opportunity
          </button>
        }
      />
      <AdminReadBody
        loading={loading}
        hasData={Boolean(data)}
        error={error}
        onRetry={() => void load()}
        refreshing={refreshing}
        loadingFallback={<LoadingSkeleton variant="board" />}
        label="Loading pipeline"
      >
        {data && !data.schemaReady ? (
          <RevenueSetupGate />
        ) : (
          data && (
            <>
              <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {[
                  ["Open", metrics.open, "Active opportunities"],
                  ["Pipeline value", money(metrics.value), "Unweighted"],
                  ["At proposal", metrics.proposals, "Proposal or negotiation"],
                  ["Won revenue", money(metrics.won), "Recorded outcomes"],
                ].map(([label, value, note]) => (
                  <AdminSurface key={String(label)} className="min-w-0 p-4 sm:p-5">
                    <p className="admin-eyebrow truncate">{String(label)}</p>
                    <p className="mt-2 truncate text-[clamp(1.35rem,6vw,1.85rem)] font-semibold tabular-nums tracking-[-0.045em] sm:mt-3 sm:text-3xl">
                      {String(value)}
                    </p>
                    <p className="admin-copy mt-1 truncate text-[10px] sm:text-xs">
                      {String(note)}
                    </p>
                  </AdminSurface>
                ))}
              </section>

              <AdminSurface
                padding="none"
                className="w-full min-w-0 max-w-full overflow-hidden [contain:inline-size]"
              >
                <div className="border-b border-[var(--admin-border)] p-4 sm:p-5">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="admin-eyebrow">Operator views</p>
                      <h2 className="mt-1 text-balance text-lg font-semibold tracking-[-0.025em]">
                        {currentView.label}
                      </h2>
                      <p className="admin-copy mt-1 max-w-2xl text-pretty text-xs">
                        {currentView.description}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-black/[0.045] px-2.5 py-1 font-mono text-[10px] tabular-nums text-[var(--admin-muted)] dark:bg-white/[0.06]">
                      {shown.length} shown
                    </span>
                  </div>
                  <div
                    className="scrollbar-hide mt-4 flex gap-2 overflow-x-auto pb-1"
                    aria-label="Pipeline operator views"
                  >
                    {SYSTEM_PIPELINE_VIEWS.map((view) => (
                      <button
                        key={view.id}
                        type="button"
                        aria-pressed={state.systemView === view.id && !activeSaved}
                        onClick={() => patchState({ systemView: view.id })}
                        className={cn(
                          "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3.5 text-xs font-semibold transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.96]",
                          state.systemView === view.id && !activeSaved
                            ? "bg-[var(--admin-ink)] text-[var(--admin-surface)]"
                            : "text-[var(--admin-muted)] shadow-[var(--admin-shadow-border)] hover:text-[var(--admin-ink)] hover:shadow-[var(--admin-shadow-border-hover)]",
                        )}
                      >
                        <span>{view.label}</span>
                        <span className="font-mono text-[9px] tabular-nums opacity-70">
                          {counts[view.id]}
                        </span>
                      </button>
                    ))}
                  </div>
                  {saved.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="admin-eyebrow mr-1">Saved</span>
                      {saved.map((view) => (
                        <div
                          key={view.id}
                          className={cn(
                            "flex min-h-11 items-center rounded-xl shadow-[var(--admin-shadow-border)]",
                            activeSaved === view.id && "bg-black/[0.045] dark:bg-white/[0.06]",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setState(view.state);
                              setActiveSaved(view.id);
                            }}
                            className="min-h-11 rounded-l-xl pl-3.5 pr-2 text-xs font-semibold active:scale-[0.96]"
                          >
                            {view.name}
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete saved view ${view.name}`}
                            onClick={() => {
                              setSaved(removePipelineView(view.id));
                              if (activeSaved === view.id) setActiveSaved(null);
                            }}
                            className="grid size-11 place-items-center rounded-r-xl text-[var(--admin-muted)] hover:text-rose-600 active:scale-[0.96]"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-[minmax(240px,1fr)_auto] lg:items-center">
                  <label className="relative min-w-0">
                    <span className="sr-only">Search pipeline</span>
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--admin-muted)]" />
                    <input
                      value={state.search}
                      onChange={(event) => patchState({ search: event.target.value })}
                      placeholder="Search company, person, or email"
                      className="min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] pl-10 pr-3.5 text-sm outline-none focus:border-[var(--admin-ink)] focus:ring-2 focus:ring-[var(--admin-ink)]/10"
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={state.stage}
                      label="Filter by stage"
                      onChange={(value) =>
                        patchState({ stage: value as PipelineViewState["stage"] })
                      }
                    >
                      <option value="all">All stages</option>
                      {pipelineColumns.map((column) => (
                        <option key={column.column_key} value={column.column_key}>
                          {column.label}
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={state.owner}
                      label="Filter by owner"
                      onChange={(owner) => patchState({ owner })}
                    >
                      <option value="all">All owners</option>
                      {owners.map((owner) => (
                        <option key={owner} value={owner}>
                          {owner === "unassigned" ? "Unassigned" : owner}
                        </option>
                      ))}
                    </Select>
                    <ToolButton
                      label="Customize"
                      icon={Settings2}
                      onClick={() => setDialog("customize")}
                    />
                    <ToolButton
                      label="Save view"
                      icon={BookmarkPlus}
                      onClick={() => setDialog("save")}
                    />
                    <ToolButton
                      label="Add stage"
                      icon={Plus}
                      onClick={() => {
                        setStageLabel("");
                        setStageRole("open");
                        setStageProbability(20);
                        setDialog("add-stage");
                      }}
                    />
                    <div
                      className="flex rounded-xl p-1 shadow-[var(--admin-shadow-border)]"
                      role="group"
                      aria-label="Pipeline layout"
                    >
                      <IconButton
                        label="Board view"
                        active={state.layout === "board"}
                        onClick={() => patchState({ layout: "board" })}
                        icon={Columns3}
                      />
                      <IconButton
                        label="List view"
                        active={state.layout === "list"}
                        onClick={() => patchState({ layout: "list" })}
                        icon={List}
                      />
                    </div>
                  </div>
                </div>
                {state.layout === "board" ? (
                  shownColumns.length > 0 ? (
                    <div className="w-full min-w-0 border-t border-[var(--admin-border)] bg-black/[0.012] p-4 dark:bg-white/[0.012] sm:p-5">
                      <KanbanBoard<Opportunity>
                        columns={shownColumns}
                        items={shown}
                        getItemId={(item) => item.id}
                        getItemColumnKey={(item) => item.canonical_stage ?? item.stage}
                        getItemSortOrder={(item) => Number(item.sort_order)}
                        getItemLabel={(item) => item.name || item.company?.name || "Opportunity"}
                        setItemPosition={(item, columnKey, sortOrder) => ({
                          ...item,
                          stage: columnKey,
                          canonical_stage: columnKey,
                          sort_order: sortOrder,
                        })}
                        renderCard={(item, opts) => (
                          <PipelineKanbanCard
                            item={item}
                            opts={opts}
                            state={state}
                            columns={pipelineColumns}
                            saving={saving}
                            updateStage={updateStage}
                          />
                        )}
                        onReorder={commitReorder}
                        onCrossColumnMove={(item, _from, to) => moveToStage(item, to)}
                        emptyColumnHint="No opportunities in this stage."
                        onRenameColumn={(columnKey, label) => renameColumn(columnKey, { label })}
                        onDeleteColumn={(columnKey, options) => deleteColumn(columnKey, options)}
                      />
                    </div>
                  ) : (
                    <LoadingSkeleton variant="board" />
                  )
                ) : (
                  <ListView
                    items={shown}
                    state={state}
                    saving={saving}
                    updateStage={updateStage}
                    columns={pipelineColumns}
                  />
                )}
              </AdminSurface>
            </>
          )
        )}
      </AdminReadBody>

      <AdminDialog
        open={dialog === "customize"}
        onClose={() => setDialog(null)}
        title="Customize pipeline view"
        labelledBy="customize-pipeline-title"
        maxWidth="md"
      >
        <div className="admin-dialog-surface w-full rounded-[24px] bg-[var(--admin-surface)] p-6">
          <DialogHead
            id="customize-pipeline-title"
            eyebrow="Pipeline view"
            title="Customize your workspace"
            description="Choose the information and ordering that help you make the next decision."
            close={() => setDialog(null)}
          />
          <fieldset className="mt-6">
            <legend className="admin-eyebrow">Visible fields</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {PIPELINE_VISIBLE_FIELDS.map((field) => {
                const selected = has(state, field.id);
                return (
                  <button
                    key={field.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      patchState({
                        visibleFields: selected
                          ? state.visibleFields.filter((item) => item !== field.id)
                          : [...state.visibleFields, field.id],
                      })
                    }
                    className={cn(
                      "flex min-h-11 items-center justify-between rounded-xl px-3.5 text-xs font-semibold shadow-[var(--admin-shadow-border)] active:scale-[0.96]",
                      selected
                        ? "bg-black/[0.045] dark:bg-white/[0.06]"
                        : "text-[var(--admin-muted)]",
                    )}
                  >
                    <span>{field.label}</span>
                    {selected && <Check className="size-4" />}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <SelectBlock
              label="Sort by"
              value={state.sortField}
              onChange={(sortField) =>
                patchState({ sortField: sortField as PipelineViewState["sortField"] })
              }
            >
              <option value="next_action_at">Next action</option>
              <option value="created_at">Created date</option>
              <option value="estimated_value">Value</option>
              <option value="name">Name</option>
            </SelectBlock>
            <SelectBlock
              label="Direction"
              value={state.sortDirection}
              onChange={(sortDirection) =>
                patchState({ sortDirection: sortDirection as PipelineViewState["sortDirection"] })
              }
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </SelectBlock>
          </div>
          <div className="mt-6 flex justify-between">
            <button
              type="button"
              onClick={() => {
                setState(DEFAULT_PIPELINE_VIEW);
                setActiveSaved(null);
              }}
              className="min-h-11 rounded-xl px-3 text-xs font-semibold text-[var(--admin-muted)] active:scale-[0.96]"
            >
              Reset defaults
            </button>
            <button
              type="button"
              onClick={() => setDialog(null)}
              className="min-h-11 rounded-xl bg-[var(--admin-ink)] px-4 text-xs font-semibold text-[var(--admin-surface)] active:scale-[0.96]"
            >
              Done
            </button>
          </div>
        </div>
      </AdminDialog>
      <AdminDialog
        open={dialog === "save"}
        onClose={() => setDialog(null)}
        title="Save pipeline view"
        labelledBy="save-pipeline-title"
        maxWidth="sm"
      >
        <form
          onSubmit={storeView}
          className="admin-dialog-surface w-full rounded-[24px] bg-[var(--admin-surface)] p-6"
        >
          <DialogHead
            id="save-pipeline-title"
            eyebrow="Saved view"
            title="Name this workspace"
            description="Your filters, fields, sort, and layout will be available on this device."
            close={() => setDialog(null)}
          />
          <label className="mt-6 block text-xs font-semibold">
            View name
            <input
              autoFocus
              required
              maxLength={60}
              value={viewName}
              onChange={(event) => setViewName(event.target.value)}
              placeholder="Founder weekly review"
              className="mt-1.5 min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-3.5 text-sm font-normal outline-none"
            />
          </label>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDialog(null)}
              className="min-h-11 px-4 text-xs font-semibold text-[var(--admin-muted)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-11 rounded-xl bg-[var(--admin-ink)] px-4 text-xs font-semibold text-[var(--admin-surface)] active:scale-[0.96]"
            >
              Save view
            </button>
          </div>
        </form>
      </AdminDialog>
      <AdminDialog
        open={dialog === "add-stage"}
        onClose={() => setDialog(null)}
        title="Add pipeline stage"
        labelledBy="add-stage-title"
        maxWidth="sm"
      >
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const label = stageLabel.trim();
            if (!label) return;
            setSaving(true);
            try {
              await createColumn({
                label,
                metadata: { role: stageRole, probability: stageProbability },
              });
              setDialog(null);
            } catch {
              // useKanbanColumns already toasts the failure.
            } finally {
              setSaving(false);
            }
          }}
          className="admin-dialog-surface w-full rounded-[24px] bg-[var(--admin-surface)] p-6"
        >
          <DialogHead
            id="add-stage-title"
            eyebrow="Pipeline"
            title="Add a stage"
            description="New stages appear as a column on the board and an option everywhere a stage is picked."
            close={() => setDialog(null)}
          />
          <label className="mt-6 block text-xs font-semibold">
            Stage name
            <input
              autoFocus
              required
              maxLength={60}
              value={stageLabel}
              onChange={(event) => setStageLabel(event.target.value)}
              placeholder="Trial scheduled"
              className="mt-1.5 min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-3.5 text-sm font-normal outline-none"
            />
          </label>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <SelectBlock
              label="Role"
              value={stageRole}
              onChange={(value) => setStageRole(value as "open" | "won" | "lost")}
            >
              <option value="open">Open, still in play</option>
              <option value="won">Won, a closed win</option>
              <option value="lost">Lost, a closed loss</option>
            </SelectBlock>
            <label className="text-xs font-semibold">
              Win probability ({stageProbability}%)
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={stageProbability}
                onChange={(event) => setStageProbability(Number(event.target.value))}
                className="mt-3.5 w-full"
              />
            </label>
          </div>
          <p className="admin-copy mt-3 text-xs">
            Won/lost stages close the opportunity and stop counting it as open pipeline. A won
            stage always records the deal value; a lost stage always requires a reason when an
            opportunity moves into it.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDialog(null)}
              className="min-h-11 px-4 text-xs font-semibold text-[var(--admin-muted)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !stageLabel.trim()}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--admin-ink)] px-4 text-xs font-semibold text-[var(--admin-surface)] disabled:opacity-50"
            >
              {saving && <Loader2 className="size-4 animate-spin" />} Add stage
            </button>
          </div>
        </form>
      </AdminDialog>
      <AdminDialog
        open={dialog === "create"}
        onClose={() => setDialog(null)}
        title="New opportunity"
        labelledBy="new-opportunity-title"
        maxWidth="md"
      >
        <form
          onSubmit={create}
          className="admin-dialog-surface max-h-[92dvh] w-full overflow-y-auto rounded-[24px] bg-[var(--admin-surface)] p-6"
        >
          <DialogHead
            id="new-opportunity-title"
            eyebrow="Pipeline"
            title="New opportunity"
            description="Creates or resolves the contact and company before opening the opportunity."
            close={() => setDialog(null)}
          />
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              ["name", "Contact name", "text", true],
              ["email", "Email", "email", true],
              ["companyName", "Company", "text"],
              ["website", "Website", "text"],
              ["estimatedValue", "Estimated value", "number"],
              ["nextActionAt", "Next action date", "datetime-local"],
            ].map(([name, label, type, required]) => (
              <label key={String(name)} className="text-xs font-semibold">
                {String(label)}
                <input
                  name={String(name)}
                  type={String(type)}
                  required={Boolean(required)}
                  min={type === "number" ? "0" : undefined}
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-3.5 text-sm font-normal outline-none"
                />
              </label>
            ))}
          </div>
          <label className="mt-4 block text-xs font-semibold">
            Next action
            <input
              name="nextAction"
              placeholder="Send audit follow-up"
              className="mt-1.5 min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-3.5 text-sm font-normal"
            />
          </label>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDialog(null)}
              className="min-h-11 px-4 text-xs font-semibold text-[var(--admin-muted)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--admin-ink)] px-4 text-xs font-semibold text-[var(--admin-surface)] disabled:opacity-50"
            >
              {saving && <Loader2 className="size-4 animate-spin" />} Create opportunity
            </button>
          </div>
        </form>
      </AdminDialog>
    </div>
  );
}

function Select({
  value,
  label,
  onChange,
  children,
}: {
  value: string;
  label: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      aria-label={label}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-11 min-w-0 flex-1 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-xs font-semibold outline-none sm:flex-none"
    >
      {children}
    </select>
  );
}
function SelectBlock({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="text-xs font-semibold">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-3.5 text-sm outline-none"
      >
        {children}
      </select>
    </label>
  );
}
function ToolButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: typeof Settings2;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-[var(--admin-muted)] shadow-[var(--admin-shadow-border)] hover:text-[var(--admin-ink)] active:scale-[0.96]"
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}
function IconButton({
  label,
  active,
  onClick,
  icon: Icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: typeof List;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "grid size-9 place-items-center rounded-lg active:scale-[0.96]",
        active ? "bg-[var(--admin-ink)] text-[var(--admin-surface)]" : "text-[var(--admin-muted)]",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}
function DialogHead({
  id,
  eyebrow,
  title,
  description,
  close,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  close: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="admin-eyebrow">{eyebrow}</p>
        <h2 id={id} className="mt-1 text-balance text-xl font-semibold tracking-[-0.03em]">
          {title}
        </h2>
        <p className="admin-copy mt-1 text-pretty text-sm">{description}</p>
      </div>
      <button
        type="button"
        onClick={close}
        aria-label="Close"
        className="grid size-11 shrink-0 place-items-center rounded-xl text-[var(--admin-muted)] active:scale-[0.96]"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function StageSelect({
  item,
  columns,
  saving,
  updateStage,
}: {
  item: Opportunity;
  columns: KanbanColumnRecord[];
  saving: boolean;
  updateStage: (item: Opportunity, stage: string) => Promise<boolean>;
}) {
  const stage = item.canonical_stage ?? item.stage;
  const current = columns.find((column) => column.column_key === stage);
  return (
    <select
      aria-label={`Stage for ${item.name || item.company?.name || "opportunity"}`}
      value={stage}
      disabled={saving}
      onChange={(event) => void updateStage(item, event.target.value)}
      className={cn(
        "min-h-10 max-w-[150px] rounded-xl border-0 px-3 text-xs font-semibold outline-none ring-1 ring-inset ring-black/5 focus:ring-2 disabled:opacity-50 dark:ring-white/10",
        toneForColumn(current),
      )}
    >
      {!current && <option value={stage}>{stage}</option>}
      {columns.map((column) => (
        <option key={column.column_key} value={column.column_key}>
          {column.label}
        </option>
      ))}
    </select>
  );
}
function Card({
  item,
  state,
  columns,
  saving,
  updateStage,
}: {
  item: Opportunity;
  state: PipelineViewState;
  columns: KanbanColumnRecord[];
  saving: boolean;
  updateStage: (item: Opportunity, stage: string) => Promise<boolean>;
}) {
  return (
    <article
      data-opportunity-id={item.id}
      className="rounded-2xl bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow-border)] transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-[var(--admin-shadow-border-hover)] motion-reduce:transform-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/admin/pipeline/${item.id}`}
            className="inline-flex min-h-10 max-w-full items-start gap-1.5 rounded-lg py-1 text-sm font-semibold hover:opacity-70 active:scale-[0.96]"
          >
            <span className="truncate">
              {item.name || item.company?.name || "Untitled opportunity"}
            </span>
            <ArrowUpRight className="mt-0.5 size-3.5 shrink-0" />
          </Link>
          {has(state, "contact") && (
            <p className="admin-copy truncate text-xs">
              {item.company?.name ||
                item.contact?.full_name ||
                item.email ||
                "Identity details pending"}
            </p>
          )}
        </div>
        {has(state, "value") && (
          <span className="shrink-0 font-mono text-xs font-semibold tabular-nums">
            {money(item.estimated_value)}
          </span>
        )}
      </div>
      {has(state, "next_action") && (
        <div className="mt-4 rounded-xl bg-[var(--admin-surface-subtle)] px-3 py-2.5">
          <p className="admin-eyebrow">Next action</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5">
            {item.next_action || "Set a specific next action"}
          </p>
          <p className="admin-copy mt-1 text-[10px] tabular-nums">
            {shortDate(item.next_action_at)}
            {item.next_meeting_at ? ` · Meeting ${shortDate(item.next_meeting_at)}` : ""}
          </p>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          {has(state, "source") && (
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted)]">
              {item.source || "Unknown source"}
            </p>
          )}
          {has(state, "owner") && (
            <p className="mt-1 truncate text-[10px] text-[var(--admin-muted)]">
              {item.owner_email || "Unassigned"}
            </p>
          )}
        </div>
        <StageSelect item={item} columns={columns} saving={saving} updateStage={updateStage} />
      </div>
    </article>
  );
}
/** Card render for the drag-and-drop board — Card's content plus a grip
 * handle wired to KanbanBoard's dragHandleProps. Only the grip starts a
 * drag (never the whole card), so touch scrolling that begins on the card
 * body keeps working on phones; the inline stage select remains the
 * tap-first way to move a deal. Matches the Feature Board pattern. */
function PipelineKanbanCard({
  item,
  opts,
  state,
  columns,
  saving,
  updateStage,
}: {
  item: Opportunity;
  opts: KanbanCardRenderOpts;
  state: PipelineViewState;
  columns: KanbanColumnRecord[];
  saving: boolean;
  updateStage: (item: Opportunity, stage: string) => Promise<boolean>;
}) {
  const label = item.name || item.company?.name || "Untitled opportunity";
  return (
    <div className={cn("group flex items-start gap-1.5", opts.isDragging && "opacity-60")}>
      {!opts.isOverlay && (
        <button
          type="button"
          aria-label={opts.disabled ? "Reordering is unavailable" : `Drag ${label}`}
          disabled={opts.disabled}
          {...opts.dragHandleProps}
          className="grid size-10 shrink-0 touch-none cursor-grab place-items-center rounded-xl text-[var(--admin-muted)] transition-[background-color,color,transform] duration-150 hover:bg-black/[0.04] hover:text-[var(--admin-ink)] active:cursor-grabbing active:scale-[0.96] disabled:cursor-default disabled:opacity-30 dark:hover:bg-white/[0.05]"
        >
          <GripVertical className="size-4" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <Card item={item} state={state} columns={columns} saving={saving} updateStage={updateStage} />
      </div>
    </div>
  );
}
function ListView({
  items,
  state,
  columns,
  saving,
  updateStage,
}: {
  items: Opportunity[];
  state: PipelineViewState;
  columns: KanbanColumnRecord[];
  saving: boolean;
  updateStage: (item: Opportunity, stage: string) => Promise<boolean>;
}) {
  return (
    <div className="border-t border-[var(--admin-border)]">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-black/[0.018] font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--admin-muted)]">
            <tr>
              <th scope="col" className="px-5 py-3.5">Opportunity</th>
              {has(state, "contact") && <th scope="col">Contact</th>}
              {has(state, "source") && <th scope="col">Source</th>}
              {has(state, "value") && <th scope="col" className="text-right">Value</th>}
              {has(state, "next_action") && <th scope="col">Next action</th>}
              {has(state, "owner") && <th scope="col">Owner</th>}
              <th scope="col" className="px-5">Stage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--admin-border)]">
            {items.map((item) => (
              <tr key={item.id} data-opportunity-id={item.id}>
                <td className="px-5 py-4">
                  <Link
                    href={`/admin/pipeline/${item.id}`}
                    className="inline-flex min-h-10 items-center gap-1.5 font-semibold hover:opacity-70"
                  >
                    {item.name || item.company?.name || "Untitled"}
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                  <p className="admin-copy text-xs">
                    {item.company?.domain || "Company details pending"}
                  </p>
                </td>
                {has(state, "contact") && (
                  <td className="px-4">{item.contact?.full_name || item.email || "Unknown"}</td>
                )}
                {has(state, "source") && (
                  <td className="px-4 text-xs text-[var(--admin-muted)]">
                    {item.source || "Unknown"}
                  </td>
                )}
                {has(state, "value") && (
                  <td className="px-4 text-right font-mono tabular-nums">
                    {money(item.estimated_value)}
                  </td>
                )}
                {has(state, "next_action") && (
                  <td className="max-w-[240px] px-4">
                    <p className="truncate text-xs">{item.next_action || "Set next action"}</p>
                    <p className="admin-copy text-[10px]">{shortDate(item.next_action_at)}</p>
                  </td>
                )}
                {has(state, "owner") && (
                  <td className="max-w-[180px] truncate px-4 text-xs">
                    {item.owner_email || "Unassigned"}
                  </td>
                )}
                <td className="px-5">
                  <StageSelect item={item} columns={columns} saving={saving} updateStage={updateStage} />
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center">
                  <Empty />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 p-4 md:hidden">
        {items.map((item) => (
          <Card
            key={item.id}
            item={item}
            state={state}
            columns={columns}
            saving={saving}
            updateStage={updateStage}
          />
        ))}
        {!items.length && <Empty />}
      </div>
    </div>
  );
}
function Empty() {
  return (
    <div className="py-8 text-center">
      <Target className="mx-auto size-5 text-[var(--admin-muted)]" />
      <p className="mt-3 text-sm font-semibold">No matching opportunities</p>
      <p className="admin-copy mt-1 text-xs">Adjust the view or create the first opportunity.</p>
    </div>
  );
}
