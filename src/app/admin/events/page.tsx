"use client";
import { WORKSHOP_EVENT } from "@/content/workshops";
import { useCallback, useEffect, useRef, useState } from "react";
import { ZodError } from "zod";
import { BillingNavigation } from "@/components/admin/BillingNavigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSurface } from "@/components/admin/AdminSurface";
import {
  eventDefinitionSchema,
  eventLocalTime,
  eventLocalToIso,
  eventPath,
  eventTiming,
  ticketMoney,
  type EventDefinition,
  type TicketEvent,
  type TicketOrderSummary,
} from "@/lib/revenue-os/event-ticketing-contract";

type Workspace = {
  tenantSlug: string | null;
  events: TicketEvent[];
  orders: TicketOrderSummary[];
  truncated: boolean;
  simulated?: boolean;
};
const field = "admin-field";
const button = "admin-button admin-button--secondary";
function editor(event: EventDefinition): EventDefinition {
  return {
    ...(Object.fromEntries(
      Object.keys(eventDefinitionSchema.shape).map((key) => [
        key,
        event[key as keyof EventDefinition],
      ]),
    ) as EventDefinition),
    starts_at: eventLocalTime(event.starts_at, event.timezone),
    ends_at: eventLocalTime(event.ends_at, event.timezone),
    refund_cutoff: eventLocalTime(event.refund_cutoff, event.timezone),
  };
}
export default function EventsPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<EventDefinition | null>(null);
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const attempt = useRef({ fingerprint: "", key: "" });
  const editorHeading = useRef<HTMLHeadingElement>(null);
  const focusEditor = useRef(false);
  useEffect(() => {
    if (!draft || !focusEditor.current) return;
    focusEditor.current = false;
    editorHeading.current?.focus({ preventScroll: true });
    editorHeading.current?.scrollIntoView({
      block: "start",
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }, [draft]);
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/events", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Events could not be loaded");
    setWorkspace(payload);
    return payload as Workspace;
  }, []);
  useEffect(() => {
    let active = true;
    load().catch((cause) => {
      if (active) setError(cause.message);
    });
    return () => {
      active = false;
    };
  }, [load]);
  const selected = workspace?.events.find((event) => event.id === selectedId);
  const rows = (workspace?.orders ?? []).filter(
    (order) =>
      (!selectedId || order.event_id === selectedId) &&
      `${order.buyer_name} ${order.buyer_email} ${order.company} ${order.id}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  function choose(event: TicketEvent) {
    focusEditor.current = true;
    setSelectedId(event.id);
    setDraft(editor(event));
    setPrice((event.price_cents / 100).toFixed(2));
    setNotice("");
    setError("");
  }
  function create() {
    focusEditor.current = true;
    setSelectedId(crypto.randomUUID());
    const start = Date.now() + 7 * 86400000;
    setDraft(
      editor(
        workspace?.tenantSlug === "accelerate"
          ? WORKSHOP_EVENT
          : {
              ...WORKSHOP_EVENT,
              title: "",
              headline: "",
              description: "",
              slug: "new-workshop",
              venue_name: "",
              venue_address: "",
              refund_policy: "",
              support_description: "",
              starts_at: new Date(start).toISOString(),
              ends_at: new Date(start + 90 * 60000).toISOString(),
              refund_cutoff: new Date(start - 48 * 3600000).toISOString(),
            },
      ),
    );
    setPrice("50.00");
    setNotice("");
    setError("");
  }
  function change<K extends keyof EventDefinition>(key: K, value: EventDefinition[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : null));
  }
  async function command(payload: Record<string, unknown>) {
    const fingerprint = JSON.stringify(payload);
    if (attempt.current.fingerprint !== fingerprint)
      attempt.current = { fingerprint, key: crypto.randomUUID() };
    const response = await fetch("/api/admin/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, requestId: attempt.current.key }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Event operation failed");
    attempt.current = { fingerprint: "", key: "" };
    return body;
  }
  async function save(submission: React.FormEvent) {
    submission.preventDefault();
    if (!draft || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const amount = Number(price);
      if (!/^\d+(\.\d{1,2})?$/.test(price) || !Number.isFinite(amount))
        throw new Error("Enter a ticket price in dollars with at most two decimal places");
      const event = eventDefinitionSchema.parse({
        ...draft,
        price_cents: Math.round(amount * 100),
        starts_at: eventLocalToIso(draft.starts_at, draft.timezone),
        ends_at: eventLocalToIso(draft.ends_at, draft.timezone),
        refund_cutoff: eventLocalToIso(draft.refund_cutoff, draft.timezone),
      });
      await command({
        operation: "save_event",
        eventId: selectedId,
        revision: selected?.revision ?? 0,
        event,
      });
      const current = await load();
      const updated = current.events.find((item) => item.id === selectedId);
      if (updated) {
        setDraft(editor(updated));
        setPrice((updated.price_cents / 100).toFixed(2));
      }
      setNotice(
        "Event saved. New checkouts use this price; existing orders and checkout sessions retain their agreed amount.",
      );
    } catch (cause) {
      setError(
        cause instanceof ZodError
          ? cause.issues[0]?.message || "Review the event details before saving"
          : cause instanceof Error
            ? cause.message
            : "Event could not be saved",
      );
    } finally {
      setBusy(false);
    }
  }
  async function operate(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await command(payload);
      await load();
      setNotice(
        payload.operation === "reconcile"
          ? `Reservations checked.${result.result?.needsReview ? ` ${result.result.needsReview} reservation(s) need Stripe review because checkout creation has no recorded provider receipt.` : ""}`
          : "Confirmation receipt checked. Review the order’s confirmation status.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operation failed");
    } finally {
      setBusy(false);
    }
  }
  async function downloadOrders() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/events/export${selectedId && selected ? `?eventId=${selectedId}` : ""}`,
        { cache: "no-store" },
      );
      if (!response.ok)
        throw new Error((await response.json()).error || "Export could not be prepared");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "ticket-orders.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        subtitle="Manage workshop details, ticket sales, and buyer confirmations."
        actions={
          <button className={button} onClick={create} disabled={busy}>
            Create event draft
          </button>
        }
      />
      <BillingNavigation active="events" />
      {error && (
        <div className="admin-notice admin-notice--error" role="alert">
          {error}{" "}
          <button
            onClick={() => void load().catch((cause) => setError(cause.message))}
            className={button}
          >
            Reload saved data
          </button>
        </div>
      )}
      {notice && (
        <p className="admin-notice" role="status">
          {notice}
        </p>
      )}
      {workspace?.simulated && (
        <p className="admin-notice" role="status">
          Simulated workshop records. Edits and confirmations stay in this browser; public checkout
          and provider payments are unavailable.
        </p>
      )}
      {!workspace && !error && <p role="status">Loading events…</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {workspace?.events.map((event) => (
          <AdminSurface key={event.id} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide opacity-60">{event.status}</p>
                <h2 className="mt-1 text-lg font-semibold">{event.title}</h2>
                <p className="mt-2 text-sm opacity-70">
                  {eventTiming(event).date} · {eventTiming(event).time}
                </p>
              </div>
              <button className={button} onClick={() => choose(event)}>
                Edit
              </button>
            </div>
            <dl
              className="mt-5 grid grid-cols-3 gap-4 text-sm"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              <div>
                <dt className="opacity-60">Live paid tickets</dt>
                <dd className="mt-1 text-xl font-semibold">
                  {event.paid_tickets} / {event.capacity}
                </dd>
              </div>
              <div>
                <dt className="opacity-60">Reserved</dt>
                <dd className="mt-1 text-xl font-semibold">{event.reserved_tickets}</dd>
              </div>
              <div>
                <dt className="opacity-60">Available</dt>
                <dd className="mt-1 text-xl font-semibold">{event.available_tickets}</dd>
              </div>
              <div>
                <dt className="opacity-60">Admission</dt>
                <dd>{ticketMoney(event.price_cents)}</dd>
              </div>
              <div>
                <dt className="opacity-60">Gross sales</dt>
                <dd>{ticketMoney(Number(event.gross_cents ?? 0))}</dd>
              </div>
              <div>
                <dt className="opacity-60">Refunds</dt>
                <dd>{ticketMoney(Number(event.refunded_cents ?? 0))}</dd>
              </div>
            </dl>
            <div className="mt-5 flex flex-wrap gap-3">
              {!workspace?.simulated && workspace?.tenantSlug && (
                <a
                  className={button}
                  href={`${eventPath(workspace.tenantSlug, event.slug)}${event.status === "draft" ? "?preview=1" : ""}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {event.status === "draft" ? "Preview page" : "View page"}
                </a>
              )}
              <button
                className={button}
                disabled={busy}
                onClick={() => void operate({ operation: "reconcile", eventId: event.id })}
              >
                Reconcile reservations
              </button>
            </div>
          </AdminSurface>
        ))}
      </div>
      {workspace && !workspace.events.length && (
        <AdminSurface className="p-6">
          <h2 className="font-semibold">Create your first event.</h2>
          <p className="mt-2 text-sm opacity-70">
            Save a draft, confirm the details and Stripe connection, then publish when you are ready
            to sell tickets.
          </p>
        </AdminSurface>
      )}
      {draft && (
        <AdminSurface className="p-5 sm:p-6">
          <h2 ref={editorHeading} tabIndex={-1} className="scroll-mt-24 text-xl font-semibold">
            {selected ? "Edit event" : "New event draft"}
          </h2>
          <p className="mt-2 text-sm opacity-70">
            Dates use the event’s time zone. Publishing opens paid checkout. Capacity includes paid
            tickets and active reservations.
          </p>
          <form onSubmit={save} className="mt-5 grid gap-5 sm:grid-cols-2">
            {(
              [
                ["title", "Event name"],
                ["headline", "Page headline"],
                ["slug", "Page address"],
                ["venue_name", "Venue"],
                ["venue_address", "Street address"],
                ["timezone", "Time zone"],
              ] as const
            ).map(([key, label]) => (
              <label className="grid gap-2 text-sm" key={key}>
                {label}
                <input
                  className={field}
                  value={draft[key]}
                  onChange={(e) => change(key, e.target.value)}
                  required
                />
              </label>
            ))}
            {(
              [
                ["starts_at", "Start"],
                ["ends_at", "End"],
                ["refund_cutoff", "Refund request cutoff"],
              ] as const
            ).map(([key, label]) => (
              <label className="grid gap-2 text-sm" key={key}>
                {label}
                <input
                  className={field}
                  type="datetime-local"
                  value={draft[key]}
                  onChange={(e) => change(key, e.target.value)}
                  required
                />
              </label>
            ))}
            <label className="grid gap-2 text-sm">
              Ticket price (USD)
              <input
                className={field}
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </label>
            <label className="grid gap-2 text-sm">
              Ticket capacity
              <input
                className={field}
                type="number"
                min={1}
                max={10000}
                value={draft.capacity}
                onChange={(e) => change("capacity", Number(e.target.value))}
                required
              />
            </label>
            <label className="grid gap-2 text-sm">
              Sales status
              <select
                className={field}
                value={draft.status}
                onChange={(e) => change("status", e.target.value as EventDefinition["status"])}
              >
                <option value="draft">Draft</option>
                <option value="published">Published: open sales</option>
                <option value="paused">Paused: retain public page</option>
                <option value="closed">Closed: end sales</option>
              </select>
            </label>
            {(
              [
                ["description", "Workshop introduction"],
                ["refund_policy", "Refund policy"],
                ["support_description", "Optional support offer"],
              ] as const
            ).map(([key, label]) => (
              <label className="grid gap-2 text-sm sm:col-span-2" key={key}>
                {label}
                <textarea
                  className={field}
                  rows={3}
                  value={draft[key]}
                  onChange={(e) => change(key, e.target.value)}
                  required
                />
              </label>
            ))}
            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <button className="admin-button admin-button--primary" type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save event"}
              </button>
              <button
                className={button}
                type="button"
                onClick={() => setDraft(null)}
                disabled={busy}
              >
                Close editor
              </button>
            </div>
          </form>
        </AdminSurface>
      )}
      {workspace && (
        <AdminSurface className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Ticket orders</h2>
            <button className={button} onClick={() => void downloadOrders()} disabled={busy}>
              Export CSV
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <label className="grid flex-1 gap-2 text-sm">
              Search buyers or order references
              <input
                className={field}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                type="search"
              />
            </label>
            <label className="grid gap-2 text-sm">
              Event
              <select
                className={field}
                value={selectedId}
                onChange={(e) => {
                  setSelectedId(e.target.value);
                  setDraft(null);
                }}
              >
                <option value="">All events</option>
                {workspace.events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {workspace.truncated && (
            <p className="mt-3 text-sm" role="status">
              Showing the most recent 500 orders and up to 20 events. Totals above come from all
              event orders. Select an event to narrow exports.
            </p>
          )}
          <div className="mt-5 space-y-4">
            {rows.map((order) => (
              <article className="border-t border-current/10 pt-4" key={order.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">
                      {order.buyer_name} · {order.quantity}{" "}
                      {order.quantity === 1 ? "ticket" : "tickets"}
                    </h3>
                    <p className="mt-1 break-all text-sm opacity-70">
                      {order.buyer_email} · {order.state}
                      {order.livemode ? "" : " · TEST PAYMENT"}
                    </p>
                    <p className="mt-1 break-all text-xs opacity-60">{order.id}</p>
                  </div>
                  <div className="text-sm">
                    {ticketMoney(order.total_cents)}
                    {order.refund_cents > 0 && ` · ${ticketMoney(order.refund_cents)} refunded`}
                    <p className="mt-1 opacity-70">Confirmation: {order.email_status}</p>
                  </div>
                </div>
                {order.company && <p className="mt-2 text-sm">{order.company}</p>}
                {order.business_need && (
                  <p className="mt-1 text-sm opacity-70">{order.business_need}</p>
                )}
                {order.email_error && <p className="mt-2 text-sm">{order.email_error}</p>}
                <div className="mt-3 flex flex-wrap gap-3">
                  {order.state === "paid" && order.email_status !== "sent" && (
                    <button
                      className={button}
                      disabled={busy}
                      onClick={() =>
                        void operate({ operation: "retry_confirmation", orderId: order.id })
                      }
                    >
                      Retry confirmation
                    </button>
                  )}
                  {order.payment_intent_id && (
                    <a
                      className={button}
                      target="_blank"
                      rel="noopener noreferrer"
                      href={`https://dashboard.stripe.com/${order.livemode ? "" : "test/"}payments/${encodeURIComponent(order.payment_intent_id)}`}
                    >
                      Review payment or refund in Stripe
                    </a>
                  )}
                </div>
              </article>
            ))}
            {!rows.length && <p className="text-sm opacity-70">No orders match this view.</p>}
          </div>
        </AdminSurface>
      )}
    </div>
  );
}
