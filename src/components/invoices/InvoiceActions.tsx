"use client";
import { useEffect, useRef, useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { checkoutAppearance, getStripe } from "./stripe-client";
import { InvoicePaymentForm, RefreshInvoice } from "./InvoicePaymentForm";
import { InvoicePdfDownload } from "./InvoicePdfDownload";
import { money } from "@/lib/invoices/schema";

type PaymentDetails = {
  clientSecret: string;
  publishableKey: string;
  amountCents: number;
  email?: string;
};

/** Ported from SuperDebate. The payment opens only on request, against the
 * exact amount on the page; Stripe never creates an invoice. */
export function InvoiceActions({
  apiUrl,
  status,
  amount,
  preview = false,
  brandName,
  supportEmail = "",
  compact = false,
}: {
  apiUrl: string | null;
  status: string;
  amount: number;
  preview?: boolean;
  brandName: string;
  supportEmail?: string;
  compact?: boolean;
}) {
  const [payment, setPayment] = useState<PaymentDetails | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [latestStatus, setLatestStatus] = useState("");
  const loading = useRef(false);
  const currentStatus = latestStatus || status;
  const isDraft = currentStatus === "draft";
  const paymentReady = payment?.amountCents === amount;

  useEffect(() => {
    if (!latestStatus) return;
    const timer = window.setTimeout(() => window.location.reload(), 1500);
    return () => window.clearTimeout(timer);
  }, [latestStatus]);

  async function loadPayment() {
    if (preview || !apiUrl || loading.current) return;
    loading.current = true;
    setBusy(true);
    setError("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(apiUrl, { cache: "no-store", signal: controller.signal });
      const data = await response.json();
      if (!response.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "Payment is unavailable. Refresh your invoice to check its status.",
        );
        return;
      }
      if (["paid", "paid_external", "void", "processing"].includes(data.status)) {
        setLatestStatus(data.status);
        setPayment(null);
        return;
      }
      if (data.amountCents !== amount) {
        setError("The invoice amount changed. Refresh to review the latest details before paying.");
        return;
      }
      if (!data.clientSecret || !data.publishableKey) {
        setError("Secure payment could not open. Refresh your invoice or try again shortly.");
        return;
      }
      setPayment(data);
    } catch {
      setError(
        controller.signal.aborted
          ? "Secure payment is taking longer than expected. Refresh your invoice or try again shortly."
          : "Secure payment is temporarily unavailable. Refresh your invoice or try again shortly.",
      );
    } finally {
      window.clearTimeout(timeout);
      loading.current = false;
      setBusy(false);
    }
  }

  const title = isDraft
    ? "Pay your invoice"
    : currentStatus === "open"
      ? "Unpaid invoice"
      : currentStatus === "processing"
        ? "Payment processing"
        : currentStatus === "paid"
          ? "Paid"
          : currentStatus === "paid_external"
            ? "Paid externally"
            : "Invoice closed";
  const description = latestStatus
    ? "Updating the invoice record…"
    : isDraft
      ? "After this invoice is issued, the recipient can complete payment securely here."
      : currentStatus === "open"
        ? preview
          ? "The recipient can pay using their private invoice link. Payment is disabled in this preview."
          : "Pay securely below by bank transfer or card. This invoice updates after payment is confirmed."
        : currentStatus === "processing"
          ? "A bank payment was submitted and is clearing, usually within four business days. There is no need to pay again."
          : currentStatus === "paid_external" || currentStatus === "paid"
            ? "No further payment is due."
            : `This invoice is no longer payable. Contact ${brandName} with any questions.`;

  return (
    <section
      className="overflow-hidden rounded-[24px] border border-neutral-200 bg-white shadow-[0_2px_4px_#00000012,0_16px_40px_#00000014]"
      data-invoice-actions
      aria-label="Invoice payment"
      aria-busy={busy}
    >
      <div
        className={
          compact
            ? "grid gap-5 p-6"
            : "grid gap-6 p-6 sm:grid-cols-[minmax(0,1fr)_minmax(260px,1fr)] sm:gap-10 sm:p-9"
        }
      >
        <div>
          <h2 className="mt-0 text-[clamp(26px,3vw,34px)] font-semibold leading-tight tracking-[-.03em] text-neutral-950">
            {title}
          </h2>
          {description && (
            <p
              role={latestStatus ? "status" : undefined}
              className="mt-3 max-w-sm text-sm leading-6 text-neutral-600"
            >
              {description}
            </p>
          )}
          {latestStatus && (
            <div className="mt-4">
              <RefreshInvoice />
            </div>
          )}
          {supportEmail && (
            <a
              className="mt-3 inline-flex min-h-10 items-center text-sm underline underline-offset-2"
              href={`mailto:${supportEmail}`}
            >
              Questions? {supportEmail}
            </a>
          )}
        </div>
        {(isDraft || currentStatus === "open") && (
          <div className="self-center">
            {paymentReady && payment ? (
              <Elements
                stripe={getStripe(payment.publishableKey)}
                options={{ clientSecret: payment.clientSecret, appearance: checkoutAppearance }}
              >
                <InvoicePaymentForm amount={amount} email={payment.email} />
              </Elements>
            ) : (
              <button
                type="button"
                disabled={preview || busy || isDraft || !apiUrl}
                onClick={() => void loadPayment()}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-[12px] bg-neutral-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
              >
                {busy
                  ? "Opening secure payment…"
                  : isDraft
                    ? `Pay ${money(amount)} after issue`
                    : `Pay ${money(amount)}`}
              </button>
            )}
            {error && (
              <p role="alert" className="mt-3 rounded-[10px] bg-red-50 p-3 text-sm text-red-800">
                {error}
              </p>
            )}
            {error && (
              <div className="mt-3">
                <RefreshInvoice />
              </div>
            )}
          </div>
        )}
      </div>
      {!isDraft && apiUrl && (
        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-neutral-100 bg-neutral-50 px-6 py-4 text-sm sm:px-9">
          <span className="text-xs font-semibold uppercase tracking-[.14em] text-neutral-500">
            For your records
          </span>
          <InvoicePdfDownload pdfUrl={`${apiUrl}/pdf`} />
        </div>
      )}
    </section>
  );
}
