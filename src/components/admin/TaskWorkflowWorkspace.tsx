"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "./PageHeader";
import { AdminSurface } from "./AdminSurface";
import AdminLink from "./AdminLink";
import { useAdminDemo } from "./AdminDemoBoundary";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { fetchJson } from "@/lib/admin/fetchJson";
import type { WorkflowPreview } from "@/lib/revenue-os/workflow-plugins";
const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-[var(--admin-shadow-border)] active:scale-[.96] disabled:opacity-50 disabled:cursor-not-allowed";
const field =
  "mt-2 min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-ink)]";
type Task = { title: string; description: string; dueDate: string; assigneeUserId: string };
type Workspace = {
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
  const demo = useAdminDemo(),
    onboarding = pluginId === "client-onboarding";
  const query = useAdminQuery<Workspace>(
    ["admin", "task-workflow", pluginId],
    `/api/admin/plugins/tasks?pluginId=${pluginId}`,
    { enabled: !demo },
  );
  const [sourceId, setSourceId] = useState(""),
    [tasks, setTasks] = useState<Task[]>([]),
    [preview, setPreview] = useState<WorkflowPreview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [requestId, setRequestId] = useState("");
  const input = () => ({ [onboarding ? "opportunityId" : "meetingId"]: sourceId, tasks });
  function edit(next: Task[]) {
    setTasks(next);
    setPreview(null);
    setNotice("");
  }
  function choose(id: string) {
    setSourceId(id);
    const titles = onboarding
      ? [
          "Confirm delivery scope and success criteria",
          "Collect access and customer materials",
          "Schedule the project kickoff",
          "Share the delivery plan",
        ]
      : [""];
    edit(
      titles.map((title, index) => ({
        title,
        description: "",
        dueDate: new Date(Date.now() + (index + 1) * 86400000).toISOString().slice(0, 10),
        assigneeUserId: query.data?.currentUserId || "",
      })),
    );
  }
  async function perform(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Workflow failed");
    } finally {
      await query.refetch();
      setBusy(false);
    }
  }
  async function decide(id: string, decision: string) {
    await fetchJson("/api/admin/revenue-os/actions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, decision }),
    });
    setNotice(
      decision === "approve"
        ? "Tasks created. Inspect the linked results below."
        : decision === "retry"
          ? "The same workflow is ready for review again."
          : "Workflow rejected.",
    );
  }
  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title={onboarding ? "Client onboarding" : "Meeting commitments"}
        subtitle={
          onboarding
            ? "Start delivery with clear owners, dates, and an agreed checklist."
            : "Turn the commitments you reviewed into owned, dated follow-ups."
        }
        actions={
          <AdminLink className={button} href="/admin/plugins">
            Manage plugins
          </AdminLink>
        }
      />
      {demo ? (
        <AdminSurface padding="lg">
          This fictional workspace does not create operational tasks.
        </AdminSurface>
      ) : (
        <>
          {(error || query.error) && (
            <p role="alert" className="rounded-xl border border-red-500/30 p-4 text-sm">
              {error || query.error?.message}
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
                    {query.data?.records.map((record) => (
                      <option key={record.id} value={record.id}>
                        {record.name || record.title}
                      </option>
                    ))}
                  </select>
                </label>
                {query.data?.truncated && (
                  <p className="admin-copy text-xs">
                    Showing the most recent 100 source records and up to 100 workspace members.
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
                                i === index
                                  ? { ...item, assigneeUserId: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        >
                          <option value="">Assign a workspace member</option>
                          {query.data?.members.map((member) => (
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
                            assigneeUserId: query.data?.currentUserId || "",
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
            {preview && (
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
            {!query.data?.actions.length && (
              <p className="admin-copy mt-4 text-sm">No workflow runs yet.</p>
            )}
            {query.data?.actions.map((action) => (
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
                            {query.data?.taskStates?.[task.id] || "Status unavailable"}
                          </p>
                          {query.data?.taskStates?.[task.id] &&
                            query.data.taskStates[task.id] !== "completed" && (
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
                                    setNotice("Task marked complete.");
                                  })
                                }
                              >
                                Mark complete
                              </button>
                            )}
                          <p className="admin-copy text-xs">
                            Due {task.dueDate} ·{" "}
                            {query.data?.members.find(
                              (member) => member.user_id === task.assigneeUserId,
                            )?.invited_email || "Workspace member"}
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
      )}
    </div>
  );
}
