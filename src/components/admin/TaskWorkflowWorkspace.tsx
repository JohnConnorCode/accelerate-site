"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminReadBody } from "./AdminReadBody";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "./PageHeader";
import { AdminSurface } from "./AdminSurface";
import AdminLink from "./AdminLink";
import { DemoBusinessNotice } from "./DemoBusinessNotice";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { fetchJson } from "@/lib/admin/fetchJson";
import type { WorkflowPreview } from "@/lib/revenue-os/workflow-plugins";
const button = "admin-button admin-button--secondary";
const field = "admin-field mt-2";
type Task = { title: string; description: string; dueDate: string; assigneeUserId: string };
type Workspace = {
  suggestedTasks?: string[];
  taskStates: Record<string, string>;
  records: { id: string; name?: string; title?: string }[];
  members: { user_id: string; invited_email: string }[];
  currentUserId: string;
  truncated: boolean;
  actions: {
    id: string;
    title: string;
    description: string;
    status: string;
    error: string | null;
    result: { complete: boolean; tasks: (Task & { id: string })[] } | null;
  }[];
};
export function TaskWorkflowWorkspace({
  pluginId,
}: {
  pluginId: "client-onboarding" | "meeting-commitments";
}) {
  const params = useSearchParams();
  const sourceId =
    params.get(pluginId === "client-onboarding" ? "opportunityId" : "meetingId") || "";
  const query = useAdminQuery<Workspace>(
    ["admin", "task-workflow", pluginId, sourceId],
    `/api/admin/plugins/tasks?${new URLSearchParams({ pluginId, ...(sourceId ? { sourceId } : {}) })}`,
    { placeholderData: undefined },
  );
  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title={pluginId === "client-onboarding" ? "Client onboarding" : "Meeting commitments"}
        subtitle={
          pluginId === "client-onboarding"
            ? "Create assigned kickoff tasks for a won opportunity."
            : "Turn the commitments you reviewed into owned, dated follow-ups."
        }
        actions={
          <AdminLink className={button} href="/admin/plugins">
            Apps & connections
          </AdminLink>
        }
      />
      <DemoBusinessNotice />
      {sourceId && query.error && (
        <AdminLink className={button} href={`/admin/${pluginId}`}>
          Choose another source
        </AdminLink>
      )}
      <AdminReadBody
        loading={query.isPending}
        hasData={Boolean(query.data)}
        error={query.error?.message}
        refreshing={query.isFetching}
        onRetry={() => void query.refetch()}
        loadingFallback={<LoadingSkeleton />}
      >
        {query.data && (
          <TaskWorkflowForm
            key={`${pluginId}:${sourceId}`}
            pluginId={pluginId}
            initialSourceId={sourceId}
            workspace={query.data}
            refetch={() => query.refetch()}
          />
        )}
      </AdminReadBody>
    </div>
  );
}

