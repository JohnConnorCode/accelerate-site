import { z } from "zod";

export const planInputSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(500).default(""),
    currency: z.enum(["usd", "eur", "gbp", "cad", "aud"]),
    interval: z.enum(["month", "year"]),
    amount: z.number().int().positive().max(100000000),
  })
  .strict();

export const requestSchema = z.string().uuid();
export const stripeIdSchema = z.string().regex(/^(?:prod|price|cus|sub|cs)_[A-Za-z0-9]{1,80}$/);

export type PlanInput = z.infer<typeof planInputSchema>;
export type BillingPlan = PlanInput & {
  id: string;
  tenant_id: string;
  stripe_product_id: string;
  stripe_price_id: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type BillingSubscription = {
  id: string;
  tenant_id: string;
  user_id: string;
  plan_id: string | null;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  stripe_price_id: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  pending_plan_id: string | null;
  pending_change_at: string | null;
  plan?: Pick<BillingPlan, "name" | "currency" | "interval" | "amount"> | null;
};

export function formatPlanPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format(amount / 100);
}

export function formatPlanInterval(interval: string) {
  return interval === "year" ? "annual" : "monthly";
}

export function formatSubscriptionStatus(status: string) {
  const labels: Record<string, string> = {
    incomplete: "Checkout incomplete",
    incomplete_expired: "Checkout expired",
    trialing: "Trial",
    active: "Active",
    past_due: "Payment past due",
    canceled: "Canceled",
    unpaid: "Payment failed",
    paused: "Paused",
  };
  return labels[status] ?? "Needs review";
}

/** Accept only Stripe's HTTPS-hosted customer surfaces before redirecting. */
export function stripeHostedUrl(
  value: unknown,
  hostname: "checkout.stripe.com" | "billing.stripe.com",
) {
  if (typeof value !== "string" || !URL.canParse(value)) return null;
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== hostname ||
    url.port ||
    url.username ||
    url.password
  )
    return null;
  return url.toString();
}

export type SubscriptionStatusPresentation = {
  label: string;
  tone: "positive" | "warning" | "danger" | "neutral";
  detail: string;
  canCancel: boolean;
  canResume: boolean;
  canChange: boolean;
};

/** One customer-facing interpretation of each persisted Stripe state. */
export function subscriptionStatusPresentation(
  status: string,
  cancelAtPeriodEnd: boolean,
): SubscriptionStatusPresentation {
  if (status === "canceled" || status === "incomplete_expired")
    return {
      label: "Ended",
      tone: "neutral",
      detail: "This subscription is no longer active.",
      canCancel: false,
      canResume: false,
      canChange: false,
    };
  if (cancelAtPeriodEnd && ["active", "trialing", "past_due", "unpaid", "paused"].includes(status))
    return {
      label: "Cancels at renewal",
      tone: "warning",
      detail: "Your access continues through this period, then the subscription ends.",
      canCancel: false,
      canResume: true,
      canChange: false,
    };
  const states: Record<string, SubscriptionStatusPresentation> = {
    active: {
      label: "Renews automatically",
      tone: "positive",
      detail: "Your subscription is active and will renew automatically.",
      canCancel: true,
      canResume: false,
      canChange: true,
    },
    trialing: {
      label: "Trial in progress",
      tone: "positive",
      detail: "Your trial is active and will continue according to the plan terms.",
      canCancel: true,
      canResume: false,
      canChange: true,
    },
    incomplete: {
      label: "Checkout incomplete",
      tone: "warning",
      detail: "Stripe is waiting for checkout to finish.",
      canCancel: false,
      canResume: false,
      canChange: false,
    },
    past_due: {
      label: "Payment needs attention",
      tone: "danger",
      detail: "Update your payment method in Stripe to keep the subscription active.",
      canCancel: true,
      canResume: false,
      canChange: false,
    },
    unpaid: {
      label: "Payment needs attention",
      tone: "danger",
      detail: "Update your payment method in Stripe to keep the subscription active.",
      canCancel: true,
      canResume: false,
      canChange: false,
    },
    paused: {
      label: "Paused",
      tone: "warning",
      detail: "This subscription is paused. Payment changes are available in Stripe.",
      canCancel: true,
      canResume: false,
      canChange: false,
    },
  };
  return (
    states[status] ?? {
      label: "Needs review",
      tone: "neutral",
      detail: "The current subscription state needs review.",
      canCancel: false,
      canResume: false,
      canChange: false,
    }
  );
}

export function stripeObjectId(value: unknown, prefix: "prod" | "price" | "cus" | "sub" | "cs") {
  const parsed = z
    .string()
    .regex(new RegExp(`^${prefix}_[A-Za-z0-9]{1,80}$`))
    .safeParse(value);
  return parsed.success ? parsed.data : null;
}
