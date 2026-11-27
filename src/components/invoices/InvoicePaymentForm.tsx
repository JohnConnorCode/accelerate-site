"use client";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock3, RefreshCw } from "lucide-react";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { money } from "@/lib/invoices/schema";

/** Ported from SuperDebate: one confirmation at a time, honest outcomes, and a
 * bank transfer reported as processing rather than paid. */
export function InvoicePaymentForm({ amount, email = "" }: { amount: number; email?: string }) {
  const stripe = useStripe(),
    elements = useElements();
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [fieldsReady, setFieldsReady] = useState(false);
  const [outcome, setOutcome] = useState<"confirmed" | "processing" | "unknown" | null>(null);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    if (outcome || error || (fieldsReady && !busy)) return;
    const timer = window.setTimeout(() => setSlow(true), busy ? 30_000 : 20_000);
    return () => window.clearTimeout(timer);
  }, [busy, fieldsReady, outcome, error]);
  useEffect(() => {
    if (outcome !== "confirmed" && outcome !== "processing") return;
    const timer = window.setTimeout(() => window.location.reload(), 1500);
    return () => window.clearTimeout(timer);
  }, [outcome]);
  async function pay(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements || !fieldsReady || submitting.current || outcome) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: "if_required",
      });
      if (result.error) {
        setError(result.error.message || "Payment could not be completed.");
        return;
      }
      const status = result.paymentIntent?.status;
      if (status === "succeeded") setOutcome("confirmed");
      else if (status === "processing") setOutcome("processing");
      else if (status === "requires_action")
        setError("Your bank verification was not completed. Try again to finish it.");
      else if (status === "requires_payment_method")
        setError("Payment was not completed. Check your details and try again.");
      else {
        setOutcome("unknown");
        setError(
          "Payment status could not be confirmed. Refresh your invoice before trying again.",
        );
      }
    } catch {
      setOutcome("unknown");
      setError("Payment could not be confirmed. Refresh your invoice before trying again.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <form onSubmit={(e) => void pay(e)} className="space-y-5" aria-busy={busy}>
      {!outcome && (
        <PaymentElement
          options={{
            layout: "tabs",
            ...(email ? { defaultValues: { billingDetails: { email } } } : {}),
          }}
          onReady={() => {
            setFieldsReady(true);
            setError("");
          }}
          onLoadError={() => {
            setFieldsReady(false);
            setError("Secure payment fields could not load. Refresh your invoice to try again.");
          }}
        />
      )}
      {!fieldsReady && !outcome && !error && (
        <p role="status" className="text-sm text-neutral-600">
          {slow
            ? "Secure payment fields are taking longer to load. You can refresh your invoice to try again."
            : "Loading secure payment fields…"}
        </p>
      )}
      {busy && slow && (
        <p role="status" className="text-sm text-neutral-600">
          Payment is still being checked. Complete any bank verification shown, or refresh your
          invoice. Please do not pay again.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-[10px] bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {(outcome === "confirmed" || outcome === "processing") && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-[10px] bg-emerald-50 p-3 text-sm text-neutral-900"
        >
          {outcome === "confirmed" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          {outcome === "confirmed"
            ? "Payment confirmed. Updating your invoice…"
            : "Your bank payment was submitted. It usually clears in about four business days. Please do not submit another payment."}
        </p>
      )}
      {!outcome && (
        <button
          type="submit"
          disabled={!stripe || !elements || !fieldsReady || busy}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-[12px] bg-neutral-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
        >
          {busy ? "Confirming payment…" : `Pay ${money(amount)} securely`}
        </button>
      )}
      {(outcome || error || slow) && <RefreshInvoice />}
      {!outcome && (
        <p className="text-center text-xs text-neutral-500">
          Payment details are handled securely by Stripe.
        </p>
      )}
    </form>
  );
}
export function RefreshInvoice({ label = "Refresh invoice" }: { label?: string }) {
  return (
    <button
      type="button"
      className="inline-flex min-h-11 w-full items-center justify-center rounded-[12px] border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
      onClick={() => window.location.reload()}
    >
      <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}
