"use client";

import { useRef, useState } from "react";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { fetchJson } from "@/lib/admin/fetchJson";
import { useAdminAI } from "./AdminAIProvider";
import { AdminSurface } from "./AdminSurface";
import { ActionReviewDialog, type ActionRow } from "./ActionReviewDialog";
import type { BlueprintPatchPreview } from "@/lib/revenue-os/architect-review-contract";

type BlueprintDetail = {
  blueprintId: string;
  version: number;
  document: { businessSummary: string };
};
type Simulation = {
  traces: Array<{
    workflowKey: string;
    event: string;
    steps: Array<{ key: string; description: string; outcome: string }>;
  }>;
  plan: { ready: unknown[]; approvals: unknown[]; blocked: unknown[] };
};
const post = <T,>(path: string, body: unknown) =>
  fetchJson<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export function ArchitectBlueprintReviewHost() {
  const ai = useAdminAI();
  const [selection, setSelection] = useState("");
  const list = useAdminQuery<{ blueprints: Array<{ id: string; title: string }> }>(
    ["admin", "architect", "blueprints"],
    "/api/admin/blueprints",
    { placeholderData: undefined },
  );
  const selected = selection || ai.blueprintDraftId || "";
  return (
    <AdminSurface className="mx-auto mb-4 max-w-2xl" padding="sm">
      <details open>
        <summary className="min-h-11 cursor-pointer text-sm font-semibold">
          Blueprint review
        </summary>
        <p className="admin-copy mb-3 text-sm">
          Review a draft, preview a change, or inspect how its workflows would run.
        </p>
        {list.error && (
          <p role="alert" className="mb-2 text-sm text-[var(--admin-danger)]">
            {list.error.message}{" "}
            <button
              type="button"
              className="admin-button admin-button--secondary"
              onClick={() => void list.refetch()}
            >
              Retry
            </button>
          </p>
        )}
        {list.isPending && (
          <p role="status" className="admin-copy text-sm">
            Loading Blueprints…
          </p>
        )}
        <label className="block text-sm font-medium">
          Blueprint
          <select
            className="admin-field mt-1 min-h-11 w-full"
            aria-label="Blueprint"
            value={selected}
            onChange={(event) => setSelection(event.target.value)}
            disabled={list.isPending}
          >
            <option value="">Choose a Blueprint</option>
            {selected && !list.data?.blueprints.some((item) => item.id === selected) && (
              <option value={selected}>Attached Blueprint</option>
            )}
            {list.data?.blueprints.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        {!list.isPending && !list.error && !list.data?.blueprints.length && (
          <p className="admin-copy mt-2 text-sm">
            No Blueprint drafts are available. Create one from the Blueprints workspace.
          </p>
        )}
        {selected && <BlueprintDraftReview key={selected} blueprintId={selected} />}
      </details>
    </AdminSurface>
  );
}

function BlueprintDraftReview({ blueprintId }: { blueprintId: string }) {
  const detail = useAdminQuery<BlueprintDetail>(
    ["admin", "architect", "blueprint", blueprintId],
    `/api/admin/blueprints/${blueprintId}`,
    { placeholderData: undefined },
  );
  const [proposal, setProposal] = useState("");
  const [summary, setSummary] = useState("");
  const [event, setEvent] = useState("");
  const [preview, setPreview] = useState<BlueprintPatchPreview | null>(null);
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [action, setAction] = useState<ActionRow | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const request = useRef<{ signature: string; id: string } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const refreshAfterClose = useRef(false);
  async function run(mode: "preview" | "propose" | "simulate") {
    if (lock.current || !detail.data) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const path = `/api/admin/blueprints/${blueprintId}`;
      if (mode === "simulate") {
        setSimulation(await post<Simulation>(`${path}/simulate`, { event }));
      } else if (mode === "preview") {
        const signature = JSON.stringify([blueprintId, detail.data.version, proposal, summary]);
        if (request.current?.signature !== signature)
          request.current = { signature, id: crypto.randomUUID() };
        setPreview(
          await post<BlueprintPatchPreview>(`${path}/patch`, {
            mode,
            expectedVersion: detail.data.version,
            proposal,
            changeSummary: summary,
            requestId: request.current.id,
          }),
        );
      } else if (preview) {
        const proposed = await post<ActionRow>(`${path}/patch`, {
          ...preview.command,
          blueprintId: undefined,
          mode,
          digest: preview.digest,
        });
        if (proposed.status !== "pending")
          throw new Error(
            "This request already has a recorded result. Check Approvals before another change.",
          );
        setAction(proposed);
        setReviewing(true);
      }
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Blueprint review is unavailable.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function decide(decision: "approve" | "reject") {
    if (!action || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await fetchJson<{ result?: { message?: string } }>(
        "/api/admin/revenue-os/actions",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: action.id, decision }),
        },
      );
      setNotice(
        decision === "reject"
          ? "Blueprint change rejected."
          : (result.result?.message ?? "Check the saved Blueprint receipt."),
      );
      refreshAfterClose.current = decision === "approve";
      setReviewing(false);
      setPreview(null);
      request.current = null;
    } catch (issue) {
      setError(
        issue instanceof Error
          ? issue.message
          : "Check the recorded result before retrying this request.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="mt-4 space-y-3">
      {detail.error && (
        <p role="alert" className="text-sm text-[var(--admin-danger)]">
          {detail.error.message}{" "}
          <button
            type="button"
            className="admin-button admin-button--secondary"
            onClick={() => void detail.refetch()}
          >
            Reload draft
          </button>
        </p>
      )}
      {detail.data && (
        <p className="admin-copy break-words text-sm">
          Version {detail.data.version}: {detail.data.document.businessSummary}
        </p>
      )}
      <label className="block text-sm font-medium">
        Proposed change
        <textarea
          className="admin-field mt-1 min-h-24 w-full"
          value={proposal}
          onChange={(e) => {
            setProposal(e.target.value);
            setPreview(null);
          }}
          placeholder="Set the business summary to …"
          disabled={busy}
        />
      </label>
      <label className="block text-sm font-medium">
        Change summary
        <input
          className="admin-field mt-1 min-h-11 w-full"
          value={summary}
          onChange={(e) => {
            setSummary(e.target.value);
            setPreview(null);
          }}
          maxLength={2000}
          disabled={busy}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="admin-button admin-button--secondary"
          disabled={
            busy || !detail.data || Boolean(detail.error) || !proposal.trim() || !summary.trim()
          }
          onClick={() => void run("preview")}
        >
          Preview patch
        </button>
        <button
          type="button"
          className="admin-button admin-button--primary"
          disabled={busy || !preview || Boolean(detail.error)}
          onClick={() => void run("propose")}
        >
          Review draft save
        </button>
      </div>
      {preview && (
        <section
          aria-label="Patch preview"
          className="admin-surface-subtle rounded-[var(--admin-surface-radius)] p-3"
        >
          <h3 className="text-sm font-semibold">Patch preview</h3>
          <dl className="mt-2 space-y-2 text-sm">
            {Object.entries(preview.review)
              .filter(([key]) => !["Operation", "Consequence"].includes(key))
              .map(([key, value]) => (
                <div key={key}>
                  <dt className="text-[var(--admin-muted)]">{key}</dt>
                  <dd className="break-words whitespace-pre-wrap">{value}</dd>
                </div>
              ))}
          </dl>
          <p className="admin-copy mt-3 text-xs">{preview.review.Consequence}</p>
        </section>
      )}
      <label className="block text-sm font-medium">
        Simulation event <span className="admin-copy font-normal">(optional)</span>
        <input
          className="admin-field mt-1 min-h-11 w-full"
          value={event}
          onChange={(e) => setEvent(e.target.value)}
          maxLength={500}
          placeholder="Leave blank to inspect every workflow"
          disabled={busy}
        />
      </label>
      <button
        type="button"
        className="admin-button admin-button--secondary"
        disabled={busy || !detail.data || Boolean(detail.error)}
        onClick={() => void run("simulate")}
      >
        Simulate
      </button>
      {simulation && (
        <section aria-label="Simulation result" className="space-y-2 text-sm">
          <h3 className="font-semibold">Simulation result</h3>
          <p className="admin-copy">
            {simulation.traces.length} matching workflows. No live changes were made.
          </p>
          {simulation.traces.map((trace) => (
            <div key={trace.workflowKey}>
              <h4 className="font-medium">{trace.workflowKey}</h4>
              <ol className="mt-1 space-y-2">
                {trace.steps.map((step) => (
                  <li key={step.key}>
                    <p>{step.description}</p>
                    <p className="admin-copy text-xs">{step.outcome}</p>
                  </li>
                ))}
              </ol>
            </div>
          ))}
          <p className="admin-copy">
            Preflight: {simulation.plan.ready.length} ready, {simulation.plan.approvals.length} need
            approval, {simulation.plan.blocked.length} blocked.
          </p>
        </section>
      )}
      {!reviewing && error && (
        <p role="alert" className="text-sm text-[var(--admin-danger)]">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      <ActionReviewDialog
        open={reviewing}
        action={action}
        busy={busy}
        error={error}
        onClose={() => setReviewing(false)}
        onApprove={() => void decide("approve")}
        onReject={() => void decide("reject")}
        onExitComplete={() => {
          if (refreshAfterClose.current) {
            refreshAfterClose.current = false;
            void detail.refetch();
          }
        }}
      />
    </div>
  );
}
