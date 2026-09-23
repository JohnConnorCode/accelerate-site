"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchJson } from "@/lib/admin/fetchJson";
import { useAdminAI } from "./AdminAIProvider";

interface BlueprintDetail {
  blueprintId: string;
  version: number;
  document: { businessSummary?: string };
}

interface BlueprintOption {
  id: string;
  title: string;
  latest_version: number;
}

interface ReviewResult {
  error?: string;
  kind?: string;
  preview?: boolean;
  version?: number;
  diff?: { added: string[]; removed: string[]; changed: string[] };
  next?: { businessSummary?: string };
  scenario?: { event: string | null };
  traces?: Array<{
    event: string;
    workflowKey: string;
    steps: Array<{ key: string; description: string; capabilityKey: string | null; outcome: string }>;
  }>;
  plan?: { canApply: boolean; ready: unknown[]; approvals: unknown[]; blocked: unknown[] };
}

function labelSection(section: string) {
  return section.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

export function ArchitectBlueprintReviewHost() {
  const ai = useAdminAI();
  const [blueprints, setBlueprints] = useState<BlueprintOption[]>([]);
  const [selectedBlueprintId, setSelectedBlueprintId] = useState(ai.blueprintDraftId);
  const [blueprintsLoading, setBlueprintsLoading] = useState(true);
  const [blueprintsError, setBlueprintsError] = useState("");
  const [loadError, setLoadError] = useState("");
  const lastUserProposal = useMemo(() => {
    const last = [...ai.messages].reverse().find((message) => message.role === "user");
    return last?.content ?? "";
  }, [ai.messages]);

  async function loadBlueprints() {
    setBlueprintsLoading(true);
    setBlueprintsError("");
    try {
      const payload = await fetchJson<{ blueprints: BlueprintOption[] }>("/api/admin/blueprints");
      setBlueprints(payload.blueprints ?? []);
    } catch (error) {
      setBlueprintsError(error instanceof Error ? error.message : "Could not load Blueprints");
    } finally {
      setBlueprintsLoading(false);
    }
  }

  useEffect(() => {
    void loadBlueprints();
  }, []);

  useEffect(() => {
    setSelectedBlueprintId(ai.blueprintDraftId);
  }, [ai.activeConversationId, ai.blueprintDraftId]);

  if (!selectedBlueprintId) {
    return (
      <section className="mx-auto mb-4 max-w-xl rounded-2xl border border-[var(--admin-border)] p-3 sm:p-4">
        <h3 className="text-sm font-semibold text-[var(--admin-ink)]">Blueprint review</h3>
        <p className="admin-copy mt-1 text-xs">Choose a Blueprint to review in this Architect session.</p>
        {blueprintsError ? (
          <p className="mt-2 text-xs text-rose-700 dark:text-rose-300" role="alert">
            {blueprintsError}
            <button type="button" className="ml-2 min-h-10 underline" onClick={() => void loadBlueprints()}>
              Retry
            </button>
          </p>
        ) : null}
        {blueprintsLoading ? (
          <p className="admin-copy mt-2 text-xs" role="status">Loading Blueprints…</p>
        ) : blueprints.length ? (
          <label className="mt-3 block text-xs font-medium text-[var(--admin-ink)]">
            Blueprint
            <select
              className="mt-1 min-h-11 w-full rounded-xl bg-[var(--admin-surface)] px-3 text-sm shadow-[var(--admin-shadow-border)]"
              value={selectedBlueprintId ?? ""}
              onChange={(event) => setSelectedBlueprintId(event.target.value || null)}
            >
              <option value="">Choose a Blueprint</option>
              {blueprints.map((blueprint) => (
                <option key={blueprint.id} value={blueprint.id}>
                  {blueprint.title} · v{blueprint.latest_version}
                </option>
              ))}
            </select>
          </label>
        ) : !blueprintsError ? (
          <p className="admin-copy mt-2 text-xs">No Blueprints are available in this workspace.</p>
        ) : null}
      </section>
    );
  }

  return (
    <>
      {blueprints.length ? (
        <section className="mx-auto mb-2 max-w-xl rounded-2xl border border-[var(--admin-border)] p-3 sm:p-4">
          <label className="block text-xs font-medium text-[var(--admin-ink)]">
            Blueprint
            <select
              className="mt-1 min-h-11 w-full rounded-xl bg-[var(--admin-surface)] px-3 text-sm shadow-[var(--admin-shadow-border)]"
              value={selectedBlueprintId}
              onChange={(event) => setSelectedBlueprintId(event.target.value || null)}
            >
              {!blueprints.some((blueprint) => blueprint.id === selectedBlueprintId) ? (
                <option value={selectedBlueprintId}>Attached Blueprint</option>
              ) : null}
              {blueprints.map((blueprint) => (
                <option key={blueprint.id} value={blueprint.id}>
                  {blueprint.title} · v{blueprint.latest_version}
                </option>
              ))}
            </select>
          </label>
        </section>
      ) : null}
      <ArchitectBlueprintReview
        blueprintId={selectedBlueprintId}
        defaultProposal={lastUserProposal}
        loadError={loadError}
        onLoadError={setLoadError}
      />
    </>
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
  const [result, setResult] = useState<ReviewResult | null>(null);
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
    setResult(null);
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
      setResult(payload as ReviewResult);
      if (path === "patch" && !preview) await load();
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : "Request failed" });
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
          placeholder="Describe this draft change"
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
        <div
          aria-live="polite"
          className="mt-3 rounded-xl border border-[var(--admin-border)] p-3 text-xs sm:p-4"
          role={result.error ? "alert" : "status"}
        >
          {result.error ? (
            <p className="text-rose-700 dark:text-rose-300">{result.error}</p>
          ) : result.preview ? (
            <div>
              <h4 className="font-semibold text-[var(--admin-ink)]">Patch preview</h4>
              <p className="admin-copy mt-1">
                Based on version {result.version}. Saving creates a new draft version; it does not
                apply the Blueprint.
              </p>
              {result.diff ? (
                <ul className="mt-3 space-y-1 text-[var(--admin-ink)]">
                  {[...result.diff.added, ...result.diff.changed, ...result.diff.removed].map(
                    (section) => (
                      <li key={section}>
                        {result.diff?.added.includes(section)
                          ? "Added"
                          : result.diff?.removed.includes(section)
                            ? "Removed"
                            : "Changed"}{" "}
                        {labelSection(section)}
                      </li>
                    ),
                  )}
                  {!result.diff.added.length &&
                  !result.diff.changed.length &&
                  !result.diff.removed.length ? <li>No changes detected.</li> : null}
                </ul>
              ) : null}
              {result.diff?.changed.includes("businessSummary") ||
              result.diff?.added.includes("businessSummary") ||
              result.diff?.removed.includes("businessSummary") ? (
                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="min-w-0 rounded-lg bg-[var(--admin-surface-subtle)] p-2">
                    <dt className="font-medium text-[var(--admin-muted)]">Current summary</dt>
                    <dd className="mt-1 break-words text-[var(--admin-ink)]">
                      {detail?.document.businessSummary || "Not set"}
                    </dd>
                  </div>
                  <div className="min-w-0 rounded-lg bg-[var(--admin-surface-subtle)] p-2">
                    <dt className="font-medium text-[var(--admin-muted)]">Proposed summary</dt>
                    <dd className="mt-1 break-words text-[var(--admin-ink)]">
                      {result.next?.businessSummary || "Not set"}
                    </dd>
                  </div>
                </dl>
              ) : null}
            </div>
          ) : result.kind === "simulation" ? (
            <div>
              <h4 className="font-semibold text-[var(--admin-ink)]">Simulation result</h4>
              <p className="admin-copy mt-1">
                {result.traces?.length
                  ? `${result.traces.length} workflow${result.traces.length === 1 ? "" : "s"} matched ${result.scenario?.event || "this scenario"}. No live changes were made.`
                  : `No workflows matched ${result.scenario?.event || "this scenario"}. No live changes were made.`}
              </p>
              {result.traces?.length ? (
                <ol className="mt-3 space-y-3">
                  {result.traces.map((trace) => (
                    <li
                      key={trace.workflowKey}
                      className="rounded-lg bg-[var(--admin-surface-subtle)] p-2"
                    >
                      <h5 className="font-medium text-[var(--admin-ink)]">{trace.workflowKey}</h5>
                      <ol className="mt-2 space-y-2">
                        {trace.steps.map((step) => (
                          <li key={step.key}>
                            <p className="text-[var(--admin-ink)]">{step.description}</p>
                            <p className="admin-copy mt-0.5">
                              {step.capabilityKey ? `${step.capabilityKey} · ` : ""}{step.outcome}
                            </p>
                          </li>
                        ))}
                      </ol>
                    </li>
                  ))}
                </ol>
              ) : null}
              {result.plan ? (
                <p className="admin-copy mt-3">
                  Preflight: {result.plan.ready.length} ready, {result.plan.approvals.length} need
                  approval, {result.plan.blocked.length} blocked.
                </p>
              ) : null}
            </div>
          ) : (
            <div>
              <h4 className="font-semibold text-[var(--admin-ink)]">Blueprint draft saved</h4>
              <p className="admin-copy mt-1">
                Version {result.version} saved. Apply remains a separate approval step.
              </p>
              {result.diff ? (
                <p className="mt-2 text-[var(--admin-ink)]">
                  {result.diff.changed.length || result.diff.added.length || result.diff.removed.length
                    ? `Updated: ${[...result.diff.added, ...result.diff.changed, ...result.diff.removed].map(labelSection).join(", ")}.`
                    : "No changes detected."}
                </p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
