"use client";

import { useMemo, useState } from "react";
import { AlarmClock, CheckCircle2, FileCheck, ListChecks, Loader2, RefreshCw } from "lucide-react";
import AdminLink from "@/components/admin/AdminLink";
import { AdminReadBody } from "@/components/admin/AdminReadBody";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { PageHeader } from "@/components/admin/PageHeader";
import { fetchJson } from "@/lib/admin/fetchJson";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";

type QueueItem = {
  id: string;
  kind: "reply" | "task" | "follow_up" | "proposal" | "meeting" | "approval" | "system";
  title: string;
  summary: string;
  urgency: "critical" | "high" | "normal" | "low";
  dueAt: string | null;
  priorityReason: string;
  href: string;
};
type Overview = { queue: QueueItem[]; schemaReady: boolean };
type Action = {
  id: string;
  title: string;
  description: string | null;
  reasoning: string | null;
  status: string;
  action_type: string;
  created_at: string;
};

const button =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold shadow-[var(--admin-shadow-border)] transition-[box-shadow,transform,background-color] duration-150 hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50";

function dueLabel(value: string | null) {
  if (!value) return "No due date";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const days = Math.round(
      (Date.parse(`${value}T00:00:00Z`) -
        Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)) /
        86400000,
    );
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return "Due today";
    if (days === 1) return "Due tomorrow";
    return `Due in ${days}d`;
  }
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function WorkPage() {
  const [view, setView] = useState<"tasks" | "approvals">("tasks");
  const [acting, setActing] = useState<string | null>(null);
  const overview = useAdminQuery<Overview>(
    ["admin", "work", "overview"],
    "/api/admin/revenue-os/overview",
  );
  const actions = useAdminQuery<{ actions: Action[] }>(
    ["admin", "work", "approvals"],
    "/api/admin/revenue-os/actions",
  );
  const tasks = useMemo(
    () => (overview.data?.queue ?? []).filter((item) => ["task", "follow_up"].includes(item.kind)),
    [overview.data?.queue],
  );
  const approvals = useMemo(
    () => actions.data?.actions.filter((item) => item.status === "pending") ?? [],
    [actions.data?.actions],
  );
  const refresh = async () => {
    await Promise.all([overview.refetch(), actions.refetch()]);
  };
  const updateTask = async (id: string, action: "complete" | "snooze") => {
    setActing(`${id}:${action}`);
    try {
      await fetchJson("/api/admin/revenue-os/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action,
          ...(action === "snooze"
            ? { until: new Date(Date.now() + 86400000).toISOString().slice(0, 10) }
            : {}),
        }),
      });
      await overview.refetch();
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Tasks"
        subtitle="One home for work that has an owner, due date, or completion state. Approvals stay decisions, with the same source record visible from Today."
        utilityActions={
          <button
            type="button"
            onClick={() => void refresh()}
            className="admin-icon-button"
            aria-label="Refresh work"
          >
            <RefreshCw
              className={
                overview.isFetching || actions.isFetching ? "size-3.5 animate-spin" : "size-3.5"
              }
            />
          </button>
        }
      />
      <AdminSurface padding="none" className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] px-4 py-3 sm:px-5">
          <div className="flex gap-1" role="tablist" aria-label="Work type">
            {(["tasks", "approvals"] as const).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={view === item}
                onClick={() => setView(item)}
                className={`${button} min-h-10 shadow-none ${view === item ? "bg-[var(--admin-ink)] text-[var(--admin-surface)]" : "text-[var(--admin-muted)] hover:bg-[var(--admin-surface-subtle)]"}`}
              >
                {item === "tasks" ? (
                  <ListChecks className="size-3.5" />
                ) : (
                  <FileCheck className="size-3.5" />
                )}
                {item === "tasks" ? "Tasks" : "Approvals"}
                <span className="font-mono tabular-nums">
                  {item === "tasks" ? tasks.length : approvals.length}
                </span>
              </button>
            ))}
          </div>
          <AdminLink
            href="/admin/today"
            className="text-xs font-semibold underline underline-offset-4"
          >
            See Today’s priorities
          </AdminLink>
        </div>
        <AdminReadBody
          loading={overview.isPending || actions.isPending}
          hasData={Boolean(overview.data || actions.data)}
          error={overview.error?.message || actions.error?.message}
          onRetry={() => void refresh()}
          refreshing={overview.isFetching || actions.isFetching}
          loadingFallback={<LoadingSkeleton variant="table" />}
          label="Loading work"
        >
          {view === "tasks" ? (
            <div className="divide-y divide-[var(--admin-border)]">
              {tasks.map((task) => {
                const taskId = task.id.replace(/^task:/, "");
                return (
                  <div key={task.id} className="flex items-start gap-3 px-4 py-4 sm:px-5">
                    <button
                      type="button"
                      aria-label={`Complete ${task.title}`}
                      className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-lg text-emerald-700 transition-colors hover:bg-emerald-500/10 dark:text-emerald-300"
                      disabled={Boolean(acting)}
                      onClick={() => void updateTask(taskId, "complete")}
                    >
                      {acting === `${taskId}:complete` ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-4" />
                      )}
                    </button>
                    <AdminLink
                      href={task.href}
                      className="min-w-0 flex-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-ink)]"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold text-[var(--admin-ink)]">
                          {task.title}
                        </h2>
                        {task.urgency !== "normal" && (
                          <span className="rounded-full bg-amber-500/12 px-2 py-0.5 text-[9px] font-semibold uppercase text-amber-800 dark:text-amber-300">
                            {task.urgency}
                          </span>
                        )}
                      </div>
                      <p className="admin-copy mt-1 text-xs leading-5">{task.summary}</p>
                      <p className="mt-2 text-[11px] font-medium text-[var(--admin-muted)]">
                        {task.kind === "meeting" ? "Upcoming context" : "Human work"} ·{" "}
                        {dueLabel(task.dueAt)}
                      </p>
                    </AdminLink>
                    <button
                      type="button"
                      aria-label={`Snooze ${task.title} until tomorrow`}
                      className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-lg text-[var(--admin-muted)] hover:bg-[var(--admin-surface-subtle)]"
                      disabled={Boolean(acting)}
                      onClick={() => void updateTask(taskId, "snooze")}
                    >
                      {acting === `${taskId}:snooze` ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <AlarmClock className="size-4" />
                      )}
                    </button>
                  </div>
                );
              })}
              {!tasks.length && (
                <EmptyState
                  title="No open tasks"
                  description="When a person needs to do something, it will appear here with its owner and due date."
                />
              )}
            </div>
          ) : (
            <div className="divide-y divide-[var(--admin-border)]">
              {approvals.map((approval) => (
                <div key={approval.id} className="flex items-start gap-3 px-4 py-4 sm:px-5">
                  <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300">
                    <FileCheck className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold text-[var(--admin-ink)]">
                      {approval.title}
                    </h2>
                    <p className="admin-copy mt-1 text-xs leading-5">
                      {approval.description ||
                        approval.reasoning ||
                        "A proposed change is waiting for your decision."}
                    </p>
                    <p className="mt-2 text-[11px] text-[var(--admin-muted)]">
                      {approval.action_type.replace(/_/g, " ")} ·{" "}
                      {new Date(approval.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <AdminLink
                    href={`/admin/today?focus=approval&action=${encodeURIComponent(approval.id)}`}
                    className={`${button} shrink-0 bg-[var(--admin-ink)] text-[var(--admin-surface)]`}
                  >
                    Review
                  </AdminLink>
                </div>
              ))}
              {!approvals.length && (
                <EmptyState
                  title="No approvals waiting"
                  description="Proposed sends and changes will stay here until you review them."
                />
              )}
            </div>
          )}
        </AdminReadBody>
      </AdminSurface>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="px-6 py-14 text-center">
      <CheckCircle2 className="mx-auto size-5 text-emerald-600" />
      <h2 className="mt-3 text-sm font-semibold text-[var(--admin-ink)]">{title}</h2>
      <p className="admin-copy mx-auto mt-1 max-w-md text-xs">{description}</p>
    </div>
  );
}
