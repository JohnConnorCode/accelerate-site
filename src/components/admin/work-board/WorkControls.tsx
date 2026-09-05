"use client";
import { useState } from "react";
import { fetchJson } from "@/lib/admin/fetchJson";
import { toast } from "@/lib/admin/useToast";
import type { FeatureRequest } from "@/lib/feature-board";
const field =
  "min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 text-sm";
const button =
  "min-h-11 rounded-xl border border-[var(--admin-border)] px-4 text-xs font-semibold disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-blue-500";
export async function sendWork(
  operation: string,
  feature: FeatureRequest | null,
  payload: Record<string, unknown>,
) {
  return fetchJson<{ card: FeatureRequest }>("/api/admin/features", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      operation,
      ...(feature ? { id: feature.id, revision: feature.revision } : {}),
      requestKey: crypto.randomUUID(),
      payload,
    }),
  });
}
export function WorkControls({
  feature,
  cards,
  onChanged,
}: {
  feature: FeatureRequest;
  cards: FeatureRequest[];
  onChanged: (feature: FeatureRequest) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [mergedCommit, setMergedCommit] = useState("");
  const [deploymentUrl, setDeploymentUrl] = useState("");
  const [commit, setCommit] = useState("");
  const [checks, setChecks] = useState("");
  const [history, setHistory] = useState<
    | {
        id: string;
        actor: string;
        operation: string;
        created_at: string;
        payload: { message?: string };
      }[]
    | null
  >(null);
  const [dependencies, setDependencies] = useState(feature.dependencies ?? []);
  const [scope, setScope] = useState(((feature.work_spec?.scope as string[]) ?? []).join("\n"));
  const [verification, setVerification] = useState(
    ((feature.work_spec?.verification as { command: string; expected: string }[]) ?? [])
      .map((c) => `${c.command} | ${c.expected}`)
      .join("\n"),
  );
  const key = `work-claim:${feature.id}`;
  const run = async (operation: string, payload: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      if (operation === "claim") {
        const token = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
          .replaceAll("+", "-")
          .replaceAll("/", "_")
          .replaceAll("=", "");
        sessionStorage.setItem(key, token);
        payload.claimToken = token;
      }
      if (["heartbeat", "progress", "block", "release", "submit"].includes(operation))
        payload.claimToken = sessionStorage.getItem(key) ?? "";
      const { card } = await sendWork(operation, feature, payload);
      onChanged(card);
      if (["release", "block", "submit"].includes(operation)) sessionStorage.removeItem(key);
      toast.success(`Work ${operation} recorded`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Work action failed");
    } finally {
      setBusy(false);
    }
  };
  const planning = ["backlog", "planned", "blocked"].includes(feature.status);
  return (
    <section
      className="mx-5 mt-5 space-y-4 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] p-4 sm:mx-6"
      aria-label="Work execution"
    >
      <div className="flex flex-wrap justify-between gap-2">
        <h3 className="font-semibold">Execution and readiness</h3>
        <span className="text-xs tabular-nums">
          {feature.project_key} · Revision {feature.revision}
        </span>
      </div>
      <p className="text-sm">
        {feature.readiness?.length
          ? feature.readiness.join(" · ").replaceAll("_", " ")
          : planning
            ? "Ready to claim"
            : feature.status.replaceAll("_", " ")}
      </p>
      {feature.lease_owner && (
        <p className="text-xs">
          Claimed by {feature.lease_owner} · Lease expires{" "}
          {new Date(feature.lease_expires_at!).toLocaleString()}
        </p>
      )}
      {feature.work_blocker && (
        <p className="text-sm text-amber-700 dark:text-amber-300">{feature.work_blocker}</p>
      )}
      <label className="block text-xs font-semibold">
        Decision, progress or review reason
        <textarea
          className={`${field} mt-2`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Record what changed and why (at least 10 characters)"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {planning && feature.status !== "blocked" && (
          <button
            type="button"
            className={button}
            disabled={busy || Boolean(feature.readiness?.length)}
            onClick={() => void run("claim")}
          >
            Claim work
          </button>
        )}
        {feature.status === "in_progress" && (
          <>
            <button
              type="button"
              className={button}
              disabled={busy}
              onClick={() => void run("heartbeat")}
            >
              Renew claim
            </button>
            <button
              type="button"
              className={button}
              disabled={busy || message.length < 10}
              onClick={() => void run("progress", { message })}
            >
              Record progress
            </button>
            <button
              type="button"
              className={button}
              disabled={busy || message.length < 10}
              onClick={() => void run("block", { message })}
            >
              Block work
            </button>
            <button
              type="button"
              className={button}
              disabled={busy}
              onClick={() => void run("release")}
            >
              Release claim
            </button>
            {(!feature.lease_expires_at || new Date(feature.lease_expires_at) <= new Date()) && (
              <button
                type="button"
                className={button}
                disabled={busy || message.length < 10}
                onClick={() => void run("recover", { message })}
              >
                Recover expired claim
              </button>
            )}
          </>
        )}
        {["blocked", "shipped", "in_review"].includes(feature.status) && (
          <button
            type="button"
            className={button}
            disabled={busy || message.length < 10}
            onClick={() => void run("reopen", { message })}
          >
            Reopen for planning
          </button>
        )}
        {feature.status === "in_review" && (
          <>
            <button
              type="button"
              className={button}
              disabled={busy || message.length < 10}
              onClick={() => void run("review", { accept: true, message })}
            >
              Accept verification
            </button>
            <button
              type="button"
              className={button}
              disabled={busy || message.length < 10}
              onClick={() => void run("review", { accept: false, message })}
            >
              Request changes
            </button>
          </>
        )}
      </div>
      {feature.status === "in_progress" && (
        <details>
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">
            Submit verification for review
          </summary>
          <div className="space-y-3">
            <label className="block text-xs">
              Exact commit SHA
              <input className={field} value={commit} onChange={(e) => setCommit(e.target.value)} />
            </label>
            <label className="block text-xs">
              Passing checks — one per line: check name | evidence
              <textarea
                className={field}
                value={checks}
                onChange={(e) => setChecks(e.target.value)}
              />
            </label>
            <p className="text-xs">
              For structured acceptance, use acceptance ID | check name | evidence. Cover every
              acceptance ID in the implementation contract.
            </p>
            <button
              type="button"
              className={button}
              disabled={busy || message.length < 10 || !checks.trim()}
              onClick={() =>
                void run("submit", {
                  evidence: {
                    summary: message,
                    ...(commit ? { commitSha: commit } : {}),
                    checks: checks
                      .split("\n")
                      .filter(Boolean)
                      .map((line) => {
                        const parts = line.split("|");
                        const acceptanceId = parts.length >= 3 ? parts.shift()!.trim() : undefined;
                        const name = parts.shift() ?? "";
                        return {
                          ...(acceptanceId ? { acceptanceId } : {}),
                          name: name.trim(),
                          status: "passed",
                          evidence: parts.join("|").trim(),
                        };
                      }),
                  },
                })
              }
            >
              Submit for review
            </button>
          </div>
        </details>
      )}
      <details>
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">
          Dependencies ({dependencies.length})
        </summary>
        <div className="max-h-60 space-y-1 overflow-auto">
          {cards
            .filter((c) => c.id !== feature.id && c.project_key === feature.project_key)
            .map((c) => (
              <label key={c.id} className="flex min-h-10 items-center gap-3 text-xs">
                <input
                  type="checkbox"
                  disabled={!planning}
                  checked={dependencies.includes(c.id)}
                  onChange={(e) =>
                    setDependencies(
                      e.target.checked
                        ? [...dependencies, c.id]
                        : dependencies.filter((id) => id !== c.id),
                    )
                  }
                />
                {c.title} · {c.status.replaceAll("_", " ")}
              </label>
            ))}
        </div>
        {planning && (
          <button
            type="button"
            className={button}
            disabled={busy}
            onClick={() => void run("dependencies", { dependencies })}
          >
            Save dependencies
          </button>
        )}
      </details>
      <details>
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">
          Implementation contract
        </summary>
        {feature.work_spec?.businessValue != null && (
          <p className="mb-3 text-sm">{String(feature.work_spec.businessValue)}</p>
        )}
        <label className="block text-xs">
          Scope — one item per line
          <textarea
            className={field}
            disabled={!planning}
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          />
        </label>
        <label className="mt-3 block text-xs">
          Verification — command | expected result
          <textarea
            className={field}
            disabled={!planning}
            value={verification}
            onChange={(e) => setVerification(e.target.value)}
          />
        </label>
        <ol className="my-3 space-y-2 text-xs">
          {((feature.work_spec?.acceptance as { id: string; criterion: string }[]) ?? []).map(
            (item) => (
              <li key={item.id}>
                <strong>{item.id}</strong> — {item.criterion}
              </li>
            ),
          )}
        </ol>
        {((feature.work_spec?.references as { path: string; reason: string }[]) ?? []).map(
          (ref) => (
            <p key={ref.path} className="mt-2 break-words text-xs">
              <code>{ref.path}</code> — {ref.reason}
            </p>
          ),
        )}
        {planning && (
          <button
            type="button"
            className={`${button} mt-3`}
            disabled={busy}
            onClick={() =>
              void run("edit", {
                work_spec: {
                  ...feature.work_spec,
                  scope: scope.split("\n").filter(Boolean),
                  verification: verification
                    .split("\n")
                    .filter(Boolean)
                    .map((line) => {
                      const [command, ...expected] = line.split("|");
                      return {
                        command: (command ?? "").trim(),
                        expected: expected.join("|").trim(),
                      };
                    }),
                },
              })
            }
          >
            Save contract
          </button>
        )}
      </details>
      {Object.keys(feature.work_delivery ?? {}).length > 0 && (
        <details>
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">
            Delivery evidence
          </summary>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs">
            {JSON.stringify(feature.work_delivery, null, 2)}
          </pre>
          <p className="mt-2 text-xs">
            Verification acceptance does not imply merge or deployment.
          </p>
        </details>
      )}
      {feature.status === "shipped" && (
        <details>
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">
            Record merge or deployment evidence
          </summary>
          <p className="mb-3 text-xs">
            Record a completed external action with its evidence. These controls do not merge or
            deploy.
          </p>
          <label className="block text-xs">
            Verified merge commit
            <input
              className={field}
              value={mergedCommit}
              onChange={(e) => setMergedCommit(e.target.value)}
            />
          </label>
          <button
            type="button"
            className={`${button} mt-2`}
            disabled={busy || message.length < 10 || !/^[a-f0-9]{40}$/.test(mergedCommit)}
            onClick={() =>
              void run("delivery", { message, mergedCommit, mergedAt: new Date().toISOString() })
            }
          >
            Record verified merge
          </button>
          <label className="mt-3 block text-xs">
            Deployment receipt URL
            <input
              className={field}
              value={deploymentUrl}
              onChange={(e) => setDeploymentUrl(e.target.value)}
            />
          </label>
          <button
            type="button"
            className={`${button} mt-2`}
            disabled={busy || message.length < 10 || !deploymentUrl}
            onClick={() =>
              void run("delivery", { message, deploymentUrl, deployedAt: new Date().toISOString() })
            }
          >
            Record deployment receipt
          </button>
        </details>
      )}
      <button
        type="button"
        className={button}
        onClick={() =>
          void fetchJson<{ events: NonNullable<typeof history> }>(
            `/api/admin/features?history=${feature.id}`,
          )
            .then((result) => setHistory(result.events))
            .catch((error) => toast.error(error.message))
        }
      >
        Read activity history
      </button>
      {history && (
        <ol className="max-h-60 space-y-3 overflow-auto">
          {history.length ? (
            history.map((event) => (
              <li key={event.id} className="text-xs">
                <strong>{event.operation}</strong> · {event.actor} ·{" "}
                {new Date(event.created_at).toLocaleString()}
                <p className="mt-1">{event.payload.message}</p>
              </li>
            ))
          ) : (
            <li className="text-xs">No events recorded under the new protocol.</li>
          )}
        </ol>
      )}
    </section>
  );
}
