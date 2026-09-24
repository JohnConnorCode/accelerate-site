"use client";

import { adminPageName } from "@/lib/admin/navigation";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, RefreshCw, X } from "lucide-react";
import Link, { useAdminNavigation } from "@/components/admin/AdminLink";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { AdminRecordRow } from "@/components/admin/AdminRecordRow";
import { ActionReviewDialog, type ActionRow } from "@/components/admin/ActionReviewDialog";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { fetchJson } from "@/lib/admin/fetchJson";
import { relativeTime } from "@/lib/admin/work-presentation";
import { cn } from "@/lib/utils";
import { WorkflowCalendar } from "@/components/admin/WorkflowCalendar";
import { WorkflowLayoutSwitcher } from "@/components/admin/WorkflowLayoutSwitcher";
import { useAdminDemo } from "@/components/admin/AdminDemoBoundary";
import {
  readWorkflowPreference,
  writeWorkflowPreference,
  type WorkflowLayout,
  type WorkflowViewDescriptor,
} from "@/lib/admin/workflow-views";
import type { TodaySnapshot } from "@/lib/admin/today-data";
import { toast } from "@/lib/admin/useToast";
import { AgentWorkPanel } from "@/components/admin/AgentWorkPanel";
import { workViewConfigSchema, type WorkViewConfig } from "@/lib/admin/work-view-contract";

interface TaskRow {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  description?: string | null;
  priority: string;
  source?: string;
  assigned_to?: string | null;
  related_type?: string | null;
  related_id?: string | null;
  related_name?: string | null;
  opportunity_id?: string | null;
}
interface SavedWorkView {
  id: string;
  name: string;
  config: WorkViewConfig;
  visibility: "private" | "workspace";
  ownerId: string;
}
const control = "admin-field";
const taskViewDescriptor: WorkflowViewDescriptor<TaskRow> = {
  id: "tasks",
  label: "Tasks",
  layouts: ["list", "board", "calendar"],
  fields: [
    { id: "task", label: "Task" },
    { id: "related", label: "Related record" },
    { id: "due", label: "Due date" },
    { id: "priority", label: "Priority" },
  ],
  groupBy: {
    label: "Status",
    values: [
      { id: "pending", label: "Open" },
      { id: "snoozed", label: "Snoozed" },
      { id: "completed", label: "Completed" },
    ],
  },
  sortBy: [
    { id: "due_date", label: "Due date" },
    { id: "priority", label: "Priority" },
  ],
  filters: [
    { id: "owner", label: "Ownership" },
    { id: "status", label: "Status" },
    { id: "source", label: "Source" },
    { id: "search", label: "Search" },
  ],
  title: (task) => task.title,
  dueDate: (task) => task.due_date,
  status: (task) => task.status,
  summary: (task) => [task.related_name, task.priority].filter(Boolean).join(" · "),
};

