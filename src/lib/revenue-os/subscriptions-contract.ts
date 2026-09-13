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

export function stripeObjectId(value: unknown, prefix: "prod" | "price" | "cus" | "sub" | "cs") {
  const parsed = z.string().regex(new RegExp(`^${prefix}_[A-Za-z0-9]{1,80}$`)).safeParse(value);
  return parsed.success ? parsed.data : null;
}
