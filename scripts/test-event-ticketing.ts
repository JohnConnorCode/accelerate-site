import { WORKSHOP_EVENT, WORKSHOP_EVENT_ID } from "../src/content/workshops";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server";
import { MemorySupabase } from "./lib/memory-supabase";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import { encryptTenantSecret } from "../src/lib/revenue-os/encryption";
import { ACCELERATE_TENANT_ID } from "../src/lib/tenancy/constants";
import {
  createTicketCheckout,
  TicketCheckoutClosedError,
  processTicketStripeWebhook,
  sendTicketConfirmation,
  readPublicTicketOrder,
  saveTicketBusinessContext,
  executeTicketAdminCommand,
  proposeTicketAdminCommand,
} from "../src/lib/revenue-os/event-ticketing";
import { createAdminConfigurationFixture } from "./lib/admin-configuration-fixture";
import { runWithTenantRequestContext } from "../src/lib/tenancy/context";
import { approveAndExecuteAction } from "../src/lib/revenue-os/action-executor";
import { rejectAction } from "../src/lib/revenue-os/actions";
import { initialState } from "../src/lib/admin/demo/runtime";
import { createDemoBusinessState } from "../src/lib/admin/demo/business-runtime";
import { handleDemoEventTickets } from "../src/lib/admin/demo/event-ticketing-runtime";
import { DEMO_SCENARIOS } from "../src/lib/admin/demo/scenarios";
import {
  eventDefinitionSchema,
  ticketCheckoutSchema,
  eventCalendar,
  eventLocalTime,
  eventLocalToIso,
  ticketOrdersCsv,
  eventPath,
  type TicketOrder,
} from "../src/lib/revenue-os/event-ticketing-contract";
import { POST as checkoutRoute } from "../src/app/api/public/[tenantSlug]/events/[slug]/checkout/route";

assert.equal(WORKSHOP_EVENT.price_cents, 5000);
assert.equal(WORKSHOP_EVENT.capacity, 40);
assert.equal(eventLocalTime(WORKSHOP_EVENT.starts_at, "America/Chicago"), "2026-11-11T12:00");
assert.equal(eventLocalToIso("2026-11-11T12:00", "America/Chicago"), "2026-11-11T18:00:00.000Z");
assert.equal(eventLocalToIso("2026-07-11T12:00", "America/Chicago"), "2026-07-11T17:00:00.000Z");
assert.throws(() => eventLocalToIso("2026-03-08T02:30", "America/Chicago"), /does not exist/);
assert.throws(() => eventDefinitionSchema.parse({ ...WORKSHOP_EVENT, price_cents: 1 }));
assert.throws(() =>
  eventDefinitionSchema.parse({ ...WORKSHOP_EVENT, ends_at: WORKSHOP_EVENT.starts_at }),
);
assert.throws(() =>
  ticketCheckoutSchema.parse({
    requestId: randomUUID(),
    revision: 1,
    quantity: 2,
    name: "Buyer",
    email: "buyer@example.test",
    price_cents: 1,
  }),
);
assert.equal(eventPath("accelerate", WORKSHOP_EVENT.slug), `/events/${WORKSHOP_EVENT.slug}`);
assert.equal(
  eventPath("another-business", WORKSHOP_EVENT.slug),
  `/t/another-business/events/${WORKSHOP_EVENT.slug}`,
);
const calendar = eventCalendar(
  { ...WORKSHOP_EVENT, title: "Practical AI 😀 ".repeat(20) },
  randomUUID(),
);
assert.match(calendar, /DTSTART:20261111T180000Z/);
assert.match(calendar, /DTEND:20261111T193000Z/);
assert.ok(calendar.split("\r\n").every((line) => Buffer.byteLength(line, "utf8") <= 75));
assert.ok(
  !eventCalendar(
    { ...WORKSHOP_EVENT, title: "Business\rATTENDEE:injection" },
    randomUUID(),
  ).includes("\rATTENDEE:"),
);

