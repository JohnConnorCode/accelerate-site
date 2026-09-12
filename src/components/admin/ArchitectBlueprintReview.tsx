"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/admin/fetchJson";

export function ArchitectBlueprintReviewHost() {
  const [blueprintId, setBlueprintId] = useState<string | null>(null);
  useEffect(() => {
    void fetchJson<{ blueprints?: Array<{ id: string }> }>("/api/admin/blueprints")
      .then((payload) => {
        setBlueprintId(payload.blueprints?.[0]?.id ?? null);
      })
      .catch(() => setBlueprintId(null));
  }, []);
  if (!blueprintId) return null;
  return <ArchitectBlueprintReview blueprintId={blueprintId} />;
}

export function ArchitectBlueprintReview({ blueprintId }: { blueprintId: string }) {
  const [summary, setSummary] = useState("");
  const [patch, setPatch] = useState('{"businessSummary":""}');
  const [result, setResult] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function run(path: "simulate" | "patch") {
    setBusy(true);
    setResult("");
    try {
      const body =
        path === "simulate"
          ? undefined
          : {
              patch: JSON.parse(patch) as Record<string, unknown>,
              changeSummary: summary || "Chat patch",
            };
      const payload = await fetchJson(`/api/admin/blueprints/${blueprintId}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : "{}",
      });
      setResult(JSON.stringify(payload, null, 2));
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
        Simulate without writes. Patches save a new version. Apply stays on the Blueprint page.
      </p>
      <label className="mt-3 block text-xs font-medium text-[var(--admin-ink)]">
        Change summary
        <input
          className="mt-1 min-h-11 w-full rounded-xl px-3 text-sm"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
        />
      </label>
      <label className="mt-3 block text-xs font-medium text-[var(--admin-ink)]">
        Conversational patch
        <textarea
          className="mt-1 min-h-24 w-full rounded-xl p-3 font-mono text-xs"
          value={patch}
          onChange={(event) => setPatch(event.target.value)}
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
          disabled={busy}
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
