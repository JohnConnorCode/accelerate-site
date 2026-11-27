import { z } from "zod";

// Stripe also returns py_ identifiers for charge objects from non-card payments.
export const stripeChargeIdSchema = z.string().regex(/^(?:ch|py)_[A-Za-z0-9]{1,120}$/);
// Stripe charge units differ from some Intl/CLDR currency defaults, including
// MGA and HUF. ISK and UGX retain two-decimal API units despite integer display.
// https://docs.stripe.com/currencies#zero-decimal
const STRIPE_ZERO_DECIMAL = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "JPY",
  "KMF",
  "KRW",
  "MGA",
  "PYG",
  "RWF",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);

/** Missing provider facts remain unknown rather than fabricated balances. */
export function formatInvoiceAmount(amount: unknown, currency: unknown): string {
  if (
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    typeof currency !== "string" ||
    !/^[a-zA-Z]{3}$/.test(currency)
  )
    return "Unknown amount";
  const code = currency.toUpperCase();
  const zeroDecimal = STRIPE_ZERO_DECIMAL.has(code);
  const displayDigits = zeroDecimal || code === "ISK" || code === "UGX" ? 0 : 2;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: code,
    minimumFractionDigits: displayDigits,
    maximumFractionDigits: displayDigits,
  }).format(amount / (zeroDecimal ? 1 : 100));
}
