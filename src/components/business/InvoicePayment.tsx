"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { invoiceMoney } from "@/lib/revenue-os/invoice-contract";

type Elements = {
  create(kind: "payment", options: Record<string, unknown>): {
    mount(target: HTMLElement): void;
    destroy(): void;
    on(event: "ready" | "loaderror", handler: () => void): void;
  };
};
type StripeInstance = {
  elements(options: Record<string, unknown>): Elements;
  confirmPayment(options: Record<string, unknown>): Promise<{
    error?: { message?: string };
    paymentIntent?: { status: string };
  }>;
};
type StripeFactory = (key: string) => StripeInstance;
type Details =
  | { status: "open"; clientSecret: string; publishableKey: string; totalCents: number; email: string; name: string }
  | { status: string; clientSecret?: undefined };

/** Pays one invoice with Stripe's Payment Element (bank transfer or card).
 * This is a one-time payment on Stripe's payment rails, not a Stripe invoice. */
export function InvoicePayment({
  tenantSlug,
  token,
  accentColor,
}: {
  tenantSlug: string;
  token: string;
  accentColor: string;
}) {
  const [details, setDetails] = useState<Details | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<"paid" | "processing" | null>(null);
  const target = useRef<HTMLDivElement>(null);
  const stripe = useRef<StripeInstance | null>(null);
  const elements = useRef<Elements | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(
          `/api/public/${encodeURIComponent(tenantSlug)}/invoices/${encodeURIComponent(token)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Payment is unavailable");
        setDetails(payload);
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : "Payment is unavailable");
      }
    })();
    return () => controller.abort();
  }, [tenantSlug, token]);

  useEffect(() => {
    if (!details?.clientSecret || !scriptReady || !target.current) return;
    const factory = (window as unknown as { Stripe?: StripeFactory }).Stripe;
    if (!factory) {
      setError("Secure payment fields could not load. Reload this page to try again.");
      return;
    }
    stripe.current = factory(details.publishableKey);
    elements.current = stripe.current.elements({
      clientSecret: details.clientSecret,
      appearance: { theme: "stripe", variables: { colorPrimary: accentColor } },
    });
    const element = elements.current.create("payment", {
      layout: "tabs",
      defaultValues: { billingDetails: { email: details.email, name: details.name } },
    });
    element.on("ready", () => setReady(true));
    element.on("loaderror", () =>
      setError("Secure payment fields could not load. Reload this page to try again."),
    );
    element.mount(target.current);
    return () => element.destroy();
  }, [details, scriptReady, accentColor]);

  async function pay(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe.current || !elements.current || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await stripe.current.confirmPayment({
        elements: elements.current,
        confirmParams: { return_url: window.location.href },
        redirect: "if_required",
      });
      if (result.error) setError(result.error.message || "The payment could not be completed.");
      else if (result.paymentIntent?.status === "succeeded") setOutcome("paid");
      else if (result.paymentIntent?.status === "processing") setOutcome("processing");
      else setError("The payment was not completed. Check the details and try again.");
    } catch {
      setError("The payment status could not be confirmed. Reload this page before trying again.");
    } finally {
      setBusy(false);
    }
  }

  if (outcome)
    return (
      <p role="status" className="rounded-[4px] bg-white p-5 text-center text-sm text-black">
        {outcome === "paid"
          ? "Thank you. Your payment is confirmed."
          : "Thank you. Your bank payment was submitted and usually clears in about four business days. There is no need to pay again."}
      </p>
    );
  if (details && details.status !== "open")
    return details.status === "processing" ? (
      <p role="status" className="rounded-[4px] bg-white p-5 text-center text-sm text-black">
        A payment for this invoice is processing. There is no need to pay again.
      </p>
    ) : null;
  return (
    <form onSubmit={(e) => void pay(e)} className="rounded-[4px] bg-white p-6 text-black" aria-busy={busy}>
      <Script src="https://js.stripe.com/clover/stripe.js" onReady={() => setScriptReady(true)} />
      <h2 className="mb-4 text-lg font-semibold">Pay this invoice</h2>
      <div ref={target} />
      {!ready && !error && <p className="text-sm text-neutral-600">Loading secure payment options…</p>}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {details?.clientSecret && (
        <button
          type="submit"
          disabled={!ready || busy}
          className="mt-5 w-full rounded-[4px] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: accentColor }}
        >
          {busy ? "Confirming payment…" : `Pay ${invoiceMoney(details.totalCents)}`}
        </button>
      )}
      <p className="mt-3 text-center text-xs text-neutral-500">
        Payment details are handled securely by Stripe.
      </p>
    </form>
  );
}
