import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import { recordAudit } from "./audit";
import { tenantStripeClient } from "./stripe-adapter";
import {
  planInputSchema,
  requestSchema,
  stripeHostedUrl,
  stripeObjectId,
} from "./subscriptions-contract";

// Stripe responses are validated at the boundary where each field is used.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProviderObject = Record<string, any>;

function tenantId(db: SupabaseClient) {
  const id = tenantIdForDatabase(db);
  if (!id) throw new Error("Billing requires an explicit tenant context");
  return id;
}

function operationId(raw: string) {
  return requestSchema.parse(raw);
}

async function beginOperation(
  db: SupabaseClient,
  requestId: string,
  operation: string,
  actorId: string | null,
) {
  const key = operationId(requestId);
  const { data: existing } = await db
    .from("billing_operations")
    .select("*")
    .eq("request_id", key)
    .maybeSingle();
  if (existing) {
    if (existing.status === "succeeded") return { key, existing };
    throw new Error(
      "This billing request is already in progress; inspect its receipt before retrying",
    );
  }
  const { data, error } = await db
    .from("billing_operations")
    .insert({ request_id: key, operation, actor_id: actorId, status: "pending" })
    .select("*")
    .single();
  if (error || !data) throw new Error("Billing request could not be claimed");
  return { key, existing: data };
}

