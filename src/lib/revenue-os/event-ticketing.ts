import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  callTicketEventRpc,
  createServiceRoleClient,
  tenantIdForDatabase,
  tenantScopeForDatabase,
} from "@/lib/supabase/server";
import { isSetupPlaceholder, isSupabasePublicConfigured } from "@/lib/supabase/configuration.mjs";
import {
  getTenantFromEmail,
  getTenantResend,
  getTenantReplyToEmail,
  getTenantResendBinding,
} from "@/lib/email/resend";
import {
  assertActiveTenantExecution,
  resolveActiveTenantSystemContext,
} from "@/lib/tenancy/system";
import { assertCurrentTenantAdmin } from "./tenant-admin-authority";
import { isModuleEnabled } from "./modules";
import { tenantStripeClient } from "./stripe-adapter";
import { sendRecordedEmail } from "./communications";
import { proposeAction } from "./actions";
import { recordAudit } from "./audit";
import {
  eventDefinitionSchema,
  stripeCheckoutClientSecretSchema,
  saveTicketEventSchema,
  ticketCheckoutSchema,
  ticketAdminCommandSchema,
  eventCalendar,
  eventTiming,
  eventPath,
  ticketMoney,
  type TicketEvent,
  type TicketOrder,
  type TicketOrderSummary,
} from "./event-ticketing-contract";

