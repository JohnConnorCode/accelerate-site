"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  eventPath,
  ticketMoney,
  stripeCheckoutClientSecretSchema,
} from "@/lib/revenue-os/event-ticketing-contract";
import styles from "./workshop.module.css";

type Session = {
  currency: string;
  canConfirm?: boolean;
  total: { total: { amount: string; minorUnitsAmount: number } };
};
type Actions = {
  getSession(): Session;
  confirm(options: {
    redirect: "if_required";
  }): Promise<
    { type: "success" } | { type: "error"; error: { code: string | null; message: string } }
  >;
};
type PaymentElement = {
  mount(target: HTMLElement): void;
  destroy(): void;
  on(event: "ready" | "loaderror" | "change", handler: () => void): void;
};
type Checkout = {
  loadActions(): Promise<
    { type: "success"; actions: Actions } | { type: "error"; error: { message: string } }
  >;
  createPaymentElement(options: Record<string, unknown>): PaymentElement;
  on(event: "change", handler: (session: Session) => void): void;
};
type StripeFactory = (key: string) => {
  initCheckout(options: Record<string, unknown>): Checkout;
};
type Details = {
  reference: string;
  quantity: number;
  totalCents: number;
  state: string;
  event: { title: string };
  buyerName: string;
  buyerEmail: string;
  clientSecret: string;
  publishableKey: string;
};