async function serviceProof() {
  const denied = await checkoutRoute(
    new NextRequest(
      "https://workshop.example.test/api/public/accelerate/events/workshop/checkout",
      { method: "POST", headers: { origin: "https://elsewhere.example.test" }, body: "{}" },
    ),
    { params: Promise.resolve({ tenantSlug: "accelerate", slug: "workshop" }) },
  );
  assert.equal(denied.status, 403);

  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "event-ticketing-controlled-test-encryption";
  process.env.RESEND_API_KEY = "re_event_ticketing_fixture";
  const future = Date.now() + 7 * 86400000;
  const event = {
    ...WORKSHOP_EVENT,
    ends_at: new Date(future + 90 * 60000).toISOString(),
    refund_cutoff: new Date(future - 48 * 3600000).toISOString(),
    status: "published",
    id: WORKSHOP_EVENT_ID,
    tenant_id: ACCELERATE_TENANT_ID,
    revision: 1,
    available_tickets: 40,
    starts_at: new Date(Date.now() + 7 * 86400000).toISOString(),
  };
  const mem = new MemorySupabase({
    tenants: [
      {
        id: ACCELERATE_TENANT_ID,
        status: "active",
        config: { modules: { "event-ticketing": true, "stripe-invoicing": true } },
      },
    ],
    ticket_event_availability: [event],
    integration_connections: [
      {
        tenant_id: ACCELERATE_TENANT_ID,
        provider: "stripe",
        status: "connected",
        credential_version: 1,
        account_email: "acct_fixture",
        encrypted_credentials: {
          api_key: encryptTenantSecret(
            "rk_test_eventfixture1234567890",
            ACCELERATE_TENANT_ID,
            "stripe",
            "api_key",
          ),
        },
      },
    ],
  });
  mem.idFactory = () => randomUUID();
  const db = bindTenantDatabase(mem.client, ACCELERATE_TENANT_ID, true, "accelerate");
  const rows = () => (mem.tables.ticket_orders ??= []);
  mem.rpc("record_ticket_confirmation", (args) => {
    const row = rows().find((order) => order.id === args.p_order_id)!;
    Object.assign(row, { email_status: args.p_status, email_error: args.p_error });
    return row;
  });
  mem.rpc("reserve_event_order", (args) => {
    const existing = rows().find((row) => row.request_id === args.p_request_id);
    if (existing) return existing;
    const order = {
      id: randomUUID(),
      tenant_id: ACCELERATE_TENANT_ID,
      event_id: WORKSHOP_EVENT_ID,
      request_id: args.p_request_id,
      request_digest: args.p_digest,
      quantity: args.p_quantity,
      unit_price_cents: 5000,
      total_cents: Number(args.p_quantity) * 5000,
      refund_cents: 0,
      buyer_name: args.p_buyer_name,
      buyer_email: args.p_buyer_email,
      company: "",
      business_need: "",
      state: "reserved",
      event_snapshot: event,
      attribution: args.p_attribution,
      stripe_account_id: "acct_fixture",
      livemode: false,
      stripe_session_id: null,
      stripe_checkout_url: null,
      payment_intent_id: null,
      expires_at: new Date(Date.now() + 35 * 60000).toISOString(),
      created_at: new Date().toISOString(),
      paid_at: null,
      email_status: "pending",
      email_error: null,
    };
    rows().push(order);
    return order;
  });
  mem.rpc("record_event_checkout", (args) => {
    const row = rows().find((order) => order.id === args.p_order_id)!;
    Object.assign(row, {
      state: "checkout",
      stripe_session_id: args.p_session_id,
      stripe_checkout_url: args.p_checkout_url,
      expires_at: args.p_expires_at,
    });
    return row;
  });
  const receipts = new Set();
  let observed = 0;
  mem.rpc("observe_event_payment", (args) => {
    const row = rows().find((order) => order.id === args.p_order_id)!;
    if (receipts.has(args.p_external_id)) return row;
    receipts.add(args.p_external_id);
    observed++;
    const observation = args.p_observation as Record<string, unknown>;
    Object.assign(row, {
      stripe_session_id: observation.session_id,
      payment_intent_id: observation.payment_intent_id,
      refund_cents: observation.refund_cents,
      state: observation.refund_cents === row.total_cents ? "refunded" : observation.state,
      paid_at: new Date().toISOString(),
    });
    return row;
  });
  const realFetch = globalThis.fetch;
  let dropCreateResponse = true,
    dropEmailResponse = true,
    providerCreates = 0,
    providerSends = 0,
    emailAttempts = 0;
  let session: Record<string, unknown> = {};
  let amountRefunded = 0;
  const createdByKey = new Map<string, Record<string, unknown>>();
  const sentByKey = new Map<string, string>();
  globalThis.fetch = async (url, init) => {
    const target = new URL(String(url));
    const headers = new Headers(init?.headers);
    const json = (value: unknown) =>
      new Response(JSON.stringify(value), {
        status: 200,
        headers: { "content-type": "application/json", "request-id": "req_fixture" },
      });
    if (target.origin === "https://api.stripe.com") {
      if (target.pathname === "/v1/checkout/sessions" && init?.method === "POST") {
        const body = new URLSearchParams(String(init.body));
        const key = headers.get("idempotency-key")!;
        assert.equal(body.get("mode"), "payment");
        assert.equal(body.get("payment_method_types[0]"), "card");
        assert.equal(body.get("line_items[0][price_data][unit_amount]"), "5000");
        assert.equal(body.get("line_items[0][quantity]"), "2");
        assert.equal(body.get("adjustable_quantity[enabled]"), null);
        assert.match(body.get("success_url")!, /\/confirmation\?order=.*&key=/);
        if (!createdByKey.has(key)) {
          providerCreates++;
          const metadata = Object.fromEntries(
            [...body]
              .filter(([key]) => key.startsWith("metadata["))
              .map(([key, value]) => [key.slice(9, -1), value]),
          );
          session = {
            id: "cs_test_ticketfixture",
            url: "https://checkout.stripe.com/c/pay/cs_test_ticketfixture",
            expires_at: Number(body.get("expires_at")),
            mode: "payment",
            status: "open",
            payment_status: "unpaid",
            amount_total: 10000,
            currency: "usd",
            livemode: false,
            metadata,
            line_items: { data: [{ quantity: 2, price: { unit_amount: 5000 } }] },
            payment_intent: "pi_ticketfixture",
          };
          createdByKey.set(key, session);
        }
        if (dropCreateResponse) {
          dropCreateResponse = false;
          throw new Error("simulated lost checkout response");
        }
        return json(createdByKey.get(key));
      }
      if (target.pathname === "/v1/checkout/sessions/cs_test_ticketfixture") return json(session);
      if (target.pathname === "/v1/payment_intents/pi_ticketfixture")
        return json({
          id: "pi_ticketfixture",
          status: "succeeded",
          currency: "usd",
          amount_received: 10000,
          livemode: false,
          latest_charge: "ch_ticketfixture",
        });
      if (target.pathname === "/v1/charges/ch_ticketfixture")
        return json({
          id: "ch_ticketfixture",
          payment_intent: "pi_ticketfixture",
          amount: 10000,
          amount_refunded: amountRefunded,
          currency: "usd",
          livemode: false,
        });
      throw new Error(`Unexpected Stripe fixture endpoint ${target.pathname}`);
    }
    if (target.origin === "https://api.resend.com" && target.pathname === "/emails") {
      emailAttempts++;
      const key = headers.get("idempotency-key")!;
      const body = JSON.parse(String(init?.body));
      assert.match(body.to, /buyer@example\.test/);
      assert.ok(body.attachments?.length === 1);
      assert.match(
        Buffer.from(body.attachments[0].content, "base64").toString(),
        /BEGIN:VCALENDAR/,
      );
      if (!sentByKey.has(key)) {
        providerSends++;
        sentByKey.set(key, "email_ticketfixture");
      }
      if (dropEmailResponse) {
        dropEmailResponse = false;
        throw new Error("simulated lost confirmation response");
      }
      return json({ id: sentByKey.get(key) });
    }
    throw new Error(`Escaped controlled provider fixture: ${target.origin}`);
  };
  try {
    const input = {
      requestId: randomUUID(),
      revision: 1,
      quantity: 2,
      name: "Workshop buyer",
      email: "buyer@example.test",
      attribution: { utm_source: "venue" },
    };
    await assert.rejects(
      createTicketCheckout(db, event.slug, input, "https://workshop.example.test", "accelerate"),
      /lost checkout/,
    );
    assert.equal(rows().length, 1);
    assert.equal(rows()[0]!.state, "reserved");
    const checkout = await createTicketCheckout(
      db,
      event.slug,
      input,
      "https://workshop.example.test",
      "accelerate",
    );
    assert.match(checkout.url!, /^https:\/\/checkout\.stripe\.com\//);
    assert.equal(providerCreates, 1, "a lost response must reuse the same provider checkout");
    assert.equal(rows()[0]!.quantity, 2);
    assert.equal(
      rows()[0]!.attribution && (rows()[0]!.attribution as Record<string, string>).utm_source,
      "venue",
    );
    const callback = () => ({
      id: "evt_ticketfixture",
      type: "checkout.session.completed",
      livemode: false,
      data: { object: { ...session } },
    });
    const pending = await processTicketStripeWebhook(db, callback());
    assert.equal(pending.state, "checkout");
    assert.equal(providerSends, 0);
    session.status = "complete";
    session.payment_status = "paid";
    session.amount_total = 1;
    await assert.rejects(processTicketStripeWebhook(db, callback()), /does not match/);
    assert.equal(observed, 0);
    session.amount_total = 10000;
    const mismatched = callback();
    mismatched.livemode = true;
    await assert.rejects(processTicketStripeWebhook(db, mismatched), /mode mismatch/);
    const paid = await processTicketStripeWebhook(db, callback());
    assert.equal(paid.state, "paid");
    assert.equal(observed, 1);
    assert.equal(
      rows()[0]!.email_status,
      "attention",
      "email failure cannot turn a confirmed payment into an unpaid order",
    );
    assert.equal(providerSends, 1);
    await processTicketStripeWebhook(db, callback());
    assert.equal(observed, 1);
    assert.equal(emailAttempts, 1);
    for (const message of mem.tables.messages ?? []) message.created_at = new Date().toISOString();
    await sendTicketConfirmation(db, rows()[0] as unknown as TicketOrder, true);
    assert.equal(rows()[0]!.email_status, "sent");
    assert.equal(providerSends, 1, "bounded retry must reuse the same email idempotency key");
    assert.equal(emailAttempts, 2);
    const order = rows()[0]!;
    const receipt = await readPublicTicketOrder(db, event.slug, String(order.id), input.requestId);
    assert.equal(receipt.public.state, "paid");
    assert.equal("buyer_email" in receipt.public, false);
    assert.equal(receipt.public.testMode, true);
    await assert.rejects(
      readPublicTicketOrder(db, event.slug, String(order.id), randomUUID()),
      /not found/,
    );
    await saveTicketBusinessContext(db, event.slug, {
      orderId: order.id,
      key: input.requestId,
      company: "A local business",
      businessNeed: "Improve customer follow-up",
    });
    assert.equal(rows()[0]!.company, "A local business");
    const csv = ticketOrdersCsv([
      { ...order, buyer_name: "=SUM(1,1)", company: "  +SUM(1,1)" } as unknown as TicketOrder,
    ]);
    assert.ok(csv.includes("'=SUM(1,1)"));
    assert.ok(csv.includes("'  +SUM(1,1)"));
    assert.ok(!csv.includes(input.requestId), "exports never expose order credentials");
    assert.deepEqual(
      await processTicketStripeWebhook(db, {
        id: "evt_subscription",
        type: "checkout.session.completed",
        data: { object: { mode: "subscription", metadata: {} } },
      }),
      { handled: false },
    );
    amountRefunded = 10000;
    assert.equal(
      (
        await processTicketStripeWebhook(db, {
          id: "evt_ticketrefund",
          type: "charge.refunded",
          livemode: false,
          data: { object: { payment_intent: "pi_ticketfixture" } },
        })
      ).state,
      "refunded",
    );
    assert.equal(providerCreates, 1);
    assert.equal(providerSends, 1);
    await assert.rejects(
      createTicketCheckout(db, event.slug, input, "https://workshop.example.test", "accelerate"),
      TicketCheckoutClosedError,
    );
  } finally {
    globalThis.fetch = realFetch;
  }
}
async function adminProof() {
  const f = createAdminConfigurationFixture();
  const hostFetch = globalThis.fetch;
  f.mem.rows("tenants")[0]!.config = {
    modules: { "event-ticketing": true, "stripe-invoicing": true },
  };
  let writes = 0,
    revision = 0;
  globalThis.fetch = async (raw, init) => {
    const url = new URL(String(raw));
    if (url.pathname !== "/rest/v1/rpc/save_ticket_event") return hostFetch(raw, init);
    assert.equal(url.origin, "https://branding-fixture.example.test");
    assert.equal(new Headers(init?.headers).get("x-tenant-id"), f.tenantId);
    const args = JSON.parse(String(init?.body));
    if (args.p_revision !== revision)
      return Response.json({ message: "Event changed; reload before saving" }, { status: 409 });
    writes++;
    revision++;
    return Response.json({
      ...args.p_definition,
      id: args.p_event_id,
      tenant_id: f.tenantId,
      revision,
    });
  };
  const change = () => ({
    operation: "save_event",
    eventId: WORKSHOP_EVENT_ID,
    revision,
    requestId: randomUUID(),
    event: { ...WORKSHOP_EVENT },
  });
  try {
    await assert.rejects(executeTicketAdminCommand(f.db, change(), f.email), /authenticated/);
    await runWithTenantRequestContext(f.actor, async () => {
      await executeTicketAdminCommand(f.db, change(), f.email);
      assert.equal(writes, 1);
      const pending = await proposeTicketAdminCommand(f.db, change(), f.email);
      assert.equal(pending.status, "pending");
      assert.equal(writes, 1);
      const stale = await proposeTicketAdminCommand(f.db, change(), f.email);
      await assert.rejects(
        proposeTicketAdminCommand(
          f.db,
          { ...stale.payload, event: { ...WORKSHOP_EVENT, price_cents: 9000 } },
          f.email,
        ),
        /already used/,
      );
      await approveAndExecuteAction(f.db, pending.id, f.email);
      assert.equal(writes, 2);
      await assert.rejects(approveAndExecuteAction(f.db, pending.id, f.email), /already handled/);
      await assert.rejects(approveAndExecuteAction(f.db, stale.id, f.email), /changed/);
      const denied = await proposeTicketAdminCommand(f.db, change(), f.email);
      await rejectAction(f.db, denied.id, f.email);
      await assert.rejects(approveAndExecuteAction(f.db, denied.id, f.email));
      const expired = await proposeTicketAdminCommand(f.db, change(), f.email);
      f.mem.rows("action_queue").find((row) => row.id === expired.id)!.expires_at =
        "2000-01-01T00:00:00Z";
      await assert.rejects(approveAndExecuteAction(f.db, expired.id, f.email));
      const foreign = await proposeTicketAdminCommand(f.db, change(), f.email);
      await assert.rejects(
        approveAndExecuteAction(
          bindTenantDatabase(f.mem.client, f.other, true),
          foreign.id,
          f.email,
        ),
      );
      const autonomous = await proposeTicketAdminCommand(f.db, change(), f.email);
      await assert.rejects(
        approveAndExecuteAction(f.db, autonomous.id, f.email, { mode: "autonomous" }),
      );
      const revoked = await proposeTicketAdminCommand(f.db, change(), f.email);
      f.mem.rows("tenant_memberships")[0]!.status = "revoked";
      await assert.rejects(approveAndExecuteAction(f.db, revoked.id, f.email));
      await assert.rejects(executeTicketAdminCommand(f.db, change(), f.email), /revoked/);
      assert.equal(writes, 2);
      f.mem.rows("tenant_memberships")[0]!.status = "active";
      f.mem.rows("tenants")[0]!.config = { modules: { "event-ticketing": false } };
      await assert.rejects(executeTicketAdminCommand(f.db, change(), f.email), /unavailable/);
    });
  } finally {
    f.restore();
  }
}
async function adminRouteProof() {
  const f = createAdminConfigurationFixture();
  f.mem.rows("tenants")[0]!.config = { modules: { "event-ticketing": true } };
  let authorization: unknown = f.actor;
  let writes = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (raw, init) => {
    const url = new URL(String(raw));
    assert.equal(url.origin, "https://branding-fixture.example.test");
    assert.equal(url.pathname, "/rest/v1/rpc/save_ticket_event");
    writes++;
    const args = JSON.parse(String(init?.body));
    return Response.json({ ...args.p_definition, id: args.p_event_id, revision: 1 });
  };
  const require = createRequire(resolve("package.json"));
  const route: { POST?: (request: NextRequest) => Promise<NextResponse> } = {};
  runInNewContext(
    ts.transpileModule(readFileSync("src/app/api/admin/events/route.ts", "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports: route,
      console,
      require: (name: string) =>
        name === "@/lib/admin/module-guard"
          ? { requireAdminForModule: async () => authorization }
          : require(name.startsWith("@/") ? resolve("src", name.slice(2)) : name),
    },
  );
  const submit = () =>
    route.POST!(
      new NextRequest("https://example.test/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "save_event",
          eventId: WORKSHOP_EVENT_ID,
          revision: 0,
          requestId: randomUUID(),
          event: WORKSHOP_EVENT,
        }),
      }),
    );
  try {
    const saved = await submit();
    assert.equal(saved.status, 200, JSON.stringify(await saved.json()));
    assert.equal(writes, 1);
    f.mem.rows("tenant_memberships")[0]!.status = "revoked";
    assert.equal((await submit()).status, 422);
    assert.equal(writes, 1, "revoked membership cannot save through the route");
    authorization = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    assert.equal((await submit()).status, 401);
    assert.equal(writes, 1, "unauthenticated requests cannot save");
  } finally {
    globalThis.fetch = realFetch;
  }
}
async function demoProof() {
  for (const pack of Object.values(DEMO_SCENARIOS)) {
    const state = initialState(),
      business = createDemoBusinessState(pack);
    let saves = 0;
    const request = (body: Record<string, unknown> = {}, method = "GET") =>
      handleDemoEventTickets(
        pack.id,
        state,
        business,
        "/api/admin/events",
        method,
        body,
        new URLSearchParams(),
        () => saves++,
      )!;
    assert.equal(request().status, 403);
    assert.equal(saves, 0);
    state.moduleOverrides["event-ticketing"] = true;
    const first = await request().json();
    assert.equal(first.events[0].paid_tickets, 0);
    assert.equal(first.orders[0].livemode, false);
    const command = {
      operation: "save_event",
      eventId: WORKSHOP_EVENT_ID,
      revision: 1,
      requestId: randomUUID(),
      event: { ...WORKSHOP_EVENT, price_cents: 7500 },
    };
    assert.equal(request(command, "POST").status, 200);
    assert.equal(request(command, "POST").status, 200);
    assert.equal(business.eventTickets!.events[0]!.revision, 2);
    assert.equal(business.eventTickets!.orders[0]!.total_cents, 10000);
    assert.equal(request({ ...command, requestId: randomUUID() }, "POST").status, 409);
    assert.equal(
      request(
        { operation: "retry_confirmation", orderId: first.orders[0].id, requestId: randomUUID() },
        "POST",
      ).status,
      200,
    );
    assert.equal(business.eventTickets!.orders[0]!.email_status, "sent");
    assert.equal(business.receipts.length, 2);
    const proposed = await request(
      {
        mode: "propose",
        command: {
          ...command,
          revision: 2,
          requestId: randomUUID(),
          event: { ...WORKSHOP_EVENT, price_cents: 9000 },
        },
      },
      "POST",
    ).json();
    assert.equal(business.eventTickets!.events[0]!.price_cents, 7500);
    const decide = (id: string, decision = "approve") =>
      handleDemoEventTickets(
        pack.id,
        state,
        business,
        "/api/admin/revenue-os/actions",
        "PATCH",
        { id, decision },
        new URLSearchParams(),
        () => saves++,
      )!;
    assert.equal(decide(proposed.action.id).status, 200);
    assert.equal(business.eventTickets!.events[0]!.price_cents, 9000);
    assert.equal(decide(proposed.action.id).status, 409);
    const denied = await request(
      {
        mode: "propose",
        command: { operation: "reconcile", eventId: WORKSHOP_EVENT_ID, requestId: randomUUID() },
      },
      "POST",
    ).json();
    state.moduleOverrides["event-ticketing"] = false;
    assert.equal(decide(denied.action.id).status, 403);
    assert.equal(decide(denied.action.id, "reject").status, 200);
  }
}
async function main() {
  await serviceProof();
  await adminProof();
  await adminRouteProof();
  await demoProof();
}
main()
  .then(() =>
    console.log(
      JSON.stringify({
        result: "passed",
        checks: [
          "confirmed workshop defaults and Chicago time conversion",
          "invalid local DST and price/quantity tampering rejected",
          "UTF-8 calendar folding and injection prevention",
          "cross-origin checkout denied before database access",
          "lost provider response safely reuses checkout",
          "unpaid and mismatched receipts cannot confirm admission",
          "webhook replay cannot duplicate tickets",
          "email failure preserves paid admission",
          "bounded same-key confirmation recovery sends once",
          "private confirmation requires order credential",
          "buyer context saved to paid order",
          "CSV formula protection and credential exclusion",
          "subscription callbacks retain their existing owner",
          "full refund invalidates admission",
          "test orders cannot masquerade as live admission",
          "governed admin proposals require approval and current authority",
          "stale, rejected, revoked and disabled event writes refused",
          "all fictional scenarios preserve prices and simulated receipts",
        ],
      }),
    ),
  )
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
