"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { distributionProfile } from "@/lib/distribution/profile";
import { ACCELERATE_TENANT_SLUG } from "@/lib/tenancy/constants";
import {
  eventCalendar,
  eventPath,
  eventTiming,
  ticketMoney,
  type EventDefinition,
} from "@/lib/revenue-os/event-ticketing-contract";
import styles from "./workshop.module.css";
type Receipt = {
  reference: string;
  quantity: number;
  totalCents: number;
  state: string;
  event: EventDefinition;
  emailStatus: string;
  testMode: boolean;
};
export function TicketConfirmation({
  tenantSlug,
  slug,
  orderId,
  orderKey,
}: {
  tenantSlug: string;
  slug: string;
  orderId: string;
  orderKey: string;
}) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  // The mount effect below runs the first status check immediately, so the
  // initial render is already busy. Keep the re-check control disabled until
  // that status is known, instead of briefly offering an enabled button.
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const endpoint = `/api/public/${encodeURIComponent(tenantSlug)}/events/${encodeURIComponent(slug)}`;
  const check = useCallback(
    async (signal?: AbortSignal) => {
      setBusy(true);
      setError("");
      try {
        const response = await fetch(
          `${endpoint}?order=${encodeURIComponent(orderId)}&key=${encodeURIComponent(orderKey)}`,
          { cache: "no-store", signal },
        );
        const payload = await response.json();
        if (!response.ok)
          throw new Error(payload.error || "Payment status is temporarily unavailable");
        setReceipt(payload);
      } catch (cause) {
        if (!signal?.aborted)
          setError(cause instanceof Error ? cause.message : "Please check again");
      } finally {
        if (!signal?.aborted) setBusy(false);
      }
    },
    [endpoint, orderId, orderKey],
  );
  useEffect(() => {
    const controller = new AbortController();
    void check(controller.signal);
    return () => controller.abort();
  }, [check]);
  async function saveContext(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          key: orderKey,
          company: fields.get("company"),
          businessNeed: fields.get("businessNeed"),
        }),
      });
      if (!response.ok)
        throw new Error((await response.json()).error || "Your answers could not be saved");
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again");
    } finally {
      setBusy(false);
    }
  }
  function calendar() {
    if (!receipt) return;
    const url = URL.createObjectURL(
      new Blob(
        [
          eventCalendar(
            receipt.testMode
              ? { ...receipt.event, title: `[Test] ${receipt.event.title}` }
              : receipt.event,
            receipt.reference,
          ),
        ],
        {
          type: "text/calendar;charset=utf-8",
        },
      ),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "workshop.ics";
    anchor.click();
    URL.revokeObjectURL(url);
  }
  const paid = receipt?.state === "paid";
  const when = receipt ? eventTiming(receipt.event) : null;
  return (
    <div className={styles.page}>
      <div className={`${styles.wrap} ${styles.confirmation}`}>
        <p className={styles.eyebrow}>Workshop registration</p>
        <h1>
          {paid
            ? receipt.testMode
              ? "Test registration complete."
              : "You’re registered."
            : receipt?.state === "refunded"
              ? "Your order has been refunded."
              : receipt?.state === "expired"
                ? "This reservation has expired."
                : "Checking your payment."}
        </h1>
        {receipt?.testMode && (
          <p className={styles.status} role="status">
            This was a Stripe test payment. No money was collected and no live admission is
            confirmed.
          </p>
        )}
        {paid && receipt && when ? (
          <>
            <p>
              {receipt.testMode
                ? `Your test order contains ${receipt.quantity} ticket(s) for`
                : receipt.quantity === 1
                  ? "One place is confirmed for"
                  : `${receipt.quantity} places are confirmed for`}{" "}
              <strong>{receipt.event.title}</strong>.
            </p>
            <dl className={styles.facts}>
              <div>
                <dt>When</dt>
                <dd>
                  {when.date}
                  <br />
                  {when.time}
                </dd>
              </div>
              <div>
                <dt>Where</dt>
                <dd>
                  {receipt.event.venue_name}
                  <br />
                  {receipt.event.venue_address}
                </dd>
              </div>
              <div>
                <dt>Order reference</dt>
                <dd className={styles.reference}>{receipt.reference}</dd>
              </div>
              <div>
                <dt>{receipt.testMode ? "Test amount" : "Total paid"}</dt>
                <dd>{ticketMoney(receipt.totalCents)}</dd>
              </div>
            </dl>
            <p>
              {receipt.emailStatus === "sent"
                ? "Your confirmation email has been sent, with a calendar attachment and refund details."
                : "The confirmation email still needs attention. Keep this order reference and contact us if the email does not arrive."}
            </p>
            <button className={styles.primary} onClick={calendar}>
              {receipt.testMode ? "Download test calendar" : "Add the workshop to your calendar"}
            </button>
            <section className={styles.section}>
              <h2>Help us make the examples useful.</h2>
              <p>
                Optional: tell us a little about your business and the work you would like AI to
                help with.
              </p>
              {saved ? (
                <p role="status">Thank you. Your answers are saved with your registration.</p>
              ) : (
                <form onSubmit={saveContext} className={styles.form}>
                  <label>
                    Company
                    <input name="company" maxLength={160} autoComplete="organization" />
                  </label>
                  <label>
                    What would you like to improve?
                    <textarea name="businessNeed" maxLength={1500} />
                  </label>
                  <button className={styles.primary} disabled={busy}>
                    {busy ? "Saving…" : "Save my answers"}
                  </button>
                </form>
              )}
            </section>
          </>
        ) : (
          <>
            <p>
              {receipt?.state === "refunded"
                ? "Admission on this order is no longer valid. Contact us if you have questions about the refund."
                : receipt?.state === "expired"
                  ? "No admission is confirmed for this reservation. You can return to the workshop to check availability."
                  : "A return from checkout is not payment confirmation. If you just paid, keep this page and check again. Please do not purchase again while your payment is being verified."}
            </p>
            <button className={styles.primary} onClick={() => void check()} disabled={busy}>
              {busy ? "Checking…" : "Check payment status"}
            </button>
          </>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <p>
          <Link href={eventPath(tenantSlug, slug)}>Workshop details</Link>
          {distributionProfile() === "branded" && tenantSlug === ACCELERATE_TENANT_SLUG && (
            <>
              {" "}
              · <a href="mailto:john@acceleratewith.us">Contact John</a>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
