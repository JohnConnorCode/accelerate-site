"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminSurface } from "./AdminSurface";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface MemoryRow {
  id: string;
  coworker_id: string | null;
  agent_run_id: string | null;
  category: "prior_work" | "prior_research" | "scheduled_check" | "unresolved_question";
  subject: string;
  body: string;
  entity_type: string | null;
  entity_id: string | null;
  relevance_horizon: "session" | "daily" | "weekly" | "permanent";
  created_at: string;
  expires_at: string | null;
}

const categories: Array<{ id: MemoryRow["category"] | ""; label: string }> = [
  { id: "", label: "All" },
  { id: "prior_work", label: "Prior work" },
  { id: "prior_research", label: "Research" },
  { id: "scheduled_check", label: "Scheduled checks" },
  { id: "unresolved_question", label: "Open questions" },
];

const horizonLabel: Record<MemoryRow["relevance_horizon"], string> = {
  session: "a few hours",
  daily: "a day",
  weekly: "a week",
  permanent: "until removed",
};

/** What agents currently remember, where each memory came from, and the
 * founder's controls to correct or remove it. */
export function AgentMemoryReview() {
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [category, setCategory] = useState<MemoryRow["category"] | "">("");
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; subject: string; body: string } | null>(
    null,
  );
  const [confirmForget, setConfirmForget] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (search.trim()) params.set("q", search.trim());
      const response = await fetch(`/api/admin/memory?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMemories(data.memories);
      setError(null);
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Memory could not be loaded");
    }
  }, [category, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(timer);
  }, [load]);

  const mutate = async (id: string, request: RequestInit, done: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/memory/${encodeURIComponent(id)}`, request);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setNotice(done);
      setEditing(null);
      setConfirmForget(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Memory change failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminSurface padding="lg">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-balance text-lg font-semibold">What your AI remembers</h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--admin-muted)]">
            Notes agents keep between runs. Correct anything that is wrong or remove it; every
            change is recorded. Each run&apos;s trace lists the memories it used.
          </p>
        </div>
        <Button variant="ghost" onClick={() => void load()} disabled={busy}>
          Refresh
        </Button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {categories.map((option) => (
          <button
            key={option.id || "all"}
            type="button"
            onClick={() => setCategory(option.id)}
            aria-pressed={category === option.id}
            className={`min-h-10 rounded-xl px-3 text-sm font-medium shadow-[var(--admin-shadow-border)] ${
              category === option.id ? "bg-black/[0.06] dark:bg-white/[0.08]" : ""
            }`}
          >
            {option.label}
          </button>
        ))}
        <div className="min-w-[12rem] flex-1">
          <label className="sr-only" htmlFor="memory-search">
            Search memory
          </label>
          <Input
            id="memory-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search memory"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-[var(--admin-danger)]">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 text-sm">
          {notice}
        </p>
      )}
      {loaded && !memories.length && (
        <p className="mt-5 text-sm text-[var(--admin-muted)]">
          Nothing matches. Agents add memories as they finish work.
        </p>
      )}

      {!!memories.length && (
        <ul className="mt-5 divide-y divide-[var(--admin-border)]">
          {memories.map((memory) => (
            <li key={memory.id} className="py-4">
              {editing?.id === memory.id ? (
                <form
                  className="space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void mutate(
                      memory.id,
                      {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ subject: editing.subject, body: editing.body }),
                      },
                      "Memory corrected. Future runs will use the new text.",
                    );
                  }}
                >
                  <label className="block text-sm font-medium" htmlFor={`subject-${memory.id}`}>
                    Subject
                  </label>
                  <Input
                    id={`subject-${memory.id}`}
                    value={editing.subject}
                    maxLength={240}
                    onChange={(event) => setEditing({ ...editing, subject: event.target.value })}
                  />
                  <label className="block text-sm font-medium" htmlFor={`body-${memory.id}`}>
                    What the agent remembers
                  </label>
                  <textarea
                    id={`body-${memory.id}`}
                    value={editing.body}
                    maxLength={8000}
                    rows={5}
                    onChange={(event) => setEditing({ ...editing, body: event.target.value })}
                    className="w-full rounded-xl bg-transparent p-3 text-sm shadow-[var(--admin-shadow-border)]"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={busy}>
                      {busy ? "Saving…" : "Save correction"}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium">{memory.subject}</p>
                    <p className="mt-1 line-clamp-3 whitespace-pre-line break-words text-sm text-[var(--admin-muted)]">
                      {memory.body}
                    </p>
                    <p className="mt-2 text-xs text-[var(--admin-muted)]">
                      {categories.find((option) => option.id === memory.category)?.label} ·{" "}
                      {memory.coworker_id ? `${memory.coworker_id} coworker` : "workspace"} · kept
                      for {horizonLabel[memory.relevance_horizon]} ·{" "}
                      {new Date(memory.created_at).toLocaleString()}
                      {memory.agent_run_id && (
                        <>
                          {" · "}
                          <Link
                            className="underline underline-offset-2"
                            href={`/admin/ai?view=runs&run=${encodeURIComponent(memory.agent_run_id)}`}
                          >
                            Source run
                          </Link>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {confirmForget === memory.id ? (
                      <>
                        <Button
                          disabled={busy}
                          onClick={() =>
                            void mutate(
                              memory.id,
                              { method: "DELETE" },
                              "Memory removed. No future run will see it.",
                            )
                          }
                        >
                          Confirm remove
                        </Button>
                        <Button variant="ghost" onClick={() => setConfirmForget(null)}>
                          Keep
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          disabled={busy}
                          onClick={() =>
                            setEditing({
                              id: memory.id,
                              subject: memory.subject,
                              body: memory.body,
                            })
                          }
                        >
                          Correct
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={busy}
                          onClick={() => setConfirmForget(memory.id)}
                        >
                          Remove
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </AdminSurface>
  );
}
