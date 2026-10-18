"use client";
import { useRef, useState } from "react";
import { ticketMoney, type TicketEvent } from "@/lib/revenue-os/event-ticketing-contract";
import styles from "./workshop.module.css";

export function EventCheckout({
  event: initialEvent,
  tenantSlug,
  preview = false,
}: {
  event: TicketEvent;
  tenantSlug: string;
  preview?: boolean;
}) {
  const [event, setEvent] = useState(initialEvent);
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const attempt = useRef({ fingerprint: "", key: "" });
  const available = Math.min(40, event.available_tickets ?? event.capacity);
  const open =
    !preview &&
    event.status === "published" &&
    available > 0 &&
    Date.parse(event.starts_at) > Date.now();
  const endpoint = `/api/public/${encodeURIComponent(tenantSlug)}/events/${encodeURIComponent(event.slug)}`;
  async function purchase(submission: React.FormEvent<HTMLFormElement>) {
    submission.preventDefault();
    if (busy || !open) return;
    const form = new FormData(submission.currentTarget);
    const search = new URLSearchParams(window.location.search);
    const attribution = Object.fromEntries(
      ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].flatMap((key) =>
        search.get(key) ? [[key, search.get(key)!.slice(0, 160)]] : [],
      ),
    );
    const details = {
      name: String(form.get("name") || "").trim(),
      email: String(form.get("email") || "").trim(),
      quantity,
      revision: event.revision,
      attribution,
    };
    setBusy(true);
    setError("");
    try {
      const fingerprint = Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(details))),
        ),
      )
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      if (attempt.current.fingerprint !== fingerprint) {
        attempt.current = { fingerprint, key: crypto.randomUUID() };
        // Retain only a digest and opaque key across refresh/cancel. Buyer
        // names, emails and form answers are not persisted in browser storage.
        try {
          const storageKey = `ticket-checkout:${tenantSlug}:${event.id}`;
          const previous = JSON.parse(sessionStorage.getItem(storageKey) || "null");
          if (previous?.fingerprint === fingerprint && /^[0-9a-f-]{36}$/.test(previous.key))
            attempt.current.key = previous.key;
          sessionStorage.setItem(storageKey, JSON.stringify(attempt.current));
        } catch {
          /* Storage is optional; in-page retries still retain their key. */
        }
      }
      const response = await fetch(`${endpoint}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...details, requestId: attempt.current.key }),
      });
      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 409) {
          if (payload.restartCheckout === true) {
            attempt.current = { fingerprint: "", key: "" };
            try {
              sessionStorage.removeItem(`ticket-checkout:${tenantSlug}:${event.id}`);
            } catch {
              /* In-page recovery remains available if storage is blocked. */
            }
          }
          const refreshed = await fetch(endpoint, { cache: "no-store" });
          if (refreshed.ok) {
            const next = (await refreshed.json()).event as TicketEvent;
            setEvent(next);
            setQuantity((q) => Math.max(1, Math.min(q, next.available_tickets ?? q)));
          }
        }
        throw new Error(payload.error || "Checkout could not be started");
      }
      if (typeof payload.url !== "string")
        throw new Error("Checkout is unavailable. Your admission is not confirmed.");
      const url = new URL(payload.url);
      // A fresh private document cannot inherit marketing SDKs already loaded
      // on this public page. Its own chrome excludes those scripts.
      if (payload.confirmed && url.origin === window.location.origin)
        window.location.assign(url.href);
      else if (url.protocol === "https:" && url.hostname === "checkout.stripe.com")
        window.location.assign(url.href);
      else throw new Error("Checkout returned an unexpected address");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try checkout again");
    } finally {
      setBusy(false);
    }
  }
  return (
    <aside className={styles.checkout} id="tickets" aria-label="Workshop tickets">
      <div className={styles.checkoutHeader}>
        <p className={styles.eyebrow}>Your seat at the workshop</p>
        <div className={styles.price}>
          {ticketMoney(event.price_cents)}
          <span>per person</span>
        </div>
        <p>
          {event.capacity} places for practical questions, live demonstrations, and focused
          planning.
        </p>
      </div>
      {open ? (
        <form onSubmit={purchase} className={styles.form}>
          <label>
            Your name
            <input name="name" autoComplete="name" required maxLength={160} />
          </label>
          <label>
            Email address
            <input name="email" type="email" autoComplete="email" required maxLength={254} />
          </label>
          <label>
            Number of tickets
            <select value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}>
              {Array.from({ length: available }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                  {i === 0 ? " ticket" : " tickets"}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.total}>
            <span>Total</span>
            <strong>{ticketMoney(event.price_cents * quantity)}</strong>
          </div>
          <button type="submit" className={styles.primary} disabled={busy}>
            {busy
              ? "Opening secure checkout…"
              : `Get ${quantity === 1 ? "a ticket" : `${quantity} tickets`} (${ticketMoney(event.price_cents * quantity)})`}
          </button>
          <p className={styles.small}>
            Pay securely with Stripe. No account is needed. Tickets are confirmed after successful
            payment.
          </p>
        </form>
      ) : (
        <p className={styles.status} role="status">
          {preview
            ? "Preview only. Checkout opens after you publish the event."
            : event.status === "paused"
              ? "Ticket sales are paused. Please check back shortly."
              : available === 0
                ? "All places are currently purchased or reserved. Check back for released reservations."
                : "Ticket sales are closed."}
        </p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <details className={styles.refunds}>
        <summary>Refund policy</summary>
        <p>{event.refund_policy}</p>
      </details>
    </aside>
  );
}
