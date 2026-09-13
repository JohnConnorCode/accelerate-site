#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { formatPlanPrice, planInputSchema, stripeObjectId } from "../src/lib/revenue-os/subscriptions-contract";
import {
  createSubscriptionCheckout,
  createSubscriptionPlan,
  processStripeWebhook,
  readCustomerBilling,
  updateCustomerSubscription,
  verifyStripeSignature,
} from "../src/lib/revenue-os/subscriptions";
import { AuthorizedMemorySupabase } from "./lib/autonomy-fixture";
import { bindTenantDatabaseForTest } from "../src/lib/supabase/server";
import { encryptTenantSecret } from "../src/lib/revenue-os/encryption";

const plan = planInputSchema.parse({ name: "Core", currency: "usd", interval: "month", amount: 25000 });
assert.equal(plan.description, "");
assert.equal(formatPlanPrice(plan.amount, plan.currency), "$250.00");
assert.equal(stripeObjectId("price_123", "price"), "price_123");
assert.equal(stripeObjectId("sub_123", "price"), null);
assert.throws(() => planInputSchema.parse({ name: "", currency: "usd", interval: "month", amount: 10 }));

const body = JSON.stringify({ id: "evt_test" });
const timestamp = Math.floor(Date.now() / 1000);
const secret = "whsec_subscription_test";
const digest = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
const signature = `t=${timestamp},v1=${digest},v0=ignored`;
assert.equal(verifyStripeSignature(body, signature, secret), true);
assert.equal(verifyStripeSignature(`${body}x`, signature, secret), false);
assert.equal(verifyStripeSignature(body, `t=${timestamp - 301},v1=${digest}`, secret), false);
assert.equal(verifyStripeSignature(body, "v1=bad", secret), false);

