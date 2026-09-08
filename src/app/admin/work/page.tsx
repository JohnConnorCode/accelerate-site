"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2, RefreshCw, X } from "lucide-react";
import Link, { useAdminNavigation } from "@/components/admin/AdminLink";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { ActionReviewDialog, type ActionRow } from "@/components/admin/ActionReviewDialog";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { fetchJson } from "@/lib/admin/fetchJson";
import { relativeTime } from "@/lib/admin/work-presentation";
import { cn } from "@/lib/utils";

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
const control =
  "min-h-11 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-ink)]";

export default function WorkPage() {
  const params = useSearchParams();
  const router = useAdminNavigation();
  const tab = params.get("tab") === "approvals" ? "approvals" : "tasks";
  const [owner, setOwner] = useState("team");
  const [status, setStatus] = useState("pending");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [task, setTask] = useState<TaskRow | null>(null);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState("medium");
  const [review, setReview] = useState<ActionRow | null>(null);
  const tasksQuery = useAdminQuery<{ tasks: TaskRow[]; viewerId?: string }>(
    ["work", "tasks", owner, status],
    `/api/admin/tasks?status=${status}&owner=${owner}`,
  );
  const actionsQuery = useAdminQuery<{ actions: ActionRow[] }>(
    ["today", "actions"],
    "/api/admin/revenue-os/actions",
  );
  const tasks = tasksQuery.data?.tasks ?? [];
  const actions = useMemo(
    () =>
      (actionsQuery.data?.actions ?? []).filter(
        (a) => a.status === "pending" && (!a.expires_at || Date.parse(a.expires_at) > Date.now()),
      ),
    [actionsQuery.data],
  );
  const visible = tasks.filter(
    (t) =>
      (!source || t.source === source) &&
      `${t.title} ${t.related_name ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );
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
    await Promise.all([tasksQuery.refetch(), actionsQuery.refetch()]);
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
        title="Work"
        subtitle="Tasks and decisions, connected to the records behind them."
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
        {(["tasks", "approvals"] as const).map((value) => (
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
            {value === "tasks" ? "Tasks" : "Approvals"}
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
          <div className="flex flex-wrap gap-2" aria-label="Task filters">
            <label className="sr-only" htmlFor="work-owner">
              Ownership
            </label>
            <select
              id="work-owner"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className={control}
            >
              <option value="team">Team work</option>
              <option value="me">My work</option>
              <option value="unassigned">Unassigned</option>
            </select>
            <label className="sr-only" htmlFor="work-status">
              Task status
            </label>
            <select
              id="work-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={control}
            >
              <option value="pending">Open</option>
              <option value="snoozed">Snoozed</option>
              <option value="completed">Completed</option>
              <option value="all">All statuses</option>
            </select>
            <label className="sr-only" htmlFor="work-source">
              App or source
            </label>
            <select
              id="work-source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className={control}
            >
              <option value="">All sources</option>
              {Array.from(
                new Set(tasks.map((t) => t.source).filter((s): s is string => Boolean(s))),
              ).map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="work-search">
              Find a task or related record
            </label>
            <input
              id="work-search"
              placeholder="Find a task or related record"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(control, "min-w-0 flex-1")}
            />
          </div>
          <AdminSurface padding="none" elevation="flat">
            <ul className="divide-y divide-[var(--admin-border)]">
              {visible.map((row) => (
                <li
                  key={row.id}
                  data-source-type="task"
                  data-source-id={row.id}
                  className="flex items-start gap-3 px-4 py-3"
                >
                  <button
                    type="button"
                    onClick={() => edit(row)}
                    className="min-h-11 min-w-0 flex-1 text-left"
                    aria-haspopup="dialog"
                  >
                    <span className="block text-sm font-semibold text-[var(--admin-ink)]">
                      {row.title}
                    </span>
                    <span className="mt-1 block text-xs text-[var(--admin-muted)]">
                      {relativeTime(row.due_date)} · {row.status}
                      {row.related_name ? ` · ${row.related_name}` : ""}
                    </span>
                  </button>
                  {row.status !== "completed" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void mutateTask(row, true)}
                      aria-label={`Complete ${row.title}`}
                      className="grid size-11 shrink-0 place-items-center rounded-lg text-[var(--admin-success)] hover:bg-[var(--admin-success-soft)] disabled:opacity-50"
                    >
                      <CheckCircle2 className="size-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {!visible.length && (
              <p className="p-5 text-sm text-[var(--admin-muted)]">
                {tasksQuery.isPending ? "Loading tasks…" : "No tasks match these filters."}
              </p>
            )}
          </AdminSurface>
          <p className="text-xs text-[var(--admin-muted)]">
            Showing up to 100 tasks for the selected ownership and status. App-specific cases keep
            their own workspaces.
          </p>
        </>
      ) : (
        <AdminSurface padding="none" elevation="flat">
          <ul className="divide-y divide-[var(--admin-border)]">
            {actions.map((row) => (
              <li
                key={row.id}
                data-source-type="approval"
                data-source-id={row.id}
                className="px-4 py-3"
              >
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => {
                    setReview(row);
                    setError("");
                    router.push(`/admin/work?tab=approvals&action=${row.id}`, "preserve");
                  }}
                  className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
                >
                  <span>
                    <span className="block text-sm font-semibold text-[var(--admin-ink)]">
                      {row.title}
                    </span>
                    <span className="mt-1 block text-xs text-[var(--admin-muted)]">
                      {row.reasoning || row.description || "Review the exact proposed change."}
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0" />
                </button>
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
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--admin-ink)] px-4 text-sm font-semibold text-[var(--admin-surface)] disabled:opacity-50"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}Save changes
            </button>
          </div>
        </form>
      </AdminDialog>
    </div>
  );
}
