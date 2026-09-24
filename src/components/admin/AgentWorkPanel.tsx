"use client";

import { useState } from "react";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { fetchJson } from "@/lib/admin/fetchJson";

type AgentItem = {
  id: string;
  kind: string;
  objective: string;
  reason: string;
  source: string;
  status: string;
  priority: string;
  next_check_at: string | null;
  next_check_reason: string | null;
  outcome: string | null;
  error: string | null;
  agent_run_id: string | null;
  created_at: string;
};

export function AgentWorkPanel() {
  const [status, setStatus] = useState("active");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AgentItem[]>([]);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const query = useAdminQuery<{ items: AgentItem[]; total: number }>(
    ["work", "agent-items", status, page],
    `/api/admin/work/agent-items?status=${status}&page=${page}`,
  );
  const rows =
    page === 1
      ? (query.data?.items ?? [])
      : [...items, ...(query.data?.items ?? [])].filter(
          (item, index, all) => all.findIndex((other) => other.id === item.id) === index,
        );
  const loadMore = () => {
    setItems(rows);
    setPage(page + 1);
  };
  const rate = async (item: AgentItem, rating: "helpful" | "not_helpful") => {
    setError("");
    try {
      await fetchJson("/api/admin/revenue-os/ai/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: item.agent_run_id, rating }),
      });
      setFeedback({ ...feedback, [item.id]: rating });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Feedback could not be saved");
    }
  };
  return (
    <div className="space-y-3">
      <p className="admin-copy text-sm">
        AI work has its own status and outcome. Actions that affect customers still appear under
        Approvals.
      </p>
      <label className="text-sm font-medium">
        Show AI work
        <select
          className="admin-field ml-2"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
            setItems([]);
          }}
        >
          <option value="active">Active and needs attention</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="all">All</option>
        </select>
      </label>
      {(error || query.error) && (
        <p role="alert" className="text-sm text-[var(--admin-danger)]">
          {error || query.error?.message}
        </p>
      )}
      <AdminSurface padding="none">
        <div className="divide-y divide-[var(--admin-border)]">
          {rows.map((item) => (
            <article key={item.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">{item.objective}</h3>
                  <p className="admin-copy mt-1 text-xs">
                    {item.kind.replaceAll("_", " ")} · {item.source} · {item.priority}
                  </p>
                </div>
                <span className="text-xs font-semibold">{item.status.replaceAll("_", " ")}</span>
              </div>
              <p className="admin-copy mt-2 text-sm">{item.outcome || item.error || item.reason}</p>
              {item.next_check_at && (
                <p className="admin-copy mt-1 text-xs">
                  Next check {new Date(item.next_check_at).toLocaleString()}
                  {item.next_check_reason ? ` · ${item.next_check_reason}` : ""}
                </p>
              )}
              {item.status === "completed" && item.agent_run_id && (
                <div className="mt-3 flex gap-2">
                  {feedback[item.id] ? (
                    <p role="status" className="text-xs">
                      Feedback recorded: {(feedback[item.id] ?? "").replaceAll("_", " ")}
                    </p>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="admin-button admin-button--secondary"
                        onClick={() => void rate(item, "helpful")}
                      >
                        Helpful
                      </button>
                      <button
                        type="button"
                        className="admin-button admin-button--secondary"
                        onClick={() => void rate(item, "not_helpful")}
                      >
                        Needs work
                      </button>
                    </>
                  )}
                </div>
              )}
            </article>
          ))}
          {!rows.length && (
            <p className="p-5 text-sm text-[var(--admin-muted)]">
              {query.isPending ? "Loading AI work…" : "No AI work in this view."}
            </p>
          )}
        </div>
      </AdminSurface>
      <div className="flex items-center justify-between text-xs text-[var(--admin-muted)]">
        <span>
          Showing {rows.length} of {query.data?.total ?? rows.length}
        </span>
        <button
          type="button"
          className="admin-button admin-button--secondary"
          disabled={query.isFetching || rows.length >= (query.data?.total ?? 0)}
          onClick={loadMore}
        >
          Load more
        </button>
      </div>
    </div>
  );
}