type StripeClient = Awaited<ReturnType<typeof tenantStripeClient>>;
type ProviderObject = Record<string, unknown>;
class TicketingUnavailableError extends Error {}
export class TicketCheckoutClosedError extends Error {
  constructor() {
    super("This checkout is no longer available. Review availability and start a new purchase.");
    this.name = "TicketCheckoutClosedError";
  }
}
function scope(db: SupabaseClient) {
  const id = tenantIdForDatabase(db);
  if (!id) throw new Error("Event ticketing requires an explicit workspace");
  return id;
}
async function enabled(db: SupabaseClient) {
  const { data, error } = await db
    .from("tenants")
    .select("status,config")
    .eq("id", scope(db))
    .maybeSingle();
  if (error) throw new Error("Event ticketing setup could not be verified");
  if (data?.status !== "active" || !isModuleEnabled("event-ticketing", data.config))
    throw new TicketingUnavailableError("Event ticketing is unavailable for this workspace");
}
async function rpc<T>(
  db: SupabaseClient,
  operation:
    | "reserve_event_order"
    | "record_event_checkout"
    | "observe_event_payment"
    | "release_uncreated_ticket_order"
    | "record_ticket_confirmation",
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } =
    operation === "reserve_event_order" || operation === "record_event_checkout"
      ? await db.rpc(operation, args)
      : await callTicketEventRpc(db, operation, args);
  if (error || !data) throw new Error(error?.message || "Ticket operation could not be recorded");
  return data as T;
}
async function selectTicketEvent(
  db: SupabaseClient,
  field: "slug" | "id",
  value: string,
  allowDraft = false,
) {
  await enabled(db);
  let query = db
    .from("ticket_event_availability")
    .select("*")
    .eq("tenant_id", scope(db))
    .eq(field, value);
  if (!allowDraft) query = query.in("status", ["published", "paused", "closed"]);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error("Workshop details are temporarily unavailable");
  return data as TicketEvent | null;
}
export function readTicketEvent(db: SupabaseClient, slug: string, allowDraft = false) {
  return selectTicketEvent(db, "slug", slug, allowDraft);
}
export async function loadPublicTicketEvent(
  tenantSlug: string,
  locator: string | { eventId: string },
  upcomingOnly = false,
) {
  if (
    !isSupabasePublicConfigured(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ) ||
    isSetupPlaceholder(process.env.SUPABASE_SERVICE_ROLE_KEY)
  )
    return null;
  const context = await resolveActiveTenantSystemContext(tenantSlug, "public-workshop-page");
  if (!context) return null;
  try {
    const database = createServiceRoleClient(context);
    const event =
      typeof locator === "string"
        ? await readTicketEvent(database, locator)
        : await selectTicketEvent(database, "id", z.uuid().parse(locator.eventId));
    return upcomingOnly &&
      event &&
      (event.status !== "published" || Date.parse(event.starts_at) <= Date.now())
      ? null
      : event;
  } catch (error) {
    if (error instanceof TicketingUnavailableError) return null;
    throw error;
  }
}
export async function readTicketWorkspace(db: SupabaseClient, eventId?: string) {
  await enabled(db);
  let query = db
    .from("ticket_event_availability")
    .select("*")
    .eq("tenant_id", scope(db))
    .order("starts_at", { ascending: false })
    .limit(21);
  if (eventId) query = query.eq("id", z.uuid().parse(eventId));
  const { data: events, error } = await query;
  if (error) throw new Error("Events could not be loaded");
  const ids = (events ?? []).slice(0, 20).map((event) => event.id);
  const orders = ids.length
    ? await db
        .from("ticket_orders")
        .select("*")
        .in("event_id", ids)
        .order("created_at", { ascending: false })
        .limit(501)
    : { data: [], error: null };
  if (orders.error) throw new Error("Ticket orders could not be loaded");
  const summaries = ((orders.data ?? []).slice(0, 500) as TicketOrder[]).map(
    ({ request_id: _, request_digest: __, stripe_checkout_url: ___, ...order }) => {
      void _;
      void __;
      void ___;
      return order as TicketOrderSummary;
    },
  );
  return {
    tenantSlug: tenantScopeForDatabase(db)?.slug ?? null,
    events: (events ?? []).slice(0, 20) as TicketEvent[],
    orders: summaries,
    truncated: (events?.length ?? 0) > 20 || (orders.data?.length ?? 0) > 500,
  };
}
export async function saveTicketEvent(db: SupabaseClient, raw: unknown, actorEmail: string) {
  const input = saveTicketEventSchema.parse(raw);
  await assertCurrentTenantAdmin(db, actorEmail);
  await enabled(db);
  if (input.event.status === "published") {
    if (Date.parse(input.event.starts_at) <= Date.now())
      throw new Error("Choose a future workshop before opening ticket sales");
    const client = await tenantStripeClient(db);
    if (!client.webhookSecret || !client.publishableKey)
      throw new Error(
        "Configure the Stripe publishable key and webhook signing secret before opening ticket sales",
      );
    const { object: account } = await client.account();
    if (
      account.id !== client.accountId ||
      (client.mode === "live" && account.charges_enabled !== true)
    )
      throw new Error(
        "Connect a Stripe account that can accept payments before opening ticket sales",
      );
    await getTenantResend(db);
    await getTenantFromEmail(db);
  }
  const { data, error } = await callTicketEventRpc(db, "save_ticket_event", {
    p_event_id: input.eventId,
    p_revision: input.revision,
    p_definition: input.event,
    p_request_id: input.requestId,
    p_actor_email: actorEmail,
  });
  if (error || !data) throw new Error(error?.message || "Event could not be saved");
  return data as TicketEvent;
}
function checkoutBody(order: TicketOrder, origin: string, tenantSlug: string) {
  const path = `${origin}${eventPath(tenantSlug, order.event_snapshot.slug)}`;
  const metadata = {
    accelerate_purpose: "event_ticket",
    accelerate_tenant_id: order.tenant_id,
    accelerate_order_id: order.id,
    accelerate_event_id: order.event_id,
  };
  const body = new URLSearchParams({
    mode: "payment",
    ui_mode: "custom",
    "payment_method_types[0]": "card",
    customer_email: order.buyer_email,
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(order.unit_price_cents),
    "line_items[0][price_data][product_data][name]": order.event_snapshot.title,
    "line_items[0][quantity]": String(order.quantity),
    expires_at: String(Math.floor(Date.parse(order.expires_at) / 1000)),
    client_reference_id: order.id,
    return_url: `${path}/confirmation?order=${order.id}&key=${order.request_id}`,
  });
  for (const [key, value] of Object.entries(metadata)) {
    body.set(`metadata[${key}]`, value);
    body.set(`payment_intent_data[metadata][${key}]`, value);
  }
  return body;
}
async function attachCheckout(
  db: SupabaseClient,
  order: TicketOrder,
  client: StripeClient,
  origin: string,
  tenantSlug: string,
) {
  if (client.accountId !== order.stripe_account_id || (client.mode === "live") !== order.livemode)
    throw new Error("The Stripe account changed; reconcile this reservation before retrying");
  if (order.stripe_session_id) return order;
  const result = await client.checkoutSession(
    checkoutBody(order, origin, tenantSlug),
    `event-ticket:${order.tenant_id}:${order.request_id}`,
  );
  const session = result.object;
  const secret = stripeCheckoutClientSecretSchema.safeParse(session.client_secret);
  if (
    session.ui_mode !== "custom" ||
    typeof session.id !== "string" ||
    !/^cs_[A-Za-z0-9_]+$/.test(session.id) ||
    !secret.success ||
    !secret.data.startsWith(`${session.id}_secret_`) ||
    !Number.isInteger(session.expires_at)
  )
    throw new Error("Stripe returned an incomplete checkout receipt; retry with the same request");
  return rpc<TicketOrder>(db, "record_event_checkout", {
    p_order_id: order.id,
    p_session_id: session.id,
    p_checkout_url: null,
    p_expires_at: new Date(Number(session.expires_at) * 1000).toISOString(),
  });
}
export async function reconcileTicketReservations(db: SupabaseClient, eventId: string) {
  await enabled(db);
  const { data, error } = await db
    .from("ticket_orders")
    .select("*")
    .eq("event_id", z.uuid().parse(eventId))
    .in("state", ["reserved", "checkout"])
    .lte("expires_at", new Date().toISOString())
    .order("expires_at")
    .limit(50);
  if (error) throw new Error("Ticket reservations could not be reconciled");
  let needsReview = 0;
  const client = data?.length ? await tenantStripeClient(db) : null;
  for (const order of (data ?? []) as TicketOrder[]) {
    if (
      !client ||
      client.accountId !== order.stripe_account_id ||
      (client.mode === "live") !== order.livemode
    ) {
      needsReview++;
      continue;
    }
    if (!order.stripe_session_id) {
      const listing = await client.checkoutSessionsSince(
        Math.floor(Date.parse(order.created_at) / 1000) - 5,
      );
      if (!Array.isArray(listing.object.data) || typeof listing.object.has_more !== "boolean")
        throw new Error("Stripe receipt listing was incomplete");
      const found = listing.object.data.find(
        (value) => object(object(value).metadata).accelerate_order_id === order.id,
      );
      if (found)
        await fulfillTicketOrder(
          db,
          { ...order, stripe_session_id: providerId(object(found).id, "cs") },
          `recover:${order.id}`,
        );
      else if (!listing.object.has_more && Date.parse(order.expires_at) + 60000 < Date.now())
        await rpc(db, "release_uncreated_ticket_order", {
          p_order_id: order.id,
          p_provider_request_id: listing.requestId,
        });
      // ponytail: inspect at most 100 recent sessions; paginate this bounded
      // receipt lookup when an account exceeds that volume in one hold window.
      else needsReview++;
      continue;
    }
    await fulfillTicketOrder(db, order, `reconcile:${order.stripe_session_id}`);
  }
  return { checked: data?.length ?? 0, needsReview, truncated: data?.length === 50 };
}
export async function createTicketCheckout(
  db: SupabaseClient,
  slug: string,
  raw: unknown,
  origin: string,
  tenantSlug: string,
) {
  const input = ticketCheckoutSchema.parse(raw);
  await enabled(db);
  const event = await readTicketEvent(db, slug);
  if (!event) throw new Error("Workshop not found");
  const client = await tenantStripeClient(db);
  if (!client.publishableKey)
    throw new Error("Configure this workspace's Stripe publishable key before opening checkout");
  await reconcileTicketReservations(db, event.id);
  const digest = createHash("sha256")
    .update(
      JSON.stringify([
        slug,
        input.revision,
        input.quantity,
        input.name,
        input.email,
        input.attribution,
      ]),
    )
    .digest("hex");
  const order = await rpc<TicketOrder>(db, "reserve_event_order", {
    p_slug: slug,
    p_request_id: input.requestId,
    p_quantity: input.quantity,
    p_revision: input.revision,
    p_buyer_name: input.name,
    p_buyer_email: input.email,
    p_digest: digest,
    p_attribution: input.attribution,
    p_stripe_account: client.accountId,
    p_livemode: client.mode === "live",
  });
  if (order.state === "expired" || order.state === "refunded")
    throw new TicketCheckoutClosedError();
  if (order.state === "paid")
    return {
      confirmed: true,
      url: `${origin}${eventPath(tenantSlug, slug)}/confirmation?order=${order.id}&key=${order.request_id}`,
    };
  const attached = await attachCheckout(db, order, client, origin, tenantSlug);
  // The webhook can settle the order before checkout creation returns.
  if (attached.state === "paid")
    return {
      confirmed: true,
      url: `${origin}${eventPath(tenantSlug, slug)}/confirmation?order=${attached.id}&key=${attached.request_id}`,
    };
  if (attached.state === "expired" || attached.state === "refunded")
    throw new TicketCheckoutClosedError();
  return {
    url: `${origin}${eventPath(tenantSlug, slug)}/checkout?order=${order.id}&key=${order.request_id}`,
    orderId: order.id,
    expiresAt: attached.expires_at,
  };
}
function object(value: unknown): ProviderObject {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Stripe returned an invalid receipt");
  return value as ProviderObject;
}
function providerId(value: unknown, prefix: "pi" | "cs" | "ch") {
  const id = typeof value === "string" ? value : object(value).id;
  if (typeof id !== "string" || !new RegExp(`^${prefix}_[A-Za-z0-9_]+$`).test(id))
    throw new Error("Stripe receipt has an invalid identifier");
  return id;
}
export async function fulfillTicketOrder(
  db: SupabaseClient,
  order: TicketOrder,
  externalId: string,
) {
  if (!order.stripe_session_id) return order;
  const client = await tenantStripeClient(db);
  if (client.accountId !== order.stripe_account_id || (client.mode === "live") !== order.livemode)
    throw new Error("Stripe connection does not match this ticket order");
  const session = (await client.retrieveCheckoutSession(order.stripe_session_id)).object;
  const metadata = object(session.metadata);
  const lineItems = object(session.line_items).data;
  if (
    session.mode !== "payment" ||
    session.id !== order.stripe_session_id ||
    session.livemode !== order.livemode ||
    session.currency !== "usd" ||
    session.amount_total !== order.total_cents ||
    metadata.accelerate_purpose !== "event_ticket" ||
    metadata.accelerate_tenant_id !== scope(db) ||
    metadata.accelerate_order_id !== order.id ||
    metadata.accelerate_event_id !== order.event_id ||
    !Array.isArray(lineItems) ||
    lineItems.length !== 1 ||
    object(lineItems[0]).quantity !== order.quantity ||
    object(object(lineItems[0]).price).unit_amount !== order.unit_price_cents
  )
    throw new Error("Stripe checkout does not match the recorded ticket order");
  let state: "paid" | "expired";
  let paymentIntentId: string | null = null;
  let refunds = 0;
  if (session.status === "complete" && session.payment_status === "paid") {
    state = "paid";
    paymentIntentId = providerId(session.payment_intent, "pi");
    const intent = (await client.paymentIntent(paymentIntentId)).object;
    if (
      intent.status !== "succeeded" ||
      intent.currency !== "usd" ||
      intent.amount_received !== order.total_cents ||
      intent.livemode !== order.livemode
    )
      throw new Error("Stripe has not confirmed this ticket payment");
    if (intent.latest_charge) {
      const charge = (await client.charge(providerId(intent.latest_charge, "ch"))).object;
      if (
        providerId(charge.payment_intent, "pi") !== paymentIntentId ||
        charge.amount !== order.total_cents ||
        charge.currency !== "usd" ||
        charge.livemode !== order.livemode ||
        !Number.isInteger(charge.amount_refunded) ||
        Number(charge.amount_refunded) < 0 ||
        Number(charge.amount_refunded) > order.total_cents
      )
        throw new Error("Stripe refund receipt does not match this payment");
      refunds = Number(charge.amount_refunded);
    }
  } else if (session.status === "expired" && session.payment_status === "unpaid") state = "expired";
  else return order;
  const saved = await rpc<TicketOrder>(db, "observe_event_payment", {
    p_order_id: order.id,
    p_external_id: `${externalId}:${state}:${refunds}`,
    p_observation: {
      state,
      session_id: session.id,
      account_id: client.accountId,
      livemode: session.livemode,
      total_cents: session.amount_total,
      quantity: order.quantity,
      currency: session.currency,
      payment_intent_id: paymentIntentId,
      refund_cents: refunds,
    },
  });
  if (saved.state === "paid") await sendTicketConfirmation(db, saved);
  return saved;
}
export async function sendTicketConfirmation(
  db: SupabaseClient,
  order: TicketOrder,
  retry = false,
) {
  if (order.state !== "paid" || order.email_status === "sent") return;
  if (order.email_status === "attention" && !retry) return;
  const event = eventDefinitionSchema.strip().parse(order.event_snapshot);
  const when = eventTiming(event);
  try {
    const binding = await getTenantResendBinding(db);
    const replyTo = await getTenantReplyToEmail(db);
    const tenantRead = await db
      .from("tenants")
      .select("name,config")
      .eq("id", scope(db))
      .maybeSingle();
    if (tenantRead.error || !tenantRead.data)
      throw new Error("Workshop organizer could not be verified");
    const name = tenantRead.data.config?.brand?.name || tenantRead.data.name;
    const organizer = typeof name === "string" && name.length <= 160 ? name : "Workshop team";
    const result = await sendRecordedEmail(db, {
      to: order.buyer_email,
      subject: `${order.livemode ? "" : "[Test] "}Your tickets: ${event.title}`,
      replyTo,
      retryFailedWithSameKey: retry,
      idempotencyBinding: binding,
      text: `Hi ${order.buyer_name},\n\n${order.livemode ? `Your ${order.quantity === 1 ? "ticket is" : `${order.quantity} tickets are`} confirmed.` : "This was a Stripe test payment. No money was collected and no live admission is confirmed."}\n\n${event.title}\n${when.date}\n${when.time}\n${event.venue_name}, ${event.venue_address}\n\nOrder: ${order.id}\n${order.livemode ? "Total paid" : "Test amount"}: ${ticketMoney(order.total_cents)}\n\nBring your business questions and an example of work you would like AI to help with.\n\n${event.refund_policy}\n\nQuestions? Reply to this email.\n\n${organizer}`,
      attachments: [
        {
          filename: "workshop.ics",
          content: Buffer.from(
            eventCalendar(
              order.livemode ? event : { ...event, title: `[Test] ${event.title}` },
              order.id,
            ),
          ).toString("base64"),
          contentType: "text/calendar",
        },
      ],
      source: "automation",
      template: "event-ticket-confirmation",
      idempotencyKey: `event-ticket-confirmation:${order.tenant_id}:${order.id}`,
      beforeSend: async () => {
        await assertActiveTenantExecution(db, "event-confirmation");
        if ((await getTenantResendBinding(db)) !== binding)
          throw new Error("Email connection changed before dispatch");
        const { data, error } = await db
          .from("ticket_orders")
          .select("state")
          .eq("id", order.id)
          .maybeSingle();
        if (error || data?.state !== "paid")
          throw new Error("Ticket admission is no longer active");
      },
    });
    if (!result) throw new Error("Email delivery receipt is unavailable");
    await rpc(db, "record_ticket_confirmation", {
      p_order_id: order.id,
      p_status: "sent",
      p_error: null,
    });
    order.email_status = "sent";
  } catch (error) {
    await rpc(db, "record_ticket_confirmation", {
      p_order_id: order.id,
      p_status: "attention",
      p_error: "Payment is confirmed. Check the recorded email receipt, then retry confirmation.",
    });
    await recordAudit(db, {
      action: "ticket_order.confirmation_attention",
      entityType: "ticket_order",
      entityId: order.id,
      source: "automation",
      metadata: { reason: error instanceof Error ? error.name : "unknown", retry },
    });
    order.email_status = "attention";
  }
}
export async function processTicketStripeWebhook(
  db: SupabaseClient,
  event: Record<string, unknown>,
) {
  const type = event.type;
  if (
    typeof type !== "string" ||
    typeof event.id !== "string" ||
    !/^evt_[A-Za-z0-9_]+$/.test(event.id)
  )
    return { handled: false };
  if (!["checkout.session.completed", "checkout.session.expired", "charge.refunded"].includes(type))
    return { handled: false };
  const value = object(object(event.data).object);
  let order: TicketOrder | null;
  if (type === "charge.refunded") {
    if (
      !value.payment_intent &&
      (value.metadata as ProviderObject | undefined)?.accelerate_purpose !== "event_ticket"
    )
      return { handled: false };
    const intent = providerId(value.payment_intent, "pi");
    const result = await db
      .from("ticket_orders")
      .select("*")
      .eq("payment_intent_id", intent)
      .maybeSingle();
    if (result.error) throw new Error("Refund order lookup failed");
    order = result.data as TicketOrder | null;
    if (!order) {
      const metadata = value.metadata as Record<string, unknown> | undefined;
      if (metadata?.accelerate_purpose !== "event_ticket") return { handled: false };
      const found = await db
        .from("ticket_orders")
        .select("*")
        .eq("id", z.uuid().parse(metadata.accelerate_order_id))
        .maybeSingle();
      if (found.error || !found.data) throw new Error("Ticket refund order is unavailable");
      order = found.data as TicketOrder;
    }
  } else {
    const metadata = value.metadata as Record<string, unknown> | undefined;
    if (metadata?.accelerate_purpose !== "event_ticket") return { handled: false };
    if (metadata.accelerate_tenant_id !== scope(db))
      throw new Error("Ticket callback belongs to another workspace");
    const result = await db
      .from("ticket_orders")
      .select("*")
      .eq("id", z.uuid().parse(metadata.accelerate_order_id))
      .maybeSingle();
    if (result.error || !result.data) throw new Error("Ticket callback order is unavailable");
    order = result.data as TicketOrder;
    const sessionId = providerId(value.id, "cs");
    if (order.stripe_session_id && order.stripe_session_id !== sessionId)
      throw new Error("Ticket callback session mismatch");
    // A webhook may arrive before the session-creation response is recorded.
    order = { ...order, stripe_session_id: sessionId };
  }
  if (event.livemode !== order.livemode) throw new Error("Ticket callback mode mismatch");
  const saved = await fulfillTicketOrder(db, order, event.id);
  return { handled: true, state: saved.state };
}
export async function readPublicTicketOrder(
  db: SupabaseClient,
  slug: string,
  id: string,
  key: string,
) {
  const { data, error } = await db
    .from("ticket_orders")
    .select("*")
    .eq("id", z.uuid().parse(id))
    .eq("request_id", z.uuid().parse(key))
    .maybeSingle();
  if (error || !data || data.event_snapshot?.slug !== slug) throw new Error("Order not found");
  const order = await fulfillTicketOrder(
    db,
    data as TicketOrder,
    `return:${data.stripe_session_id}`,
  );
  return {
    order,
    public: {
      reference: order.id,
      quantity: order.quantity,
      totalCents: order.total_cents,
      state: order.state,
      event: order.event_snapshot,
      emailStatus: order.email_status,
      testMode: !order.livemode,
    },
  };
}
/** Only an order's opaque guest credential can retrieve its payment fields. */
export async function readTicketPayment(db: SupabaseClient, slug: string, id: string, key: string) {
  const { order, public: receipt } = await readPublicTicketOrder(db, slug, id, key);
  if (order.state === "paid" || order.state === "expired" || order.state === "refunded")
    return receipt;
  const client = await tenantStripeClient(db);
  if (
    !client.publishableKey ||
    !order.stripe_session_id ||
    client.accountId !== order.stripe_account_id ||
    (client.mode === "live") !== order.livemode
  )
    throw new Error("Secure payment fields are unavailable for this order");
  const session = (await client.retrieveCheckoutSession(order.stripe_session_id)).object;
  const metadata = object(session.metadata);
  if (
    session.ui_mode !== "custom" ||
    session.status !== "open" ||
    session.id !== order.stripe_session_id ||
    session.livemode !== order.livemode ||
    session.amount_total !== order.total_cents ||
    session.currency !== "usd" ||
    metadata.accelerate_tenant_id !== scope(db) ||
    metadata.accelerate_order_id !== order.id ||
    metadata.accelerate_purpose !== "event_ticket" ||
    metadata.accelerate_event_id !== order.event_id ||
    typeof session.client_secret !== "string" ||
    !stripeCheckoutClientSecretSchema.safeParse(session.client_secret).success ||
    !session.client_secret.startsWith(`${order.stripe_session_id}_secret_`)
  )
    throw new Error("This payment session cannot be opened; check your order before paying again");
  return {
    ...receipt,
    clientSecret: session.client_secret,
    publishableKey: client.publishableKey,
    buyerName: order.buyer_name,
    buyerEmail: order.buyer_email,
  };
}
export async function saveTicketBusinessContext(db: SupabaseClient, slug: string, raw: unknown) {
  const input = z
    .object({
      orderId: z.uuid(),
      key: z.uuid(),
      company: z.string().trim().max(160),
      businessNeed: z.string().trim().max(1500),
    })
    .strict()
    .parse(raw);
  const { order } = await readPublicTicketOrder(db, slug, input.orderId, input.key);
  if (order.state !== "paid") throw new Error("Payment confirmation is required");
  const { data, error } = await db
    .from("ticket_orders")
    .update({ company: input.company, business_need: input.businessNeed })
    .eq("id", order.id)
    .eq("request_id", input.key)
    .eq("state", "paid")
    .select("id")
    .maybeSingle();
  if (error || !data) throw new Error("Business context could not be saved");
  await recordAudit(db, {
    action: "ticket_order.business_context_saved",
    entityType: "ticket_order",
    entityId: order.id,
    source: "public",
  });
  return { saved: true };
}
export async function executeTicketAdminCommand(
  db: SupabaseClient,
  raw: unknown,
  actorEmail: string,
) {
  const command = ticketAdminCommandSchema.parse(raw);
  await assertCurrentTenantAdmin(db, actorEmail);
  await enabled(db);
  if (command.operation === "save_event") {
    const { operation: _, ...input } = command;
    void _;
    return saveTicketEvent(db, input, actorEmail);
  }
  if (command.operation === "reconcile") return reconcileTicketReservations(db, command.eventId);
  const { data, error } = await db
    .from("ticket_orders")
    .select("*")
    .eq("id", command.orderId)
    .maybeSingle();
  if (error || !data || data.state !== "paid") throw new Error("A paid ticket order is required");
  await sendTicketConfirmation(db, data as TicketOrder, true);
  await recordAudit(db, {
    actorEmail,
    action: "ticket_order.confirmation_reviewed",
    entityType: "ticket_order",
    entityId: command.orderId,
    source: "admin",
  });
  return {
    orderId: command.orderId,
    message: "Confirmation receipt checked; refresh the order to see delivery status.",
  };
}
export async function proposeTicketAdminCommand(
  db: SupabaseClient,
  raw: unknown,
  actorEmail: string,
) {
  const command = ticketAdminCommandSchema.parse(raw);
  await assertCurrentTenantAdmin(db, actorEmail);
  await enabled(db);
  const action = await proposeAction(db, {
    actionType: "event_ticketing_change",
    title:
      command.operation === "save_event"
        ? `Save workshop: ${command.event.title}`
        : command.operation === "reconcile"
          ? "Reconcile expired ticket reservations"
          : "Retry paid-ticket confirmation",
    description:
      "Apply this exact event operation after checking current workspace authority and event revision.",
    payload: command,
    sourceContext: "Administrator requested an event-ticketing change.",
    proposedBy: actorEmail,
    explicit: true,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    dedupeKey: `event-ticketing:${command.requestId}`,
  });
  if (
    !action ||
    JSON.stringify(ticketAdminCommandSchema.parse(action.payload)) !== JSON.stringify(command)
  )
    throw new Error("Event proposal request key was already used for a different command");
  return action;
}