export function TicketPayment({
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
  const router = useRouter();
  const [details, setDetails] = useState<Details | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [version, setVersion] = useState(0);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const [error, setError] = useState("");
  const [liveTotal, setLiveTotal] = useState("");
  const [canConfirm, setCanConfirm] = useState(true);
  const target = useRef<HTMLDivElement>(null);
  const alert = useRef<HTMLParagraphElement>(null);
  const actions = useRef<Actions | null>(null);
  const submitting = useRef(false);
  const uncertain = useRef(false);
  const path = eventPath(tenantSlug, slug);
  const credential = new URLSearchParams({ order: orderId, key: orderKey });
  const confirmation = `${path}/confirmation?${credential}`;

  useEffect(() => {
    if (error) alert.current?.focus();
  }, [error]);
  useEffect(() => {
    if (ready) return;
    const timer = window.setTimeout(
      () => setError("Secure payment fields are taking longer to load. Reload them to try again."),
      20000,
    );
    return () => window.clearTimeout(timer);
  }, [ready, version]);

  useEffect(() => {
    const controller = new AbortController();
    try {
      if (sessionStorage.getItem(`ticket-payment-uncertain:${orderId}`) === "1") {
        router.replace(confirmation);
        return;
      }
    } catch {
      console.warn("[events] Payment recovery storage is unavailable");
    }
    const query = new URLSearchParams({ order: orderId, key: orderKey, payment: "1" });
    void (async () => {
      try {
        const response = await fetch(
          `/api/public/${encodeURIComponent(tenantSlug)}/events/${encodeURIComponent(slug)}?${query}`,
          {
            cache: "no-store",
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
          },
        );
        const payload = await response.json();
        if (!response.ok)
          throw new Error("Your order could not be loaded. Keep this page and retry.");
        if (["paid", "expired", "refunded"].includes(payload.state)) {
          router.replace(confirmation);
          return;
        }
        if (
          payload.reference !== orderId ||
          !Number.isSafeInteger(payload.totalCents) ||
          payload.totalCents < 1 ||
          !/^pk_(?:live|test)_[A-Za-z0-9]{10,200}$/.test(payload.publishableKey) ||
          !stripeCheckoutClientSecretSchema.safeParse(payload.clientSecret).success
        )
          throw new Error(
            "Secure payment fields are unavailable. Check this order before paying again.",
          );
        if (!controller.signal.aborted) setDetails(payload);
      } catch {
        if (!controller.signal.aborted)
          setError("Your order could not be loaded. Keep this page and reload the payment fields.");
      }
    })();
    return () => controller.abort();
  }, [tenantSlug, slug, orderId, orderKey, confirmation, version, router]);

  useEffect(() => {
    if (!details || !scriptReady || !target.current) return;
    let cancelled = false;
    let element: PaymentElement | undefined;
    const update = (session: Session) => {
      if (cancelled) return;
      if (session.currency !== "usd" || session.total.total.minorUnitsAmount !== details.totalCents)
        throw new Error("The payment total changed. Check this order before paying again.");
      setLiveTotal(session.total.total.amount);
      setCanConfirm(session.canConfirm !== false);
    };
    void (async () => {
      try {
        const Stripe = (window as Window & { Stripe?: StripeFactory }).Stripe;
        if (!Stripe) throw new Error("Secure payment fields did not load");
        const style = getComputedStyle(document.documentElement);
        const checkout = Stripe(details.publishableKey).initCheckout({
          clientSecret: details.clientSecret,
          elementsOptions: {
            appearance: {
              theme: "stripe",
              variables: {
                colorPrimary: style.getPropertyValue("--fg").trim() || "#171717",
                colorBackground: style.getPropertyValue("--bg").trim() || "#ffffff",
                colorText: style.getPropertyValue("--fg").trim() || "#171717",
                fontFamily: "Inter, system-ui, sans-serif",
                borderRadius: "8px",
              },
            },
          },
        });
        const loaded = await checkout.loadActions();
        if (cancelled) return;
        if (loaded.type === "error") throw new Error("Secure payment fields could not be prepared");
        update(loaded.actions.getSession());
        actions.current = loaded.actions;
        checkout.on("change", (session) => {
          try {
            update(session);
          } catch {
            actions.current = null;
            setReady(false);
            setError("The payment total changed. Check this order before paying again.");
          }
        });
        element = checkout.createPaymentElement({ layout: "tabs", wallets: { link: "never" } });
        element.on("ready", () => {
          if (cancelled) return;
          setReady(true);
          setError("");
        });
        element.on("loaderror", () => {
          if (cancelled) return;
          setReady(false);
          setError("Secure payment fields could not load. Reload them below. Your order is kept.");
        });
        element.on("change", () => {
          if (!cancelled && !submitting.current && !uncertain.current) setError("");
        });
        element.mount(target.current!);
      } catch {
        if (!cancelled) {
          setReady(false);
          setError("Secure payment fields could not load. Reload them below. Your order is kept.");
        }
      }
    })();
    return () => {
      cancelled = true;
      actions.current = null;
      element?.destroy();
    };
  }, [details, scriptReady]);

  function lockUncertainPayment() {
    uncertain.current = true;
    try {
      sessionStorage.setItem(`ticket-payment-uncertain:${orderId}`, "1");
    } catch {
      console.warn("[events] Payment recovery storage is unavailable");
    }
    setUnknown(true);
    setError("We could not confirm the payment result. Check this order before paying again.");
  }
  async function pay(event: React.FormEvent) {
    event.preventDefault();
    if (!actions.current || !ready || !canConfirm || uncertain.current || submitting.current)
      return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await actions.current.confirm({ redirect: "if_required" });
      if (result.type === "error") {
        if (result.error.code === "paymentFailed") setError(result.error.message);
        else lockUncertainPayment();
      } else router.replace(confirmation);
    } catch {
      lockUncertainPayment();
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <div className={styles.page}>
      <div className={styles.paymentWrap}>
        <Link href={path} className={styles.textLink}>
          Back to workshop
        </Link>
        <h1 className={styles.paymentTitle}>Complete your registration.</h1>
        {details && (
          <div className={styles.paymentSummary}>
            <h2>{details.event.title}</h2>
            <p>
              {details.quantity} {details.quantity === 1 ? "ticket" : "tickets"} ·{" "}
              {ticketMoney(details.totalCents)}
            </p>
            <p>
              For {details.buyerName}. Confirmation goes to {details.buyerEmail}.
            </p>
          </div>
        )}
        <Script
          src="https://js.stripe.com/clover/stripe.js"
          onReady={() => setScriptReady(true)}
          onError={() =>
            setError("Stripe could not load. Check your connection and reload this page.")
          }
        />
        <form onSubmit={pay} className={styles.form} aria-label="Workshop payment" aria-busy={busy}>
          {!ready && !error && <p role="status">Loading secure payment fields…</p>}
          <div ref={target} data-ticket-payment-fields />
          {error && (
            <p role="alert" tabIndex={-1} ref={alert} className={styles.checkoutError}>
              {error}
            </p>
          )}
          {unknown ? (
            <a href={confirmation} className={styles.primary}>
              Check this payment
            </a>
          ) : (
            <>
              <button
                type="submit"
                className={styles.primary}
                disabled={!ready || !canConfirm || busy}
              >
                {busy
                  ? "Checking payment…"
                  : `Pay ${liveTotal || (details ? ticketMoney(details.totalCents) : "securely")}`}
              </button>
              {error && (
                <button
                  type="button"
                  className={styles.textLink}
                  disabled={busy}
                  onClick={() => {
                    if (!scriptReady) {
                      window.location.reload();
                      return;
                    }
                    setDetails(null);
                    setReady(false);
                    setError("");
                    setVersion((v) => v + 1);
                  }}
                >
                  Reload secure payment fields
                </button>
              )}
            </>
          )}
          <p className={styles.small}>
            Card details go directly to Stripe. Your ticket is confirmed after we verify the
            payment.
          </p>
        </form>
      </div>
    </div>
  );
}
