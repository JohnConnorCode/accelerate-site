#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { formatPlanPrice, planInputSchema, stripeObjectId } from "../src/lib/revenue-os/subscriptions-contract";
import { verifyStripeSignature } from "../src/lib/revenue-os/subscriptions";

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
console.log("Subscription contract and webhook signature tests passed.");