export default function WorkPage() {
  const pathname = usePathname();
  const scopeKey = pathname.replace(/\/work$/, "");
  const params = useSearchParams();
  const demo = useAdminDemo();
  const router = useAdminNavigation();
  const tab =
    params.get("tab") === "approvals" ? "approvals" : params.get("tab") === "ai" ? "ai" : "tasks";
  const [owner, setOwner] = useState("team");
  const [status, setStatus] = useState("pending");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);
  const [layout, setLayout] = useState<WorkflowLayout>("list");
  const [visibleFields, setVisibleFields] = useState(
    taskViewDescriptor.fields.map((field) => field.id),
  );
  const [viewReadyScope, setViewReadyScope] = useState("");
  const [selectedViewId, setSelectedViewId] = useState("");
  const [viewName, setViewName] = useState("");
  const [viewVisibility, setViewVisibility] = useState<"private" | "workspace">("private");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [task, setTask] = useState<TaskRow | null>(null);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState("medium");
  const [review, setReview] = useState<ActionRow | null>(null);
  const taskParams = new URLSearchParams({ status, owner, page: String(page), pageSize: "100" });
  if (source) taskParams.set("source", source);
  if (deferredSearch) taskParams.set("q", deferredSearch);
  const tasksQuery = useAdminQuery<{
    tasks: TaskRow[];
    total: number;
    viewerId?: string;
    tenantId?: string;
  }>(
    ["work", "tasks", owner, status, source, deferredSearch, page],
    `/api/admin/tasks?${taskParams}`,
  );
  const actionsQuery = useAdminQuery<{ actions: ActionRow[] }>(
    ["today", "actions"],
    "/api/admin/revenue-os/actions",
  );
  const viewsQuery = useAdminQuery<{ views: SavedWorkView[]; viewerId: string }>(
    ["work", "saved-views"],
    "/api/admin/work/views",
    { enabled: !demo?.scenarioId },
  );
  const todayQuery = useAdminQuery<TodaySnapshot>(
    ["today-workspace", scopeKey],
    "/api/admin/revenue-os/today",
    { refetchOnWindowFocus: true },
  );
  const tasks = tasksQuery.data?.tasks ?? [];
  const routeTenant = pathname.match(/^\/t\/([^/]+)\/admin(?:\/|$)/)?.[1] ?? "accelerate";
  const preferenceScope = tasksQuery.data?.viewerId
    ? `${tasksQuery.data.tenantId ?? demo?.scenarioId ?? routeTenant}:${tasksQuery.data.viewerId}`
    : "";
  useEffect(() => {
    if (!preferenceScope) return;
    const saved = readWorkflowPreference(preferenceScope, taskViewDescriptor);
    setLayout(saved.layout);
    setVisibleFields(saved.visibleFields);
    setOwner(saved.filters?.owner ?? "team");
    setStatus(saved.filters?.status ?? "pending");
    setSource(saved.filters?.source ?? "");
    setSearch(saved.filters?.search ?? "");
    setViewReadyScope(preferenceScope);
  }, [preferenceScope]);
  useEffect(() => {
    if (!preferenceScope || viewReadyScope !== preferenceScope) return;
    writeWorkflowPreference(preferenceScope, taskViewDescriptor, {
      layout,
      visibleFields,
      filters: { owner, status, source, search },
    });
  }, [layout, owner, preferenceScope, search, source, status, viewReadyScope, visibleFields]);
  const actions = useMemo(
    () =>
      (actionsQuery.data?.actions ?? []).filter(
        (a) => a.status === "pending" && (!a.expires_at || Date.parse(a.expires_at) > Date.now()),
      ),
    [actionsQuery.data],
  );
  const followups = (todayQuery.data?.handling.data ?? []).filter(
    (item) => item.kind === "draft_followup" && item.status !== "completed",
  );
  const visible = tasks;
  const filtersChanged = owner !== "team" || status !== "pending" || Boolean(source || search);
  const viewChanged =
    filtersChanged ||
    layout !== "list" ||
    taskViewDescriptor.fields.some((field) => !visibleFields.includes(field.id));
  const selectedView = viewsQuery.data?.views.find((view) => view.id === selectedViewId);
  const chooseSavedView = (id: string) => {
    setSelectedViewId(id);
    setPage(1);
    const view = viewsQuery.data?.views.find((candidate) => candidate.id === id);
    if (!view) return;
    setViewName(view.name);
    setViewVisibility(view.visibility);
    setOwner(view.config.owner);
    setStatus(view.config.status);
    setSource(view.config.source);
    setSearch(view.config.search);
    setLayout(view.config.layout);
    setVisibleFields(view.config.visibleFields);
  };
  const saveView = async (update: boolean) => {
    if (busy) return;
    const config = workViewConfigSchema.safeParse({
      owner,
      status,
      source,
      search,
      layout,
      visibleFields,
    });
    if (!config.success || !viewName.trim()) {
      setError("Name the view and check its filters before saving.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await fetchJson<{ view: { id: string } }>("/api/admin/work/views", {
        method: update ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(update ? { id: selectedViewId } : {}),
          name: viewName.trim(),
          visibility: viewVisibility,
          config: config.data,
        }),
      });
      await viewsQuery.refetch();
      setSelectedViewId(result.view.id);
      toast.success(update ? "Work view updated" : "Work view saved");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Work view could not be saved");
    } finally {
      setBusy(false);
    }
  };
  const removeView = async () => {
    if (!selectedView || selectedView.ownerId !== viewsQuery.data?.viewerId || busy) return;
    setBusy(true);
    setError("");
    try {
      await fetchJson(`/api/admin/work/views?id=${encodeURIComponent(selectedView.id)}`, {
        method: "DELETE",
      });
      setSelectedViewId("");
      setViewName("");
      await viewsQuery.refetch();
      toast.success("Work view removed");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Work view could not be removed");
    } finally {
      setBusy(false);
    }
  };
  const requestedTask = params.get("task");
  const loadedTaskRef = useRef<string | null>(null);
  const selectedTaskQuery = useAdminQuery<{ tasks: TaskRow[] }>(
    ["work", "task", requestedTask],
    `/api/admin/tasks?id=${encodeURIComponent(requestedTask ?? "")}`,
    { enabled: Boolean(requestedTask) },
  );
  useEffect(() => {
    if (!requestedTask) {
      loadedTaskRef.current = null;
      return;
    }
    if (loadedTaskRef.current === requestedTask) return;
    const row = selectedTaskQuery.data?.tasks[0];
    if (row) {
      loadedTaskRef.current = requestedTask;
      setTask(row);
      setTitle(row.title);
      setDue(row.due_date ?? "");
      setPriority(row.priority === "normal" ? "medium" : row.priority);
    }
  }, [requestedTask, selectedTaskQuery.data]);
  const closeTask = () => {
    setTask(null);
    if (requestedTask) router.replace("/admin/work", "preserve");
  };
  const actionId = params.get("action");
  useEffect(() => {
    if (actionId) {
      const row = actions.find((a) => a.id === actionId);
      if (row) setReview(row);
    }
  }, [actionId, actions]);
  const refresh = async () => {
    await Promise.all([tasksQuery.refetch(), actionsQuery.refetch(), todayQuery.refetch()]);
  };
  const changed = async () => {
    await refresh();
    window.dispatchEvent(new Event("admin:priority-refresh"));
  };
  const closeReview = () => {
    setReview(null);
    if (actionId) router.replace("/admin/work?tab=approvals", "preserve");
  };
  const decide = async (decision: "approve" | "reject") => {
    if (!review || busy) return;
    setBusy(true);
    setError("");
    try {
      await fetchJson("/api/admin/revenue-os/actions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: review.id, decision }),
      });
      if (review.action_type === "create_gmail_draft")
        toast.success("Gmail draft saved. Not sent. Open Work → Follow-ups to review it in Gmail.");
      closeReview();
      await changed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the decision.");
    } finally {
      setBusy(false);
    }
  };
  const edit = (row: TaskRow) => {
    setTask(row);
    setTitle(row.title);
    setDue(row.due_date ?? "");
    setPriority(row.priority === "normal" ? "medium" : row.priority);
    setError("");
  };
  const mutateTask = async (row: TaskRow, complete = false) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fetchJson(complete ? "/api/admin/revenue-os/tasks" : "/api/admin/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          complete
            ? { id: row.id, action: "complete" }
            : { id: row.id, title, priority, due_date: due || null },
        ),
      });
      closeTask();
      await changed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the task.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title={adminPageName("work")}
        subtitle="Track assigned tasks and review actions waiting for your approval."
        utilityActions={
          <button
            type="button"
            onClick={() => void refresh()}
            aria-label="Refresh work"
            className="admin-icon-button"
          >
            <RefreshCw
              className={cn(
                "size-4",
                (tasksQuery.isFetching || actionsQuery.isFetching) && "animate-spin",
              )}
            />
          </button>
        }
      />
      <nav aria-label="Work views" className="flex gap-2 border-b border-[var(--admin-border)]">
        {(["tasks", "approvals", "ai"] as const).map((value) => (
          <Link
            key={value}
            href={`/admin/work?tab=${value}`}
            aria-current={tab === value ? "page" : undefined}
            className={cn(
              "min-h-11 border-b-2 px-3 py-3 text-sm font-semibold",
              tab === value
                ? "border-[var(--admin-ink)] text-[var(--admin-ink)]"
                : "border-transparent text-[var(--admin-muted)]",
            )}
          >
            {value === "tasks" ? "Tasks" : value === "ai" ? "AI work" : "Approvals"}
          </Link>
        ))}
      </nav>
      {(error || tasksQuery.error || actionsQuery.error) && (
        <p
          role="alert"
          className="rounded-lg border border-[var(--admin-danger)]/30 p-3 text-sm text-[var(--admin-danger)]"
        >
          {error || tasksQuery.error?.message || actionsQuery.error?.message}
        </p>
      )}
      {tab === "tasks" ? (
        <>
          {!demo?.scenarioId && (
            <AdminSurface padding="md">
              <div className="flex flex-wrap items-end gap-3">
                <label className="min-w-40 flex-1 text-xs font-medium text-[var(--admin-ink)]">
                  Saved views
                  <select
                    className="admin-field mt-1 w-full"
                    value={selectedViewId}
                    onChange={(event) => chooseSavedView(event.target.value)}
                  >
                    <option value="">Current view</option>
                    {viewsQuery.data?.views.map((view) => (
                      <option key={view.id} value={view.id}>
                        {view.name}
                        {view.visibility === "workspace" ? " · Shared" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="min-w-40 flex-1 text-xs font-medium text-[var(--admin-ink)]">
                  View name
                  <input
                    className="admin-field mt-1 w-full"
                    maxLength={80}
                    value={viewName}
                    onChange={(event) => setViewName(event.target.value)}
                    placeholder="My follow-ups"
                  />
                </label>
                <label className="text-xs font-medium text-[var(--admin-ink)]">
                  Visibility
                  <select
                    className="admin-field mt-1 w-full"
                    value={viewVisibility}
                    onChange={(event) =>
                      setViewVisibility(event.target.value as "private" | "workspace")
                    }
                  >
                    <option value="private">Only me</option>
                    <option value="workspace">Workspace</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="admin-button admin-button--secondary"
                  disabled={busy}
                  onClick={() => void saveView(false)}
                >
                  Save new
                </button>
                {selectedView?.ownerId === viewsQuery.data?.viewerId && (
                  <>
                    <button
                      type="button"
                      className="admin-button admin-button--secondary"
                      disabled={busy}
                      onClick={() => void saveView(true)}
                    >
                      Update
                    </button>
                    <button
                      type="button"
                      className="admin-button admin-button--secondary"
                      disabled={busy}
                      onClick={() => void removeView()}
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
              {viewsQuery.error && (
                <p role="alert" className="mt-2 text-sm text-[var(--admin-danger)]">
                  Saved views could not load. Current task filters still work.
                </p>
              )}
            </AdminSurface>
          )}
          <AdminSurface padding="none" elevation="flat">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--admin-border)] px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-[var(--admin-ink)]">Follow-ups</h2>
                <p className="mt-1 text-xs text-[var(--admin-muted)]">
                  Keep the draft, sent message, and next check together until the contact replies.
                </p>
              </div>
              <Link
                href="/admin/work?tab=approvals"
                className="admin-button admin-button-secondary"
              >
                Review approvals {actions.length ? `(${actions.length})` : ""}
              </Link>
            </div>
            {todayQuery.error ? (
              <p role="status" className="px-5 py-4 text-sm text-[var(--admin-muted)]">
                Follow-up status is unavailable. Refresh to try again.
              </p>
            ) : followups.length ? (
              <ul>
                {followups.map((item) => {
                  const draftSaved = item.outcome?.includes("Gmail draft saved") ?? false;
                  const draftUncertain = item.error?.includes("Gmail") ?? false;
                  const followupSent = item.outcome?.includes("Follow-up sent from Gmail") ?? false;
                  return (
                    <li
                      key={item.id}
                      className="border-b border-[var(--admin-border)] px-5 py-4 last:border-b-0"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-[var(--admin-ink)]">
                              {item.title}
                            </h3>
                            <span className="rounded-full bg-[var(--admin-surface-subtle)] px-2 py-0.5 text-[10px] font-medium capitalize text-[var(--admin-muted)]">
                              {draftUncertain
                                ? "reconciliation needed"
                                : item.status.replaceAll("_", " ")}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-[var(--admin-muted)]">
                            {item.error || item.outcome || "Review the linked follow-up."}
                          </p>
                          {item.nextCheckReason && item.nextCheckReason !== item.outcome && (
                            <p className="mt-1 text-xs text-[var(--admin-muted)]">
                              {item.nextCheckReason}
                            </p>
                          )}
                          {item.nextCheckAt && (
                            <p className="mt-1 text-[11px] text-[var(--admin-muted)]">
                              Next check {new Date(item.nextCheckAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {draftSaved || draftUncertain ? (
                            <a
                              href="https://mail.google.com/mail/u/0/#drafts"
                              target="_blank"
                              rel="noreferrer"
                              className="admin-button admin-button--primary"
                            >
                              {draftUncertain
                                ? "Check Gmail Drafts before retrying"
                                : "Open Gmail Drafts"}
                            </a>
                          ) : followupSent ? (
                            <Link href={item.href} className="admin-button admin-button--primary">
                              Open opportunity
                            </Link>
                          ) : item.status === "waiting" ? (
                            <Link
                              href="/admin/work?tab=approvals"
                              className="admin-button admin-button--primary"
                            >
                              Review approval
                            </Link>
                          ) : (
                            <Link href={item.href} className="admin-button admin-button--primary">
                              Open follow-up
                            </Link>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-[var(--admin-muted)]">
                No open follow-ups. New follow-up work appears here when a customer or opportunity
                needs a response.
              </p>
            )}
          </AdminSurface>
          <div
            id="work-filters"
            data-expanded={filtersOpen}
            className="admin-toolbar admin-toolbar--filters admin-work-toolbar"
            role="search"
            aria-label="Task filters"
          >
            <div className="admin-toolbar-field admin-work-filter-option">
              <label className="admin-field-label" htmlFor="work-owner">
                Ownership
              </label>
              <select
                id="work-owner"
                value={owner}
                onChange={(e) => {
                  setOwner(e.target.value);
                  setPage(1);
                }}
                className={control}
              >
                <option value="team">Team work</option>
                <option value="me">My work</option>
                <option value="unassigned">Unassigned</option>
              </select>
            </div>
            <div className="admin-toolbar-field admin-work-filter-option">
              <label className="admin-field-label" htmlFor="work-status">
                Task status
              </label>
              <select
                id="work-status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className={control}
              >
                <option value="pending">Open</option>
                <option value="snoozed">Snoozed</option>
                <option value="completed">Completed</option>
                <option value="all">All statuses</option>
              </select>
            </div>
            <div className="admin-toolbar-field admin-work-filter-option">
              <label className="admin-field-label" htmlFor="work-source">
                App or source
              </label>
              <input
                id="work-source"
                list="work-source-options"
                placeholder="All sources"
                value={source}
                onChange={(e) => {
                  setSource(e.target.value);
                  setPage(1);
                }}
                className={control}
              />
              <datalist id="work-source-options">
                {Array.from(
                  new Set(tasks.map((t) => t.source).filter((s): s is string => Boolean(s))),
                ).map((value) => (
                  <option key={value} value={value}>
                    {value.replaceAll("_", " ")}
                  </option>
                ))}
              </datalist>
            </div>
            <div className="admin-toolbar-field admin-toolbar-search">
              <label className="admin-field-label" htmlFor="work-search">
                Search tasks
              </label>
              <input
                id="work-search"
                placeholder="Find a task or related record"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className={control}
              />
            </div>
          </div>
          <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 text-sm">
            <WorkflowLayoutSwitcher value={layout} onChange={setLayout} />
            <details className="relative">
              <summary className="admin-button admin-button-secondary cursor-pointer list-none">
                Fields
              </summary>
              <div className="absolute right-0 z-20 mt-2 grid min-w-44 gap-2 rounded-[var(--admin-control-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 shadow-[var(--admin-shadow)]">
                {taskViewDescriptor.fields.map((field) => (
                  <label
                    key={field.id}
                    className="flex min-h-11 items-center gap-2 text-xs text-[var(--admin-ink)]"
                  >
                    <input
                      type="checkbox"
                      disabled={field.id === "task"}
                      checked={field.id === "task" || visibleFields.includes(field.id)}
                      onChange={(event) =>
                        setVisibleFields((current) =>
                          event.target.checked
                            ? [...current, field.id]
                            : current.filter((id) => id !== field.id),
                        )
                      }
                    />
                    {field.label}
                  </label>
                ))}
              </div>
            </details>
            <button
              type="button"
              className="admin-button admin-button-secondary admin-work-filter-toggle"
              aria-controls="work-filters"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              {filtersOpen ? "Hide filters" : "Filters"}
              {owner !== "team" || status !== "pending" || source
                ? ` (${Number(owner !== "team") + Number(status !== "pending") + Number(Boolean(source))})`
                : ""}
            </button>
            <p role="status" className="text-[var(--admin-muted)]">
              {tasksQuery.isPending
                ? "Loading tasks…"
                : `${tasksQuery.data?.total ?? visible.length} ${tasksQuery.data?.total === 1 ? "task" : "tasks"} found`}
              {tasksQuery.isFetching && !tasksQuery.isPending ? " · Updating…" : ""}
            </p>
            {viewChanged && (
              <button
                type="button"
                className="admin-button admin-button-secondary"
                onClick={() => {
                  setOwner("team");
                  setStatus("pending");
                  setSource("");
                  setSearch("");
                  setPage(1);
                  setLayout("list");
                  setVisibleFields(taskViewDescriptor.fields.map((field) => field.id));
                }}
              >
                Reset view
              </button>
            )}
          </div>
          {layout === "calendar" ? (
            tasksQuery.isPending ? (
              <p role="status" className="py-8 text-center text-sm text-[var(--admin-muted)]">
                Loading task calendar…
              </p>
            ) : (
              <WorkflowCalendar descriptor={taskViewDescriptor} items={visible} onOpen={edit} />
            )
          ) : layout === "board" ? (
            <div className="flex gap-4 overflow-x-auto pb-3" aria-label="Tasks by status">
              {taskViewDescriptor.groupBy.values
                .filter((group) => status === "all" || group.id === status)
                .map((group) => {
                  const rows = visible.filter((row) => row.status === group.id);
                  return (
                    <section
                      key={group.id}
                      aria-labelledby={`work-column-${group.id}`}
                      className="min-w-[min(82vw,20rem)] flex-1 space-y-3 rounded-[var(--admin-surface-radius)] bg-[var(--admin-surface-subtle)] p-3 sm:min-w-72"
                    >
                      <h2
                        id={`work-column-${group.id}`}
                        className="flex items-center justify-between px-1 text-sm font-semibold text-[var(--admin-ink)]"
                      >
                        {group.label}
                        <span className="text-xs font-normal text-[var(--admin-muted)]">
                          {rows.length}
                        </span>
                      </h2>
                      {rows.map((row) => (
                        <AdminSurface
                          key={row.id}
                          padding="sm"
                          elevation="flat"
                          className="space-y-2"
                        >
                          <button
                            type="button"
                            className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]"
                            onClick={() => edit(row)}
                          >
                            <span className="block text-sm font-semibold text-[var(--admin-ink)]">
                              {row.title}
                            </span>
                            {visibleFields.includes("related") && (
                              <span className="mt-1 block text-xs text-[var(--admin-muted)]">
                                {row.related_name || "No related record"}
                              </span>
                            )}
                          </button>
                          <div className="flex items-center justify-between gap-2 text-xs text-[var(--admin-muted)]">
                            {visibleFields.includes("due") && (
                              <span>{relativeTime(row.due_date)}</span>
                            )}
                            {visibleFields.includes("priority") && (
                              <span className="capitalize">
                                {row.priority === "normal" ? "medium" : row.priority}
                              </span>
                            )}
                          </div>
                          {row.status !== "completed" && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void mutateTask(row, true)}
                              className="admin-button admin-button-secondary min-h-10 w-full"
                            >
                              Complete task
                            </button>
                          )}
                        </AdminSurface>
                      ))}
                      {!rows.length && (
                        <p className="px-1 py-4 text-xs text-[var(--admin-muted)]">
                          No {group.label.toLowerCase()} tasks.
                        </p>
                      )}
                    </section>
                  );
                })}
            </div>
          ) : (
            <>
              <AdminSurface padding="none" elevation="flat">
                <div className="admin-work-heading" aria-hidden="true">
                  <div className="admin-work-columns">
                    {visibleFields.includes("task") && <span>Task</span>}
                    {visibleFields.includes("related") && <span>Related record</span>}
                    {visibleFields.includes("due") && <span>Due</span>}
                    {visibleFields.includes("priority") && <span>Priority</span>}
                  </div>
                  <span>Action</span>
                </div>
                <ul>
                  {visible.map((row) => (
                    <li key={row.id} data-source-type="task" data-source-id={row.id}>
                      <AdminRecordRow
                        label={`Open task ${row.title}`}
                        onOpen={() => edit(row)}
                        actions={
                          row.status !== "completed" ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void mutateTask(row, true)}
                              aria-label={`Complete ${row.title}`}
                              className="admin-work-complete inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-[var(--admin-ink)] hover:bg-[var(--admin-success-soft)] disabled:opacity-50"
                            >
                              <CheckCircle2 className="size-4" aria-hidden="true" />
                              <span className="admin-work-action-label">Complete</span>
                            </button>
                          ) : (
                            <span className="admin-work-complete text-xs text-[var(--admin-muted)]">
                              Completed
                            </span>
                          )
                        }
                      >
                        <span
                          className="admin-work-columns"
                          style={{
                            gridTemplateColumns: `repeat(${visibleFields.length}, minmax(0, 1fr))`,
                          }}
                        >
                          {visibleFields.includes("task") && (
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-[var(--admin-ink)]">
                                {row.title}
                              </span>
                              <span className="mt-1 block text-xs capitalize text-[var(--admin-muted)]">
                                {row.status === "pending" ? "Open" : row.status}
                                {row.source ? ` · ${row.source.replaceAll("_", " ")}` : ""}
                              </span>
                            </span>
                          )}
                          {visibleFields.includes("related") && (
                            <span className="admin-work-related text-sm text-[var(--admin-muted)]">
                              {row.related_name || "No related record"}
                            </span>
                          )}
                          {visibleFields.includes("due") && (
                            <span
                              className={cn(
                                "text-sm tabular-nums",
                                row.status !== "completed" &&
                                  relativeTime(row.due_date).includes("overdue")
                                  ? "font-medium text-[var(--admin-danger)]"
                                  : "text-[var(--admin-muted)]",
                              )}
                            >
                              {relativeTime(row.due_date)}
                            </span>
                          )}
                          {visibleFields.includes("priority") && (
                            <span className="text-xs font-medium capitalize text-[var(--admin-ink)]">
                              <span className="admin-work-mobile-label">Priority: </span>
                              {row.priority === "normal" ? "medium" : row.priority}
                            </span>
                          )}
                        </span>
                      </AdminRecordRow>
                    </li>
                  ))}
                </ul>
                {!visible.length && (
                  <p className="p-5 text-sm text-[var(--admin-muted)]">
                    {tasksQuery.isPending ? "Loading tasks…" : "No tasks match these filters."}
                  </p>
                )}
              </AdminSurface>
            </>
          )}
          {(tasksQuery.data?.total ?? 0) > 100 && (
            <nav aria-label="Task pages" className="flex items-center justify-end gap-3 text-sm">
              <button
                type="button"
                className="admin-button admin-button-secondary"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <span className="text-[var(--admin-muted)]">
                Page {page} of {Math.ceil((tasksQuery.data?.total ?? 0) / 100)}
              </span>
              <button
                type="button"
                className="admin-button admin-button-secondary"
                disabled={page * 100 >= (tasksQuery.data?.total ?? 0)}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </nav>
          )}
        </>
      ) : tab === "ai" ? (
        <AgentWorkPanel />
      ) : (
        <AdminSurface padding="none" elevation="flat">
          <ul>
            {actions.map((row) => (
              <li key={row.id} data-source-type="approval" data-source-id={row.id}>
                <AdminRecordRow
                  label={`Review ${row.title}`}
                  onOpen={() => {
                    setReview(row);
                    setError("");
                    router.push(`/admin/work?tab=approvals&action=${row.id}`, "preserve");
                  }}
                >
                  <span className="block text-sm font-semibold text-[var(--admin-ink)]">
                    {row.title}
                  </span>
                  <span className="mt-1 block text-xs text-[var(--admin-muted)]">
                    {row.reasoning || row.description || "Review the exact proposed change."}
                  </span>
                </AdminRecordRow>
              </li>
            ))}
          </ul>
          {!actions.length && (
            <p className="p-5 text-sm text-[var(--admin-muted)]">
              {actionsQuery.isPending ? "Loading approvals…" : "No decisions waiting."}
            </p>
          )}
        </AdminSurface>
      )}
      <ActionReviewDialog
        open={Boolean(review)}
        action={review}
        busy={busy}
        error={error}
        onClose={closeReview}
        onApprove={() => void decide("approve")}
        onReject={() => void decide("reject")}
      />
      <AdminDialog
        open={Boolean(task)}
        onClose={closeTask}
        title="Task details"
        align="right"
        maxWidth="sm"
        className="sm:max-w-[420px]"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (task) void mutateTask(task);
          }}
          className="flex h-dvh flex-col bg-[var(--admin-surface)]"
        >
          <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-5 py-3">
            <h2 className="text-lg font-semibold text-[var(--admin-ink)]">Task details</h2>
            <button
              type="button"
              aria-label="Close task"
              onClick={closeTask}
              className="admin-icon-button"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {error && (
              <p role="alert" className="text-sm text-[var(--admin-danger)]">
                {error}
              </p>
            )}
            <label className="grid gap-1 text-sm text-[var(--admin-ink)]">
              Title
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={control}
              />
            </label>
            <label className="grid gap-1 text-sm text-[var(--admin-ink)]">
              Due date
              <input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className={control}
              />
            </label>
            <label className="grid gap-1 text-sm text-[var(--admin-ink)]">
              Priority
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className={control}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            {task?.description && (
              <p className="text-sm text-[var(--admin-muted)]">{task.description}</p>
            )}
            {task?.opportunity_id && (
              <Link
                href={`/admin/pipeline/${task.opportunity_id}`}
                className="inline-flex min-h-11 items-center text-sm underline"
              >
                Open related opportunity
              </Link>
            )}
            <p className="text-xs text-[var(--admin-muted)]">
              Status: {task?.status}. Changes save to the same task shown in Today.
            </p>
          </div>
          <div className="border-t border-[var(--admin-border)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="submit"
              disabled={busy || task?.status === "completed"}
              className="admin-button admin-button--primary w-full"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}Save changes
            </button>
          </div>
        </form>
      </AdminDialog>
    </div>
  );
}
