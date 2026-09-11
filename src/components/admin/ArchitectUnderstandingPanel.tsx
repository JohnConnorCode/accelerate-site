"use client";

import { useState } from "react";
import { CircleAlert, ListTree } from "lucide-react";
import { useAdminAI } from "./AdminAIProvider";

interface Understanding {
  statements: Array<{
    id: string;
    kind: string;
    concept: string;
    text: string;
    resolution: string;
    existingKey?: string;
  }>;
  conflicts: Array<{ id: string; concept: string; statements: string[] }>;
  questions: Array<{
    id: string;
    question: string;
    why: string;
    impact: string;
    rank: number;
    proposedAssumption?: string;
  }>;
  resolvedPrimitives: string[];
  proposedConcepts: string[];
}

export function ArchitectUnderstandingPanel() {
  const ai = useAdminAI();
  const [model, setModel] = useState<Understanding | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const extract = async () => {
    if (!ai.activeConversationId) {
      setError("Start or open a session before extracting a business model.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/revenue-os/ai/conversations/${encodeURIComponent(ai.activeConversationId)}/understanding`,
        { method: "POST" },
      );
      const payload = (await response.json().catch(() => null)) as {
        understanding?: Understanding;
        error?: string;
      } | null;
      if (!response.ok || !payload?.understanding)
        throw new Error(payload?.error || "Could not extract business model");
      setModel(payload.understanding);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not extract business model");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-b border-[var(--admin-border)] px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="admin-eyebrow">Business model reading</p>
        <button
          type="button"
          onClick={() => void extract()}
          disabled={busy || ai.schemaReady === false}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[var(--admin-ink)] hover:bg-black/[0.04] disabled:opacity-40 dark:hover:bg-white/[0.05]"
        >
          <ListTree className="size-3.5" />
          {busy ? "Reading…" : "Read the session"}
        </button>
      </div>
      <p className="mt-1 text-[11px] text-[var(--admin-muted)]">
        This is a structured reading of evidence. It does not create records, schema or settings.
      </p>
      {error && (
        <p className="mt-2 rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-700" role="alert">
          {error}
        </p>
      )}
      {model && (
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted)]">
              Statements
            </h3>
            <ul className="mt-2 space-y-2">
              {model.statements.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl bg-black/[0.035] px-3 py-2 text-xs dark:bg-white/[0.05]"
                >
                  <p className="font-semibold text-[var(--admin-ink)]">
                    {item.concept} · {item.kind} · {item.resolution}
                  </p>
                  <p className="mt-1 text-[var(--admin-ink)]">{item.text}</p>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted)]">
              Conflicts
            </h3>
            {model.conflicts.length === 0 ? (
              <p className="mt-2 text-xs text-[var(--admin-muted)]">None in this reading.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {model.conflicts.map((item) => (
                  <li key={item.id} className="rounded-xl bg-amber-500/[0.08] px-3 py-2 text-xs">
                    <p className="inline-flex items-center gap-1 font-semibold text-[var(--admin-ink)]">
                      <CircleAlert className="size-3.5" />
                      {item.concept}
                    </p>
                    {item.statements.map((statement) => (
                      <p key={statement} className="mt-1 text-[var(--admin-ink)]">
                        {statement}
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted)]">
              Questions
            </h3>
            <ul className="mt-2 space-y-2">
              {model.questions.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl bg-black/[0.035] px-3 py-2 text-xs dark:bg-white/[0.05]"
                >
                  <p className="font-semibold text-[var(--admin-ink)]">{item.question}</p>
                  <p className="mt-1 text-[var(--admin-muted)]">
                    {item.impact} · {item.why}
                  </p>
                  {item.proposedAssumption && (
                    <p className="mt-1 text-[var(--admin-ink)]">
                      Safe assumption: {item.proposedAssumption}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
