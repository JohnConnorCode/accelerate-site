"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchJson } from "@/lib/admin/fetchJson";
import { useAdminAI } from "./AdminAIProvider";

interface BlueprintDetail {
  blueprintId: string;
  version: number;
  document: { businessSummary?: string };
}

export function ArchitectBlueprintReviewHost() {
  const ai = useAdminAI();
  const blueprintId = ai.blueprintDraftId;
  const [loadError, setLoadError] = useState("");
  const lastUserProposal = useMemo(() => {
    const last = [...ai.messages].reverse().find((message) => message.role === "user");
    return last?.content ?? "";
  }, [ai.messages]);

  if (!blueprintId) {
    return (
      <section className="mx-auto mb-4 max-w-xl rounded-2xl border border-[var(--admin-border)] p-3 sm:p-4">
        <h3 className="text-sm font-semibold text-[var(--admin-ink)]">Blueprint review</h3>
        <p className="admin-copy mt-1 text-xs">
          This Architect session has no Blueprint yet. Continue the chat until a draft is attached.
        </p>
      </section>
    );
  }

  return (
    <ArchitectBlueprintReview
      blueprintId={blueprintId}
      defaultProposal={lastUserProposal}
      loadError={loadError}
      onLoadError={setLoadError}
    />
  );
}

export function ArchitectBlueprintReview({
  blueprintId,
  defaultProposal = "",
  loadError = "",
  onLoadError,
}: {
  blueprintId: string;
  defaultProposal?: string;
  loadError?: string;
  onLoadError?: (message: string) => void;
}) {
  const [detail, setDetail] = useState<BlueprintDetail | null>(null);
  const [proposal, setProposal] = useState(defaultProposal);
  const [summary, setSummary] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const payload = await fetchJson<BlueprintDetail>(`/api/admin/blueprints/${blueprintId}`);
      setDetail(payload);
      onLoadError?.("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load Blueprint";
      setDetail(null);
      onLoadError?.(message);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blueprintId]);

  useEffect(() => {
    if (defaultProposal && !proposal) setProposal(defaultProposal);
  }, [defaultProposal, proposal]);

  async function run(path: "simulate" | "patch", preview = false) {
    setBusy(true);
    setResult("");
    try {
      const body =
        path === "simulate"
          ? { event: "opportunity.stage -> won" }
          : {
              proposal,
              changeSummary: summary || "Chat patch",
              expectedVersion: detail?.version ?? 0,
              preview,
            };
      const payload = await fetchJson(`/api/admin/blueprints/${blueprintId}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      setResult(JSON.stringify(payload, null, 2));
      if (path === "patch" && !preview) await load();
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto mb-4 max-w-xl rounded-2xl border border-[var(--admin-border)] p-3 sm:p-4">
      <h3 className="text-sm font-semibold text-[var(--admin-ink)]">Blueprint review</h3>
      <p className="admin-copy mt-1 text-xs">
        Simulate without writes. Preview the diff, then save a new version. Apply stays on the
        Blueprint page.
      </p>
      {loadError ? (
        <p className="mt-2 text-xs text-rose-700 dark:text-rose-300" role="alert">
          {loadError}
          <button type="button" className="ml-2 min-h-11 underline" onClick={() => void load()}>
            Retry
          </button>
        </p>
      ) : null}
      {detail ? (
        <p className="admin-copy mt-2 text-xs">
          Version {detail.version}: {detail.document.businessSummary}
        </p>
      ) : null}
      <label className="mt-3 block text-xs font-medium text-[var(--admin-ink)]">
        Change summary
        <input
          className="mt-1 min-h-11 w-full rounded-xl px-3 text-sm"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
        />
      </label>
      <label className="mt-3 block text-xs font-medium text-[var(--admin-ink)]">
        Conversational proposal
        <textarea
          className="mt-1 min-h-24 w-full rounded-xl p-3 text-xs"
          value={proposal}
          onChange={(event) => setProposal(event.target.value)}
          placeholder="Set the business summary to …"
        />
      </label>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          className="min-h-11 rounded-xl px-4 text-sm font-semibold"
          disabled={busy}
          onClick={() => void run("simulate")}
        >
          Simulate
        </button>
        <button
          type="button"
          className="min-h-11 rounded-xl px-4 text-sm font-semibold"
          disabled={busy || !detail}
          onClick={() => void run("patch", true)}
        >
          Preview patch
        </button>
        <button
          type="button"
          className="min-h-11 rounded-xl px-4 text-sm font-semibold"
          disabled={busy || !detail}
          onClick={() => void run("patch")}
        >
          Save patch
        </button>
      </div>
      {result ? (
        <pre className="mt-3 max-h-40 overflow-auto rounded-xl p-3 font-mono text-[11px]">
          {result}
        </pre>
      ) : null}
    </section>
  );
}