async function serviceFlow() {
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "subscription-service-test-key";
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const userId = "22222222-2222-4222-8222-222222222222";
  const actorId = "33333333-3333-4333-8333-333333333333";
  const apiKey = "rk_test_subscriptionfixture1234567890";
  const providerSubscription = {
    id: "sub_fixturetest",
    customer: "cus_fixturetest",
    status: "active",
    current_period_start: 1_758_000_000,
    current_period_end: 1_760_600_000,
    cancel_at_period_end: false,
    items: { data: [{ id: "si_fixturetest", price: { id: "price_fixturecore" } }] },
  };
  const mem = new AuthorizedMemorySupabase({
    tenants: [{ id: tenantId, name: "Subscription fixture", status: "active", config: { modules: { "stripe-invoicing": true } } }],
    integration_connections: [{
      id: "44444444-4444-4444-8444-444444444444",
      tenant_id: tenantId,
      provider: "stripe",
      status: "connected",
      credential_version: 1,
      account_email: "acct_fixture",
      encrypted_credentials: { api_key: encryptTenantSecret(apiKey, tenantId, "stripe", "api_key") },
    }],
  });
  mem.idFactory = () => crypto.randomUUID();
  const db = bindTenantDatabaseForTest(mem.client, tenantId);
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const parsed = new URL(String(url));
    assert.equal(parsed.origin, "https://api.stripe.com");
    assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer ${apiKey}`);
    calls.push(`${init?.method ?? "GET"} ${parsed.pathname}`);
    const body = new URLSearchParams(String(init?.body ?? ""));
    const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
      status,
      headers: { "Content-Type": "application/json", "Request-Id": "req_subscription_fixture" },
    });
    if (parsed.pathname === "/v1/products" && init?.method === "POST")
      return json({ id: body.get("name") === "Plus" ? "prod_fixtureplus" : "prod_fixturecore", object: "product" });
    if (parsed.pathname === "/v1/prices" && init?.method === "POST")
      return json({ id: body.get("product") === "prod_fixtureplus" ? "price_fixtureplus" : "price_fixturecore", object: "price" });
    if (parsed.pathname === "/v1/customers" && init?.method === "POST")
      return json({ id: "cus_fixturetest", object: "customer", email: body.get("email"), name: body.get("name") });
    if (parsed.pathname === "/v1/checkout/sessions" && init?.method === "POST")
      return json({ id: "cs_fixturetest", object: "checkout.session", url: "https://checkout.stripe.com/c/pay/fixture" });
    if (parsed.pathname === "/v1/customers/cus_fixturetest" && init?.method !== "POST")
      return json({ id: "cus_fixturetest", object: "customer", email: "buyer@example.com", name: "Fixture Buyer" });
    if (parsed.pathname === "/v1/invoices" && init?.method !== "POST")
      return json({ object: "list", data: [] });
    if (parsed.pathname === "/v1/subscriptions/sub_fixturetest" && init?.method !== "POST")
      return json(providerSubscription);
    if (parsed.pathname === "/v1/subscriptions/sub_fixturetest" && init?.method === "POST") {
      if (body.get("cancel_at_period_end")) providerSubscription.cancel_at_period_end = body.get("cancel_at_period_end") === "true";
      const nextPrice = body.get("items[0][price]");
      if (nextPrice) providerSubscription.items.data[0]!.price.id = nextPrice;
      return json(providerSubscription);
    }
    throw new Error(`Unexpected Stripe fixture request: ${init?.method ?? "GET"} ${parsed.pathname}`);
  };
  try {
    const coreRequest = crypto.randomUUID();
    const core = await createSubscriptionPlan(db, { name: "Core", currency: "usd", interval: "month", amount: 2500 }, coreRequest, "owner@example.com", actorId);
    const coreRow = mem.rows("billing_plans").find((row) => row.id === core.id);
    assert.ok(coreRow);
    coreRow.active = true;
    const coreAgain = await createSubscriptionPlan(db, { name: "Core", currency: "usd", interval: "month", amount: 2500 }, coreRequest, "owner@example.com", actorId);
    assert.equal(coreAgain.id, core.id);
    const plus = await createSubscriptionPlan(db, { name: "Plus", currency: "usd", interval: "month", amount: 5000 }, crypto.randomUUID(), "owner@example.com", actorId);
    const plusRow = mem.rows("billing_plans").find((row) => row.id === plus.id);
    assert.ok(plusRow);
    plusRow.active = true;
    const checkoutInput = { planId: core.id as string, requestId: crypto.randomUUID(), userId, email: "Buyer@Example.com", name: "Fixture Buyer", origin: "https://accelerate.example", tenantSlug: "fixture" };
    const checkout = await createSubscriptionCheckout(db, checkoutInput);
    assert.deepEqual(await createSubscriptionCheckout(db, checkoutInput), checkout);
    assert.equal(mem.rows("billing_customers").length, 1);
    const event = {
      id: "evt_checkoutfixture",
      type: "checkout.session.completed",
      livemode: false,
      data: { object: { mode: "subscription", subscription: "sub_fixturetest", customer: "cus_fixturetest", metadata: { accelerate_tenant_id: tenantId, accelerate_user_id: userId, accelerate_plan_id: core.id } } },
    };
    await assert.rejects(
      () => processStripeWebhook(db, { ...event, id: "evt_wrongtenant", data: { object: { ...event.data.object, metadata: { ...event.data.object.metadata, accelerate_tenant_id: "99999999-9999-4999-8999-999999999999" } } } }),
      /another workspace/,
    );
    assert.equal(mem.rows("billing_webhook_events").find((row) => row.event_id === "evt_wrongtenant")?.status, "failed");
    assert.deepEqual(await processStripeWebhook(db, event), { processed: true });
    assert.deepEqual(await processStripeWebhook(db, event), { duplicate: true });
    const billing = await readCustomerBilling(db, userId);
    assert.equal(billing.customer?.email, "buyer@example.com");
    assert.equal(billing.subscriptions.length, 1);
    const subscriptionId = "sub_fixturetest";
    const cancel = await updateCustomerSubscription(db, userId, subscriptionId, "cancel", null, crypto.randomUUID(), "buyer@example.com");
    assert.equal(cancel.cancel_at_period_end, true);
    const resume = await updateCustomerSubscription(db, userId, subscriptionId, "resume", null, crypto.randomUUID(), "buyer@example.com");
    assert.equal(resume.cancel_at_period_end, false);
    const scheduled = await updateCustomerSubscription(db, userId, subscriptionId, "change", plus.id as string, crypto.randomUUID(), "buyer@example.com");
    assert.equal(scheduled.pending_plan_id, plus.id);
    await processStripeWebhook(db, { id: "evt_invoicefixture", type: "invoice.paid", livemode: false, data: { object: { subscription: subscriptionId } } });
    const afterChange = mem.rows("billing_subscriptions").find((row) => row.stripe_subscription_id === subscriptionId)!;
    assert.equal(afterChange.plan_id, plus.id);
    assert.equal(afterChange.pending_plan_id, null);
    assert.equal(providerSubscription.items.data[0]!.price.id, "price_fixtureplus");
    assert.ok(calls.includes("POST /v1/checkout/sessions"));
    assert.ok(mem.rows("audit_log").some((row) => row.action === "billing.subscription_cancel_scheduled"));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

void serviceFlow()
  .then(() => console.log("Subscription contract and service-flow tests passed."))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