async function finishOperation(
  db: SupabaseClient,
  requestId: string,
  status: "succeeded" | "failed",
  result?: unknown,
  error?: string,
  providerId?: string,
) {
  await db
    .from("billing_operations")
    .update({
      status,
      result: result ?? null,
      error: error ?? null,
      provider_id: providerId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("request_id", requestId);
}

function providerId(value: unknown, prefix: "prod" | "price" | "cus" | "sub" | "cs") {
  const id = stripeObjectId(value, prefix);
  if (!id) throw new Error(`Stripe returned an invalid ${prefix} identifier`);
  return id;
}

function periodDate(value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) return null;
  const date = new Date(value * 1000);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function minorAmount(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function invoiceRecord(value: ProviderObject) {
  const id = z
    .string()
    .regex(/^in_[A-Za-z0-9]{1,80}$/)
    .parse(value.id);
  const currency = z
    .string()
    .regex(/^[a-z]{3}$/)
    .parse(value.currency)
    .toLowerCase();
  const hostedInvoiceUrl =
    typeof value.hosted_invoice_url === "string" && URL.canParse(value.hosted_invoice_url)
      ? (() => {
          const url = new URL(value.hosted_invoice_url);
          return url.protocol === "https:" &&
            url.hostname === "invoice.stripe.com" &&
            !url.port &&
            !url.username &&
            !url.password
            ? url.toString()
            : null;
        })()
      : null;
  return {
    id,
    status: typeof value.status === "string" ? value.status : "unknown",
    amountDue: minorAmount(value.amount_due),
    amountPaid: minorAmount(value.amount_paid),
    currency,
    created: periodDate(value.created),
    hostedInvoiceUrl,
  };
}

function subscriptionFields(value: ProviderObject) {
  const item = value.items?.data?.[0];
  return {
    stripeSubscriptionId: providerId(value.id, "sub"),
    stripeCustomerId: providerId(
      typeof value.customer === "string" ? value.customer : value.customer?.id,
      "cus",
    ),
    stripePriceId: providerId(item?.price?.id, "price"),
    status: z
      .enum([
        "incomplete",
        "incomplete_expired",
        "trialing",
        "active",
        "past_due",
        "canceled",
        "unpaid",
        "paused",
      ])
      .parse(value.status),
    currentPeriodStart: periodDate(value.current_period_start),
    currentPeriodEnd: periodDate(value.current_period_end),
    cancelAtPeriodEnd: value.cancel_at_period_end === true,
    itemId: typeof item?.id === "string" ? item.id : null,
  };
}

export async function listSubscriptionWorkspace(db: SupabaseClient) {
  tenantId(db);
  const [
    { data: plans, error: plansError },
    { data: subscriptions, error: subscriptionsError },
    { data: customers, error: customersError },
  ] = await Promise.all([
    db
      .from("billing_plans")
      .select(
        "id,name,description,currency,interval,amount,stripe_product_id,stripe_price_id,active,created_at,updated_at",
      )
      .order("created_at", { ascending: false }),
    db
      .from("billing_subscriptions")
      .select(
        "id,user_id,plan_id,stripe_subscription_id,stripe_customer_id,stripe_price_id,status,current_period_start,current_period_end,cancel_at_period_end,pending_plan_id,pending_change_at,created_at,updated_at,plan:billing_plans(name,currency,interval,amount)",
      )
      .order("updated_at", { ascending: false })
      .limit(200),
    db.from("billing_customers").select("user_id,email,name,stripe_customer_id"),
  ]);
  if (plansError || subscriptionsError || customersError)
    throw new Error("Subscription workspace could not be read");
  const customerByUser = new Map((customers ?? []).map((customer) => [customer.user_id, customer]));
  return {
    plans: plans ?? [],
    subscriptions: (subscriptions ?? []).map((subscription) => ({
      ...subscription,
      customer: customerByUser.get(subscription.user_id) ?? null,
    })),
  };
}

export async function createSubscriptionPlan(
  db: SupabaseClient,
  raw: unknown,
  requestId: string,
  actorEmail: string,
  actorId: string,
) {
  const input = planInputSchema.parse(raw);
  const { key, existing } = await beginOperation(db, requestId, "create_plan", actorId);
  if (existing.status === "succeeded") return existing.result;
  try {
    const client = await tenantStripeClient(db);
    const product = await client.createProduct(
      new URLSearchParams({
        name: input.name,
        description: input.description,
        "metadata[accelerate_tenant_id]": client.tenantId,
      }),
      `${key}:product`,
    );
    const productId = providerId(product.object.id, "prod");
    const price = await client.createPrice(
      new URLSearchParams({
        product: productId,
        currency: input.currency,
        unit_amount: String(input.amount),
        "recurring[interval]": input.interval,
        "metadata[accelerate_tenant_id]": client.tenantId,
      }),
      `${key}:price`,
    );
    const priceId = providerId(price.object.id, "price");
    const { data: plan, error } = await db
      .from("billing_plans")
      .insert({
        ...input,
        stripe_product_id: productId,
        stripe_price_id: priceId,
        created_by: actorEmail,
      })
      .select("*")
      .single();
    if (error || !plan)
      throw new Error(
        "Plan could not be saved after Stripe creation; reconcile the provider receipt",
      );
    await finishOperation(db, key, "succeeded", plan, undefined, priceId);
    await recordAudit(db, {
      actorEmail,
      action: "billing.plan_created",
      entityType: "billing_plan",
      entityId: plan.id,
      source: "admin",
      after: { ...input, stripeProductId: productId, stripePriceId: priceId },
    });
    return plan;
  } catch (error) {
    await finishOperation(
      db,
      key,
      "failed",
      undefined,
      error instanceof Error ? error.message : "Plan creation failed",
    );
    throw error;
  }
}

export async function archiveSubscriptionPlan(
  db: SupabaseClient,
  planId: string,
  requestId: string,
  actorEmail: string,
  actorId: string,
) {
  const { key, existing } = await beginOperation(db, requestId, "archive_plan", actorId);
  if (existing.status === "succeeded") return existing.result;
  let planPriceId: string | undefined;
  try {
    const client = await tenantStripeClient(db);
    const { data: plan, error } = await db
      .from("billing_plans")
      .select("*")
      .eq("id", z.uuid().parse(planId))
      .maybeSingle();
    if (error || !plan) throw new Error("Plan not found");
    planPriceId = plan.stripe_price_id;
    await client.updatePrice(
      providerId(plan.stripe_price_id, "price"),
      new URLSearchParams({ active: "false" }),
      `${key}:price`,
    );
    await client.updateProduct(
      providerId(plan.stripe_product_id, "prod"),
      new URLSearchParams({ active: "false" }),
      `${key}:product`,
    );
    const { data: archived, error: updateError } = await db
      .from("billing_plans")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", plan.id)
      .select("*")
      .single();
    if (updateError || !archived) throw new Error("Plan could not be archived");
    await finishOperation(db, key, "succeeded", archived, undefined, plan.stripe_price_id);
    await recordAudit(db, {
      actorEmail,
      action: "billing.plan_archived",
      entityType: "billing_plan",
      entityId: plan.id,
      source: "admin",
      before: { active: true },
      after: { active: false },
    });
    return archived;
  } catch (error) {
    await finishOperation(
      db,
      key,
      "failed",
      undefined,
      error instanceof Error ? error.message : "Plan archival failed",
      planPriceId,
    );
    throw error;
  }
}

async function getOrCreateCustomer(
  db: SupabaseClient,
  userId: string,
  email: string,
  name: string,
  requestId: string,
) {
  const { data: existing } = await db
    .from("billing_customers")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return existing;
  const client = await tenantStripeClient(db);
  const created = await client.createCustomer(
    new URLSearchParams({
      email,
      name,
      "metadata[accelerate_tenant_id]": client.tenantId,
      "metadata[accelerate_user_id]": userId,
    }),
    `${requestId}:customer`,
  );
  const customerId = providerId(created.object.id, "cus");
  const { data: customer, error } = await db
    .from("billing_customers")
    .insert({ user_id: userId, email: email.toLowerCase(), name, stripe_customer_id: customerId })
    .select("*")
    .single();
  if (error || !customer) {
    const { data: raced } = await db
      .from("billing_customers")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (raced) return raced;
    throw new Error("Billing customer could not be saved");
  }
  return customer;
}

export async function createSubscriptionCheckout(
  db: SupabaseClient,
  input: {
    planId: string;
    requestId: string;
    userId: string;
    email: string;
    name: string;
    origin: string;
    tenantSlug: string;
  },
) {
  const parsed = z
    .object({
      planId: z.uuid(),
      requestId: z.uuid(),
      userId: z.uuid(),
      email: z.email(),
      name: z.string().trim().max(160),
      origin: z.string().url(),
      tenantSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    })
    .parse(input);
  const { key, existing } = await beginOperation(db, parsed.requestId, "checkout", parsed.userId);
  if (existing.status === "succeeded") return existing.result;
  try {
    const client = await tenantStripeClient(db);
    const { data: plan, error } = await db
      .from("billing_plans")
      .select("*")
      .eq("id", parsed.planId)
      .eq("active", true)
      .maybeSingle();
    if (error || !plan) throw new Error("This plan is no longer available");
    const customer = await getOrCreateCustomer(db, parsed.userId, parsed.email, parsed.name, key);
    const customerId = providerId(customer.stripe_customer_id, "cus");
    const priceId = providerId(plan.stripe_price_id, "price");
    const body = new URLSearchParams({
      mode: "subscription",
      customer: customerId,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      client_reference_id: parsed.userId,
      "metadata[accelerate_tenant_id]": client.tenantId,
      "metadata[accelerate_user_id]": parsed.userId,
      "metadata[accelerate_plan_id]": plan.id,
      "subscription_data[metadata][accelerate_tenant_id]": client.tenantId,
      "subscription_data[metadata][accelerate_user_id]": parsed.userId,
      "subscription_data[metadata][accelerate_plan_id]": plan.id,
      success_url: `${parsed.origin}/t/${parsed.tenantSlug}/account?checkout=success`,
      cancel_url: `${parsed.origin}/t/${parsed.tenantSlug}/subscribe?checkout=cancelled`,
    });
    const session = await client.checkoutSession(body, `${key}:checkout`);
    const result = {
      url: stripeHostedUrl(session.object.url, "checkout.stripe.com"),
      sessionId: providerId(session.object.id, "cs"),
    };
    if (!result.url) throw new Error("Stripe did not return a checkout URL");
    await finishOperation(db, key, "succeeded", result, undefined, result.sessionId);
    return result;
  } catch (error) {
    await finishOperation(
      db,
      key,
      "failed",
      undefined,
      error instanceof Error ? error.message : "Checkout failed",
    );
    throw error;
  }
}

export async function readCustomerBilling(db: SupabaseClient, userId: string) {
  const id = tenantId(db);
  const { data: customer } = await db
    .from("billing_customers")
    .select("id,email,name,stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  const { data: subscriptions, error } = await db
    .from("billing_subscriptions")
    .select(
      "id,plan_id,stripe_subscription_id,stripe_price_id,status,current_period_start,current_period_end,cancel_at_period_end,pending_plan_id,pending_change_at,plan:billing_plans(name,description,currency,interval,amount)",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error("Subscription history could not be read");
  const { data: plans, error: plansError } = await db
    .from("billing_plans")
    .select("id,name,description,currency,interval,amount")
    .eq("active", true)
    .order("amount");
  if (plansError) throw new Error("Available plans could not be read");
  let invoices: unknown[] = [];
  let providerError: string | null = null;
  if (customer) {
    try {
      const client = await tenantStripeClient(db);
      const response = await client.customerInvoices(
        providerId(customer.stripe_customer_id, "cus"),
      );
      invoices = Array.isArray(response.object.data)
        ? response.object.data.slice(0, 20).map((invoice: ProviderObject) => invoiceRecord(invoice))
        : [];
    } catch (error) {
      console.error(
        "[billing] invoice history unavailable:",
        error instanceof Error ? error.message : error,
      );
      providerError = "Invoice history is temporarily unavailable.";
    }
  }
  return {
    tenantId: id,
    customer,
    subscriptions: subscriptions ?? [],
    plans: plans ?? [],
    invoices,
    providerError,
  };
}

export async function updateCustomerSubscription(
  db: SupabaseClient,
  userId: string,
  subscriptionId: string,
  action: "cancel" | "resume" | "change",
  planId: string | null,
  requestId: string,
  actorEmail = userId,
) {
  const parsed = z
    .object({
      subscriptionId: z.string().regex(/^sub_[A-Za-z0-9]{1,80}$/),
      planId: z.uuid().nullable(),
    })
    .parse({ subscriptionId, planId });
  const { key, existing } = await beginOperation(
    db,
    requestId,
    action === "change" ? "change_plan" : action,
    userId,
  );
  if (existing.status === "succeeded") return existing.result;
  try {
    const { data: sub } = await db
      .from("billing_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .eq("stripe_subscription_id", parsed.subscriptionId)
      .maybeSingle();
    if (!sub) throw new Error("Subscription not found");
    const client = await tenantStripeClient(db);
    if (action === "change") {
      if (!parsed.planId) throw new Error("Choose a plan");
      if (!sub.plan_id) throw new Error("Current plan details are unavailable");
      const [
        { data: nextPlan, error: nextPlanError },
        { data: currentPlan, error: currentPlanError },
      ] = await Promise.all([
        db.from("billing_plans").select("id,active,currency").eq("id", parsed.planId).maybeSingle(),
        db.from("billing_plans").select("currency").eq("id", sub.plan_id).maybeSingle(),
      ]);
      if (nextPlanError || currentPlanError) throw new Error("Plan details could not be read");
      if (!nextPlan?.active) throw new Error("That plan is no longer available");
      if (currentPlan && nextPlan.currency !== currentPlan.currency)
        throw new Error("Plan changes must keep the same currency as the current subscription");
      const { data: updated, error } = await db
        .from("billing_subscriptions")
        .update({
          pending_plan_id: parsed.planId,
          pending_change_at: sub.current_period_end,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.id)
        .select("*")
        .single();
      if (error || !updated) throw new Error("Plan change could not be scheduled");
      await finishOperation(db, key, "succeeded", updated, undefined, parsed.subscriptionId);
      await recordAudit(db, {
        actorEmail,
        action: "billing.plan_change_scheduled",
        entityType: "billing_subscription",
        entityId: sub.id,
        source: "public",
        after: { pendingPlanId: parsed.planId, effectiveAt: sub.current_period_end },
      }).catch((error) => {
        console.error(
          "[billing] plan-change audit write failed:",
          error instanceof Error ? error.message : error,
        );
      });
      return updated;
    }
    const result = await client.updateSubscription(
      parsed.subscriptionId,
      new URLSearchParams({ cancel_at_period_end: action === "cancel" ? "true" : "false" }),
      `${key}:subscription`,
    );
    const fields = subscriptionFields(result.object);
    const { data: updated, error } = await db
      .from("billing_subscriptions")
      .update({
        status: fields.status,
        cancel_at_period_end: fields.cancelAtPeriodEnd,
        current_period_start: fields.currentPeriodStart,
        current_period_end: fields.currentPeriodEnd,
        ...(action === "cancel" ? { pending_plan_id: null, pending_change_at: null } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.id)
      .select("*")
      .single();
    if (error || !updated) throw new Error("Subscription status could not be saved");
    await finishOperation(db, key, "succeeded", updated, undefined, parsed.subscriptionId);
    await recordAudit(db, {
      actorEmail,
      action:
        action === "cancel"
          ? "billing.subscription_cancel_scheduled"
          : "billing.subscription_resumed",
      entityType: "billing_subscription",
      entityId: sub.id,
      source: "public",
      after: { cancelAtPeriodEnd: fields.cancelAtPeriodEnd },
    }).catch((error) => {
      console.error(
        "[billing] subscription audit write failed:",
        error instanceof Error ? error.message : error,
      );
    });
    return updated;
  } catch (error) {
    await finishOperation(
      db,
      key,
      "failed",
      undefined,
      error instanceof Error ? error.message : "Subscription update failed",
      parsed.subscriptionId,
    );
    throw error;
  }
}

export function verifyStripeSignature(body: string, signature: string, secret: string) {
  const values = new Map<string, string>();
  for (const part of signature.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key && value && !values.has(key)) values.set(key, value);
  }
  const timestamp = Number(values.get("t"));
  const received = values.get("v1");
  if (
    !Number.isSafeInteger(timestamp) ||
    !received ||
    Math.abs(Date.now() / 1000 - timestamp) > 300
  )
    return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return (
    expected.length === received.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(received))
  );
}

export async function processStripeWebhook(db: SupabaseClient, event: ProviderObject) {
  const eventId = z
    .string()
    .regex(/^evt_[A-Za-z0-9]{1,80}$/)
    .parse(event.id);
  const eventType = z.string().min(1).max(120).parse(event.type);
  const { data: existing } = await db
    .from("billing_webhook_events")
    .select("status")
    .eq("event_id", eventId)
    .maybeSingle();
  if (existing?.status === "processed") return { duplicate: true };
  if (!existing) {
    const { error } = await db
      .from("billing_webhook_events")
      .insert({ event_id: eventId, event_type: eventType, status: "processing" });
    if (error) {
      const { data: race } = await db
        .from("billing_webhook_events")
        .select("status")
        .eq("event_id", eventId)
        .maybeSingle();
      if (race?.status === "processed") return { duplicate: true };
      throw new Error("Webhook receipt could not be claimed");
    }
  } else {
    await db
      .from("billing_webhook_events")
      .update({ status: "processing", error: null })
      .eq("event_id", eventId);
  }
  try {
    const object = event.data?.object as ProviderObject;
    const client = await tenantStripeClient(db);
    if (typeof event.livemode === "boolean" && event.livemode !== (client.mode === "live"))
      throw new Error("Stripe event mode does not match this workspace connection");
    const metadata = object?.metadata as Record<string, string> | undefined;
    if (eventType === "checkout.session.completed") {
      if (
        object.mode !== "subscription" ||
        !metadata?.accelerate_user_id ||
        !metadata.accelerate_plan_id
      )
        throw new Error("Subscription checkout metadata is incomplete");
      if (metadata.accelerate_tenant_id !== tenantId(db))
        throw new Error("Subscription checkout belongs to another workspace");
      const subscriptionId = providerId(
        typeof object.subscription === "string" ? object.subscription : object.subscription?.id,
        "sub",
      );
      const subscriptionResponse = await client.subscription(subscriptionId);
      const fields = subscriptionFields(subscriptionResponse.object);
      const { data: checkoutPlan, error: checkoutPlanError } = await db
        .from("billing_plans")
        .select("id,stripe_price_id")
        .eq("id", z.uuid().parse(metadata.accelerate_plan_id))
        .maybeSingle();
      if (
        checkoutPlanError ||
        !checkoutPlan ||
        checkoutPlan.stripe_price_id !== fields.stripePriceId
      )
        throw new Error("Subscription checkout plan does not match this workspace");
      const customerResponse = await client.customer(fields.stripeCustomerId);
      const customerObject = customerResponse.object;
      const customerEmail =
        typeof customerObject.email === "string"
          ? customerObject.email.toLowerCase()
          : typeof object.customer_details?.email === "string"
            ? object.customer_details.email.toLowerCase()
            : "unknown@example.invalid";
      const customerName =
        typeof customerObject.name === "string"
          ? customerObject.name
          : typeof object.customer_details?.name === "string"
            ? object.customer_details.name
            : "";
      const { error: customerError } = await db.from("billing_customers").upsert(
        {
          user_id: z.uuid().parse(metadata.accelerate_user_id),
          email: customerEmail,
          name: customerName,
          stripe_customer_id: fields.stripeCustomerId,
        },
        { onConflict: "tenant_id,user_id" },
      );
      if (customerError) throw new Error("Billing customer could not be saved");
      const { error: subscriptionError } = await db.from("billing_subscriptions").upsert(
        {
          user_id: z.uuid().parse(metadata.accelerate_user_id),
          plan_id: z.uuid().parse(metadata.accelerate_plan_id),
          stripe_subscription_id: fields.stripeSubscriptionId,
          stripe_customer_id: fields.stripeCustomerId,
          stripe_price_id: fields.stripePriceId,
          status: fields.status,
          current_period_start: fields.currentPeriodStart,
          current_period_end: fields.currentPeriodEnd,
          cancel_at_period_end: fields.cancelAtPeriodEnd,
        },
        { onConflict: "tenant_id,stripe_subscription_id" },
      );
      if (subscriptionError) throw new Error("Subscription could not be saved");
    } else if (
      [
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
      ].includes(eventType)
    ) {
      const fields = subscriptionFields(object);
      const { data: current } = await db
        .from("billing_subscriptions")
        .select("id,pending_plan_id,plan_id")
        .eq("stripe_subscription_id", fields.stripeSubscriptionId)
        .maybeSingle();
      if (current) {
        await db
          .from("billing_subscriptions")
          .update({
            stripe_customer_id: fields.stripeCustomerId,
            stripe_price_id: fields.stripePriceId,
            status: eventType.endsWith("deleted") ? "canceled" : fields.status,
            current_period_start: fields.currentPeriodStart,
            current_period_end: fields.currentPeriodEnd,
            cancel_at_period_end: fields.cancelAtPeriodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq("id", current.id);
      }
    } else if (eventType === "invoice.paid" || eventType === "invoice.payment_failed") {
      const subscriptionId =
        typeof object.subscription === "string" ? object.subscription : object.subscription?.id;
      if (subscriptionId) {
        const { data: current } = await db
          .from("billing_subscriptions")
          .select("id,pending_plan_id")
          .eq("stripe_subscription_id", subscriptionId)
          .maybeSingle();
        if (current) {
          await db
            .from("billing_subscriptions")
            .update({
              status: eventType === "invoice.paid" ? "active" : "past_due",
              updated_at: new Date().toISOString(),
            })
            .eq("id", current.id);
          if (eventType === "invoice.paid" && current.pending_plan_id) {
            const client = await tenantStripeClient(db);
            const { data: nextPlan } = await db
              .from("billing_plans")
              .select("stripe_price_id")
              .eq("id", current.pending_plan_id)
              .maybeSingle();
            const stripeSubscription = await client.subscription(subscriptionId);
            const stripeSubscriptionObject = stripeSubscription.object as ProviderObject;
            const itemId = stripeSubscriptionObject.items?.data?.[0]?.id;
            if (nextPlan && typeof itemId === "string") {
              await client.updateSubscription(
                subscriptionId,
                new URLSearchParams({
                  "items[0][id]": itemId,
                  "items[0][price]": nextPlan.stripe_price_id,
                  proration_behavior: "none",
                }),
                `invoice:${eventId}:plan`,
              );
              await db
                .from("billing_subscriptions")
                .update({
                  plan_id: current.pending_plan_id,
                  pending_plan_id: null,
                  pending_change_at: null,
                  stripe_price_id: nextPlan.stripe_price_id,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", current.id);
            }
          }
        }
      }
    }
    await db
      .from("billing_webhook_events")
      .update({ status: "processed", processed_at: new Date().toISOString(), error: null })
      .eq("event_id", eventId);
    return { processed: true };
  } catch (error) {
    await db
      .from("billing_webhook_events")
      .update({
        status: "failed",
        error: error instanceof Error ? error.message : "Webhook processing failed",
      })
      .eq("event_id", eventId);
    throw error;
  }
}
