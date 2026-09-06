"use client";
import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "./PageHeader";
import { AdminSurface } from "./AdminSurface";
import AdminLink from "./AdminLink";
import { DemoBusinessNotice } from "./DemoBusinessNotice";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { fetchJson } from "@/lib/admin/fetchJson";
import {
  collectionSummary,
  type CollectionCaseView,
  type CollectionWorkspaceData,
} from "@/lib/revenue-os/collection-contract";
const button =
  "inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold shadow-[var(--admin-shadow-border)] hover:bg-[var(--admin-surface-subtle)] disabled:opacity-50";
const field =
  "mt-1 min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm";
const money = (value: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value / 100);
type Preview = { digest: string; to: string; subject: string; text: string; html: string };
const request = <T,>(path: string, method: string, body: unknown) =>
  fetchJson<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
export function CollectionCaseLinks({ contactId }: { contactId?: string }) {
  const modules = useAdminQuery<{ modules: string[] }>(
    ["admin", "tenant-modules"],
    "/api/admin/tenant/modules",
  );
  const enabled = modules.data?.modules.includes("receivables-collections") ?? false;
  const query = useAdminQuery<CollectionWorkspaceData>(
    ["admin", "collection-links", contactId],
    `/api/admin/collections/workspace${contactId ? `?contactId=${contactId}` : ""}`,
    { enabled },
  );
  if (!enabled || !query.data?.cases.length) return null;
  return (
    <AdminSurface>
      <h2 className="mb-3 text-sm font-semibold">Collections follow-up</h2>
      <ul className="space-y-3">
        {query.data.cases
          .filter((c) => c.status === "open")
          .slice(0, 3)
          .map((c) => (
            <li key={c.id}>
              <AdminLink
                href={`/admin/collections?case=${c.id}`}
                className="text-sm font-semibold underline"
              >
                {c.name}: {c.nextAction}
              </AdminLink>
              {c.work[0] && (
                <p className="mt-1 text-xs text-[var(--admin-muted)]">
                  {c.work[0].status} · {c.work[0].reason}
                  {c.work[0].nextCheckAt
                    ? ` · ${new Date(c.work[0].nextCheckAt).toLocaleDateString()}`
                    : ""}
                </p>
              )}
            </li>
          ))}
      </ul>
      <AdminLink className="mt-3 inline-block text-sm underline" href="/admin/collections">
        Open Collections Action Desk
      </AdminLink>
    </AdminSurface>
  );
}
export function CollectionsWorkspace() {
  const requestedCase = useSearchParams().get("case");
  const query = useAdminQuery<CollectionWorkspaceData>(
    ["admin", "collections"],
    "/api/admin/collections/workspace",
  );
  const cache = useQueryClient();
  const refreshRequests = useRef(new Map<string, string>());
  const [selected, setSelected] = useState(""),
    [preview, setPreview] = useState<Preview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [invoice, setInvoice] = useState("");
  const cases = query.data?.cases ?? [],
    current = cases.find((c) => c.id === (selected || requestedCase)) ?? cases[0],
    summary = collectionSummary(cases);
  async function perform(work: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      await cache.invalidateQueries({ queryKey: ["admin"] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operation unavailable");
      await query.refetch();
    } finally {
      setBusy(false);
    }
  }
  async function refresh(ids: string[]) {
    const key = [...ids].sort().join(",");
    const requestId = refreshRequests.current.get(key) ?? crypto.randomUUID();
    refreshRequests.current.set(key, requestId);
    await request("/api/admin/collections", "POST", {
      requestId,
      creationActionIds: ids,
    });
    setPreview(null);
    refreshRequests.current.delete(key);
    setNotice("Invoice facts refreshed. Missing invoices are never treated as paid.");
  }
  async function patch(c: CollectionCaseView, patch: unknown) {
    await request("/api/admin/collections", "PATCH", {
      caseId: c.id,
      revision: c.revision,
      requestId: crypto.randomUUID(),
      patch,
    });
    setPreview(null);
    setNotice("Case policy saved with a revision and history receipt.");
  }
  async function decide(id: string, decision: string) {
    await request("/api/admin/revenue-os/actions", "PATCH", { id, decision });
    setPreview(null);
    setNotice(
      decision === "approve"
        ? "Execution finished. Check the recorded result below."
        : "Action updated.",
    );
  }
  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Collections Action Desk"
        subtitle="Resolve overdue balances with clear ownership, verified facts and reviewed customer reminders."
        actions={
          <AdminLink className={button} href="/admin/plugins">
            Manage plugins
          </AdminLink>
        }
      />
      <DemoBusinessNotice />
      {(error || query.error) && (
        <p role="alert" className="rounded-xl border border-[var(--admin-danger)]/30 p-4 text-sm">
          {error || query.error?.message}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      {query.data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <AdminSurface>
              <p className="text-xs text-[var(--admin-muted)]">Eligible overdue balance</p>
              <p className="mt-2 font-semibold tabular-nums">
                {Object.entries(summary.eligible)
                  .map(([currency, value]) => money(value, currency))
                  .join(" · ") || "No eligible balance"}
              </p>
            </AdminSurface>
            {[
              ["Cases handled", summary.handled],
              ["Missed promises", summary.missedPromises],
              ["Verified paid invoices", summary.paidInvoices],
            ].map(([label, value]) => (
              <AdminSurface key={label}>
                <p className="text-xs text-[var(--admin-muted)]">{label}</p>
                <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>
              </AdminSurface>
            ))}
          </div>
          <p className="text-xs text-[var(--admin-muted)]">
            Metrics use the displayed cases and last observed invoice facts. Paid invoices are
            verified outcomes; payment attribution to a reminder is not assumed. Handled means
            assigned, held, promised or settled.
          </p>
        </>
      )}
      <AdminSurface>
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void perform(() => refresh([invoice]));
          }}
        >
          <label className="flex-1 text-sm">
            Track a platform invoice
            <select className={field} value={invoice} onChange={(e) => setInvoice(e.target.value)}>
              <option value="">Choose an executed invoice operation</option>
              {query.data?.invoiceOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
            </select>
          </label>
          <button disabled={busy || !invoice} className={button}>
            Refresh and track invoice
          </button>
          <AdminLink href="/admin/invoicing" className={button}>
            Open invoicing
          </AdminLink>
        </form>
      </AdminSurface>
      {query.isPending && <p role="status">Loading verified case records…</p>}
      {query.data?.truncated && (
        <p role="status">
          Showing a bounded recent case/history set. Open a customer record to narrow the workspace.
        </p>
      )}
      {query.data && !cases.length && (
        <AdminSurface>
          No collection cases yet. Choose a platform invoice above to verify its current balance.
        </AdminSurface>
      )}
      {!!cases.length && (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)]">
          <AdminSurface padding="sm">
            <h2 className="px-2 py-3 font-semibold">Accounts and currencies</h2>
            <ul className="space-y-1">
              {cases.map((c) => (
                <li key={c.id}>
                  <button
                    className={`w-full rounded-xl p-3 text-left ${c.id === current?.id ? "bg-[var(--admin-surface-subtle)] shadow-[var(--admin-shadow-border)]" : "hover:bg-[var(--admin-surface-subtle)]"}`}
                    aria-pressed={c.id === current?.id}
                    onClick={() => {
                      setSelected(c.id);
                      setPreview(null);
                      setError("");
                      setNotice("");
                    }}
                  >
                    <span className="block text-sm font-semibold">{c.name}</span>
                    <span className="mt-1 block text-xs text-[var(--admin-muted)]">
                      {c.currency.toUpperCase()} ·{" "}
                      {c.disputed
                        ? "Disputed"
                        : c.paused
                          ? "Paused"
                          : c.promiseDate
                            ? `Promise ${c.promiseDate}`
                            : c.status}{" "}
                      ·{" "}
                      {money(
                        c.invoices.reduce((n, i) => n + i.remaining, 0),
                        c.currency,
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </AdminSurface>
          {current && (
            <div className="min-w-0 space-y-5">
              <AdminSurface padding="lg">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">{current.name}</h2>
                    <p className="text-sm text-[var(--admin-muted)]">
                      {current.currency.toUpperCase()} · Case revision {current.revision}
                    </p>
                  </div>
                  <AdminLink
                    className={button}
                    href={`/admin/contacts/${encodeURIComponent(current.email)}`}
                  >
                    Customer record
                  </AdminLink>
                </div>
                <p className="my-4 text-sm">{current.nextAction}</p>
                <ul className="divide-y divide-[var(--admin-border)]">
                  {current.invoices.map((i) => (
                    <li key={i.creationActionId} className="py-3 text-sm">
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="break-all">{i.invoiceId}</span>
                        <strong className="tabular-nums">
                          {money(i.remaining, current.currency)}
                        </strong>
                      </div>
                      <p className="mt-1 text-xs text-[var(--admin-muted)]">
                        {i.status} · Due {i.dueDate ?? "unknown"} · Observed{" "}
                        {new Date(i.observedAt).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
                <button
                  className={`${button} mt-3`}
                  disabled={busy || current.invoices.length > 25}
                  onClick={() =>
                    void perform(() => refresh(current.invoices.map((i) => i.creationActionId)))
                  }
                >
                  Refresh invoice facts
                </button>
              </AdminSurface>
              <AdminSurface padding="lg">
                <h3 className="mb-4 font-semibold">Owner and collection policy</h3>
                <form
                  key={`${current.id}:${current.revision}`}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const values = new FormData(e.currentTarget);
                    void perform(() =>
                      patch(current, {
                        ownerEmail: String(values.get("ownerEmail") || "") || null,
                        promiseDate: String(values.get("promiseDate") || "") || null,
                        pauseUntil: String(values.get("pauseUntil") || "") || null,
                        nextAction: String(values.get("nextAction")),
                        disputed: values.has("disputed"),
                        paused: values.has("paused"),
                      }),
                    );
                  }}
                >
                  <fieldset
                    disabled={busy || current.status === "settled"}
                    className="grid gap-4 sm:grid-cols-2"
                  >
                    <label className="text-sm">
                      Owner email
                      <input
                        className={field}
                        name="ownerEmail"
                        type="email"
                        defaultValue={current.ownerEmail ?? ""}
                      />
                    </label>
                    <label className="text-sm">
                      Payment promise
                      <input
                        className={field}
                        name="promiseDate"
                        type="date"
                        defaultValue={current.promiseDate ?? ""}
                      />
                    </label>
                    <label className="text-sm">
                      Pause until
                      <input
                        className={field}
                        name="pauseUntil"
                        type="date"
                        defaultValue={current.pauseUntil ?? ""}
                      />
                    </label>
                    <label className="text-sm">
                      Next action
                      <input
                        className={field}
                        name="nextAction"
                        required
                        maxLength={500}
                        defaultValue={current.nextAction}
                      />
                    </label>
                    <label className="flex min-h-11 items-center gap-2 text-sm">
                      <input name="disputed" type="checkbox" defaultChecked={current.disputed} />
                      Disputed: hold reminders
                    </label>
                    <label className="flex min-h-11 items-center gap-2 text-sm">
                      <input name="paused" type="checkbox" defaultChecked={current.paused} />
                      Pause indefinitely
                    </label>
                    <button className={button}>Save case policy</button>
                  </fieldset>
                </form>
              </AdminSurface>
              <AdminSurface padding="lg">
                <h3 className="font-semibold">Reviewed reminder</h3>
                <p className="my-3 text-sm text-[var(--admin-muted)]">
                  Current payment, holds, recipient and plugin state are checked again before
                  sending.
                </p>
                <button
                  className={button}
                  disabled={busy || current.status === "settled"}
                  onClick={() =>
                    void perform(async () => {
                      const data = await request<{ preview: Preview }>(
                        "/api/admin/collections/reminders",
                        "POST",
                        { caseId: current.id },
                      );
                      setPreview(data.preview);
                    })
                  }
                >
                  Preview reminder
                </button>
                {preview && (
                  <div className="mt-4 space-y-4">
                    <p className="break-words text-sm">
                      <strong>To:</strong> {preview.to}
                      <br />
                      <strong>Subject:</strong> {preview.subject}
                    </p>
                    <iframe
                      title="Branded reminder preview"
                      sandbox=""
                      srcDoc={preview.html}
                      className="h-[560px] w-full rounded-xl border border-[var(--admin-border)] bg-white"
                    />
                    <button
                      className={button}
                      disabled={busy}
                      onClick={() =>
                        void perform(async () => {
                          await request("/api/admin/collections/reminders", "POST", {
                            caseId: current.id,
                            digest: preview.digest,
                          });
                          setPreview(null);
                          setNotice("Reminder queued for human review. Nothing has been sent.");
                        })
                      }
                    >
                      Queue reviewed reminder
                    </button>
                  </div>
                )}
                <ul className="mt-5 space-y-4">
                  {current.actions.map((a) => (
                    <li key={a.id} className="rounded-xl border border-[var(--admin-border)] p-4">
                      <p className="text-sm font-semibold">
                        {a.title} · {a.status}
                      </p>
                      {a.error && (
                        <p className="mt-2 text-sm" role="status">
                          {a.error}
                        </p>
                      )}
                      {a.preview && (
                        <details className="my-3 text-sm">
                          <summary className="cursor-pointer">
                            Review queued recipient and content
                          </summary>
                          <pre className="mt-2 whitespace-pre-wrap break-words font-sans">
                            {a.preview.to}
                            {"\n"}
                            {a.preview.text}
                          </pre>
                        </details>
                      )}
                      {a.result && (
                        <p className="my-2 text-xs">
                          Receipt: {String(a.result.state ?? a.result.status ?? "recorded")}
                          {a.result.provider_id ? ` · ${String(a.result.provider_id)}` : ""}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {a.status === "pending" && (
                          <>
                            <button
                              className={button}
                              disabled={busy}
                              onClick={() => void perform(() => decide(a.id, "approve"))}
                            >
                              Approve and send
                            </button>
                            <button
                              className={button}
                              disabled={busy}
                              onClick={() => void perform(() => decide(a.id, "reject"))}
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {a.status === "failed" && a.result?.status !== "skipped" && (
                          <button
                            className={button}
                            disabled={busy}
                            onClick={() =>
                              void perform(async () => {
                                const data = await request<{ result: { state: string } }>(
                                  "/api/admin/revenue-os/actions",
                                  "PATCH",
                                  { id: a.id, decision: "reconcile" },
                                );
                                setNotice(
                                  `Receipt ${data.result.state}. Recovery does not send another email.`,
                                );
                              })
                            }
                          >
                            Reconcile receipt
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                {query.data?.simulated && (
                  <button
                    className={`${button} mt-4`}
                    disabled={busy || current.status === "settled"}
                    onClick={() =>
                      void perform(async () => {
                        await request("/api/admin/collections/simulate-payment", "POST", {
                          caseId: current.id,
                        });
                        setNotice(
                          "Simulated payment recorded. A pending reminder must now be skipped.",
                        );
                      })
                    }
                  >
                    Simulate payment before approval
                  </button>
                )}
              </AdminSurface>
              <AdminSurface>
                <h3 className="mb-3 font-semibold">Work and history</h3>
                {current.work.map((w) => (
                  <div key={w.id} className="mb-3 text-sm">
                    <p>
                      {w.objective} · {w.status}
                    </p>
                    <p className="text-xs text-[var(--admin-muted)]">
                      {w.reason}
                      {w.nextCheckAt
                        ? ` · Next check ${new Date(w.nextCheckAt).toLocaleString()}`
                        : ""}
                    </p>
                  </div>
                ))}
                <ul className="space-y-2">
                  {current.events.slice(0, 12).map((e) => (
                    <li key={e.id} className="text-xs text-[var(--admin-muted)]">
                      {new Date(e.at).toLocaleString()} · {e.kind.replaceAll("_", " ")}
                    </li>
                  ))}
                </ul>
              </AdminSurface>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