function TaskWorkflowForm({
  pluginId,
  initialSourceId,
  workspace,
  refetch,
}: {
  pluginId: "client-onboarding" | "meeting-commitments";
  initialSourceId: string;
  workspace: Workspace;
  refetch: () => Promise<unknown>;
}) {
  const onboarding = pluginId === "client-onboarding";
  const initialSource = workspace.records.find((record) => record.id === initialSourceId);
  function starterTasks(): Task[] {
    const titles =
      workspace.suggestedTasks ??
      (onboarding
        ? [
            "Confirm delivery scope and success criteria",
            "Collect access and customer materials",
            "Schedule the project kickoff",
            "Share the delivery plan",
          ]
        : [""]);
    return titles.map((title, index) => ({
      title,
      description: "",
      dueDate: new Date(Date.now() + (index + 1) * 86400000).toISOString().slice(0, 10),
      assigneeUserId: workspace.currentUserId,
    }));
  }
  const [sourceId, setSourceId] = useState(initialSource?.id ?? ""),
    [tasks, setTasks] = useState<Task[]>(() => (initialSource ? starterTasks() : [])),
    [preview, setPreview] = useState<WorkflowPreview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [requestId, setRequestId] = useState("");
  const selectedSource = workspace.records.find((record) => record.id === sourceId);
  const sourceUnavailable =
    (Boolean(initialSourceId) && !initialSource && !sourceId) ||
    (Boolean(sourceId) && !selectedSource);
  const input = () => ({ [onboarding ? "opportunityId" : "meetingId"]: sourceId, tasks });
  function edit(next: Task[]) {
    setTasks(next);
    setPreview(null);
    setNotice("");
  }
  function choose(id: string) {
    setSourceId(id);
    edit(id ? starterTasks() : []);
  }

  async function perform(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Workflow failed");
    } finally {
      await refetch();
      setBusy(false);
    }
  }
  async function decide(id: string, decision: string) {
    await fetchJson("/api/admin/revenue-os/actions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, decision }),
    });
    window.dispatchEvent(new Event("admin:priority-refresh"));
    setNotice(
      decision === "approve"
        ? "Tasks created. Inspect the linked results below."
        : decision === "retry"
          ? "The same workflow is ready for review again."
          : "Workflow rejected.",
    );
  }
  return (
    <>
      {error && (
        <p role="alert" className="rounded-xl border border-[var(--admin-danger)]/30 p-4 text-sm">
          {error}
        </p>
      )}
      {sourceUnavailable && (
        <p role="alert" className="admin-copy text-sm">
          {onboarding
            ? "The linked opportunity is unavailable or is no longer won."
            : "The linked meeting is unavailable or was cancelled."}{" "}
          Choose another source below.
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      <AdminSurface padding="lg">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void perform(async () => {
              const result = await fetchJson<WorkflowPreview>("/api/admin/plugins/workflow", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pluginId, mode: "preview", input: input() }),
              });
              setPreview(result);
              setRequestId(crypto.randomUUID());
            });
          }}
        >
          <fieldset disabled={busy} className="space-y-5">
            <legend className="sr-only">Review workflow tasks</legend>
            <label className="block text-sm font-medium">
              {onboarding ? "Won opportunity" : "Stored meeting"}
              <select
                className={field}
                required
                aria-label={onboarding ? "Won opportunity" : "Stored meeting"}
                value={sourceId}
                onChange={(event) => choose(event.target.value)}
              >
                <option value="">Choose a source record</option>
                {workspace.records.map((record) => (
                  <option key={record.id} value={record.id}>
                    {record.name || record.title}
                  </option>
                ))}
              </select>
            </label>
            {onboarding && selectedSource && (
              <AdminLink className={button} href={`/admin/pipeline/${sourceId}`}>
                Open opportunity
              </AdminLink>
            )}
            {workspace.truncated && (
              <p className="admin-copy text-xs">
                Showing up to 100 source records and 100 workspace members.
              </p>
            )}
            {tasks.map((task, index) => (
              <div key={index} className="rounded-xl border border-[var(--admin-border)] p-4">
                <label className="block text-sm font-medium">
                  Task {index + 1}
                  <input
                    required
                    maxLength={200}
                    className={field}
                    value={task.title}
                    onChange={(event) =>
                      edit(
                        tasks.map((item, i) =>
                          i === index ? { ...item, title: event.target.value } : item,
                        ),
                      )
                    }
                  />
                </label>
                <label className="mt-3 block text-xs font-medium">
                  Commitment details
                  <textarea
                    maxLength={2000}
                    rows={2}
                    className={field}
                    value={task.description}
                    onChange={(event) =>
                      edit(
                        tasks.map((item, i) =>
                          i === index ? { ...item, description: event.target.value } : item,
                        ),
                      )
                    }
                  />
                </label>
                <div className="mt-3 grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <label className="min-w-0 text-xs font-medium">
                    Due date
                    <input
                      required
                      type="date"
                      className={field}
                      value={task.dueDate}
                      onChange={(event) =>
                        edit(
                          tasks.map((item, i) =>
                            i === index ? { ...item, dueDate: event.target.value } : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="min-w-0 text-xs font-medium">
                    Assignee
                    <select
                      required
                      className={field}
                      value={task.assigneeUserId}
                      onChange={(event) =>
                        edit(
                          tasks.map((item, i) =>
                            i === index ? { ...item, assigneeUserId: event.target.value } : item,
                          ),
                        )
                      }
                    >
                      <option value="">Assign a workspace member</option>
                      {workspace.members.map((member) => (
                        <option key={member.user_id} value={member.user_id}>
                          {member.invited_email}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className={button}
                    aria-label={`Remove task ${index + 1}`}
                    disabled={tasks.length === 1}
                    onClick={() => edit(tasks.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
            {sourceId && (
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className={button}
                  disabled={tasks.length >= 10}
                  onClick={() =>
                    edit([
                      ...tasks,
                      {
                        title: "",
                        description: "",
                        dueDate: new Date().toISOString().slice(0, 10),
                        assigneeUserId: workspace.currentUserId || "",
                      },
                    ])
                  }
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Add task
                </button>
                <button
                  type="submit"
                  className={`${button} bg-[var(--admin-ink)] text-[var(--admin-surface)]`}
                >
                  Review workflow
                </button>
              </div>
            )}
          </fieldset>
        </form>
        {preview && selectedSource && (
          <div className="mt-6 border-t border-[var(--admin-border)] pt-5">
            <h2 className="font-semibold">{preview.title}</h2>
            <p className="admin-copy mt-2 text-sm">{preview.summary}</p>
            <button
              type="button"
              className={`${button} mt-4`}
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  await fetchJson("/api/admin/plugins/workflow", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      pluginId,
                      mode: "propose",
                      input: input(),
                      digest: preview.digest,
                      requestId,
                    }),
                  });
                  window.dispatchEvent(new Event("admin:priority-refresh"));
                  setPreview(null);
                  setNotice("The workflow is awaiting approval below.");
                })
              }
            >
              Request approval
            </button>
          </div>
        )}
      </AdminSurface>
      <AdminSurface padding="lg">
        <h2 className="text-lg font-semibold">Workflow history</h2>
        {!workspace.actions.length && (
          <p className="admin-copy mt-4 text-sm">No workflow runs yet.</p>
        )}
        {workspace.actions.map((action) => (
          <article
            key={action.id}
            className="mt-5 rounded-xl border border-[var(--admin-border)] p-4"
          >
            <h3 className="font-semibold">{action.title}</h3>
            <p className="admin-copy mt-2 text-sm">
              {action.description} · {action.status}
            </p>
            {action.error && (
              <p className="mt-3 text-sm" role="alert">
                {action.error}
              </p>
            )}
            {action.result && (
              <div className="mt-4">
                <p className="text-xs font-medium">
                  {action.result.complete
                    ? "Recorded task results"
                    : "Partial result · Retry preserves these tasks"}
                </p>
                <ul className="mt-2 space-y-2">
                  {action.result.tasks.map((task) => (
                    <li key={task.id} className="text-sm">
                      <p className="font-medium">{task.title}</p>
                      <p className="admin-copy mt-1 text-xs">
                        {workspace.taskStates?.[task.id] || "Status unavailable"}
                      </p>
                      {workspace.taskStates?.[task.id] &&
                        workspace.taskStates[task.id] !== "completed" && (
                          <button
                            type="button"
                            className={`${button} my-2`}
                            disabled={busy}
                            onClick={() =>
                              void perform(async () => {
                                await fetchJson("/api/admin/revenue-os/tasks", {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ id: task.id, action: "complete" }),
                                });
                                window.dispatchEvent(new Event("admin:priority-refresh"));
                                setNotice("Task marked complete.");
                              })
                            }
                          >
                            Mark complete
                          </button>
                        )}
                      <p className="admin-copy text-xs">
                        Due {task.dueDate} ·{" "}
                        {workspace.members.find((member) => member.user_id === task.assigneeUserId)
                          ?.invited_email || "Workspace member"}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {action.status === "pending" && (
                <>
                  <button
                    type="button"
                    className={button}
                    disabled={busy}
                    onClick={() => void perform(() => decide(action.id, "approve"))}
                  >
                    Approve & create tasks
                  </button>
                  <button
                    type="button"
                    className={button}
                    disabled={busy}
                    onClick={() => void perform(() => decide(action.id, "reject"))}
                  >
                    Reject
                  </button>
                </>
              )}
              {action.status === "failed" && (
                <button
                  type="button"
                  className={button}
                  disabled={busy}
                  onClick={() => void perform(() => decide(action.id, "retry"))}
                >
                  Retry same workflow for review
                </button>
              )}
            </div>
          </article>
        ))}
      </AdminSurface>
    </>
  );
}
