import { WORKSHOP_EVENT, WORKSHOP_EVENT_ID } from "@/content/workshops";
import {
  ticketAdminCommandSchema,
  ticketAdminProposalSchema,
  ticketOrdersCsv,
  type TicketEvent,
  type TicketOrderSummary,
} from "@/lib/revenue-os/event-ticketing-contract";
import type { DemoBusinessState } from "./business-runtime";
import type { DemoState } from "./runtime";

export type DemoEventTicketState = {
  events: TicketEvent[];
  orders: TicketOrderSummary[];
  commands: Record<string, { input: string; result: unknown }>;
};
/** Same admin UI and command parser, with browser-session receipts only. This
 * adapter has no database, provider or public checkout capability. */
export function handleDemoEventTickets(
  scenarioId: string,
  state: DemoState,
  business: DemoBusinessState,
  path: string,
  method: string,
  raw: Record<string, unknown>,
  params: URLSearchParams,
  save: () => void,
): Response | null {
  const action =
    path === "/api/admin/revenue-os/actions" && method === "PATCH"
      ? business.actions.find(
          (item) => item.id === raw.id && item.action_type === "event_ticketing_change",
        )
      : undefined;
  if (!action && path !== "/api/admin/events" && path !== "/api/admin/events/export") return null;
  if (action) {
    if (action.status !== "pending" || Date.parse(action.expires_at ?? "") <= Date.now())
      return Response.json({ error: "Proposal already handled or expired" }, { status: 409 });
    if (raw.decision === "reject") {
      action.status = "rejected";
      save();
      return Response.json({ simulated: true, result: { status: "rejected" } });
    }
    if (raw.decision !== "approve")
      return Response.json({ error: "Invalid decision" }, { status: 400 });
  }
  if (state.moduleOverrides["event-ticketing"] !== true)
    return Response.json(
      { error: "Events & Tickets is disabled in this demo workspace.", simulated: true },
      { status: 403 },
    );
  if (!business.eventTickets) {
    const now = new Date().toISOString();
    const event: TicketEvent = {
      ...WORKSHOP_EVENT,
      id: WORKSHOP_EVENT_ID,
      tenant_id: scenarioId,
      revision: 1,
      slug: "fictional-ai-workshop",
      title: "AI workflow planning lab",
      headline: "Choose a useful first workflow.",
      description:
        "A fictional workshop for local business operators to explore useful AI workflows.",
      venue_name: "Example workshop room",
      venue_address: "10 Example Avenue, Example City",
      refund_policy: "This is a fictional refund policy. No payment is collected in the demo.",
      support_description:
        "This fictional example offers optional implementation support separately.",
      created_at: now,
      updated_at: now,
    };
    business.eventTickets = {
      events: [event],
      commands: {},
      orders: [
        {
          id: "11111111-1111-4111-8111-111111111199",
          tenant_id: scenarioId,
          event_id: event.id,
          quantity: 2,
          unit_price_cents: 5000,
          total_cents: 10000,
          refund_cents: 0,
          buyer_name: "Casey Example",
          buyer_email: "casey@workshop.example",
          company: "Example Services",
          business_need: "A fictional customer follow-up workflow",
          state: "paid",
          event_snapshot: event,
          attribution: {},
          stripe_account_id: "acct_fictional",
          livemode: false,
          stripe_session_id: null,
          payment_intent_id: null,
          expires_at: now,
          paid_at: now,
          created_at: now,
          email_status: "attention",
          email_error: "Simulated confirmation needs a retry.",
        },
      ],
    };
    save();
  }
  const data = business.eventTickets;
  const eventId = params.get("eventId");
  const events = data.events.filter((event) => !eventId || event.id === eventId);
  const orders = data.orders.filter((order) => !eventId || order.event_id === eventId);
  if (method === "GET") {
    if (path.endsWith("/export"))
      return new Response(ticketOrdersCsv(orders), {
        headers: { "Content-Type": "text/csv; charset=utf-8" },
      });
    return Response.json({
      tenantSlug: scenarioId,
      events: events.map((event) => ({
        ...event,
        paid_tickets: 0,
        reserved_tickets: 0,
        available_tickets: event.capacity,
        gross_cents: 0,
        refunded_cents: 0,
      })),
      orders,
      truncated: false,
      simulated: true,
    });
  }
  if (!action && (method !== "POST" || path.endsWith("/export")))
    return Response.json(
      { error: "Unsupported event operation", simulated: true },
      { status: 405 },
    );
  try {
    const proposal = !action ? ticketAdminProposalSchema.safeParse(raw) : null;
    if (proposal?.success) {
      const command = proposal.data.command;
      const existing = business.actions.find(
        (item) =>
          item.action_type === "event_ticketing_change" &&
          item.status === "pending" &&
          item.payload?.requestId === command.requestId,
      );
      if (existing) {
        if (
          JSON.stringify(ticketAdminCommandSchema.parse(existing.payload)) !==
          JSON.stringify(command)
        )
          throw new Error("Event proposal request key already used");
        return Response.json({ action: existing, simulated: true });
      }
      const pending = {
        id: crypto.randomUUID(),
        action_type: "event_ticketing_change",
        title:
          command.operation === "save_event"
            ? `Save workshop: ${command.event.title}`
            : command.operation === "reconcile"
              ? "Reconcile expired ticket reservations"
              : "Retry paid-ticket confirmation",
        description: "Applies this exact command to fictional event records after approval.",
        status: "pending",
        error: null,
        payload: command,
        result: null,
        pluginId: "event-ticketing",
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      };
      business.actions.push(pending);
      save();
      return Response.json({ action: pending, simulated: true });
    }
    const command = ticketAdminCommandSchema.parse(action?.payload ?? raw);
    const previous = data.commands[command.requestId];
    if (previous) {
      if (previous.input !== JSON.stringify(command)) throw new Error("Request key already used");
      if (action) {
        action.status = "executed";
        action.result = previous.result as Record<string, unknown>;
        save();
      }
      return Response.json({ saved: true, result: previous.result, simulated: true });
    }
    let result: unknown;
    if (command.operation === "save_event") {
      const current = data.events.find((event) => event.id === command.eventId);
      if ((current?.revision ?? 0) !== command.revision)
        throw new Error("Event changed; reload before saving");
      const event: TicketEvent = {
        ...command.event,
        id: command.eventId,
        tenant_id: scenarioId,
        revision: command.revision + 1,
        created_at: current?.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (current) data.events[data.events.indexOf(current)] = event;
      else data.events.push(event);
      result = event;
    } else if (command.operation === "retry_confirmation") {
      const order = data.orders.find((item) => item.id === command.orderId);
      if (!order || order.state !== "paid") throw new Error("A paid order is required");
      order.email_status = "sent";
      order.email_error = null;
      result = { orderId: order.id, simulated: true };
    } else result = { checked: 0, needsReview: 0, truncated: false, simulated: true };
    data.commands[command.requestId] = { input: JSON.stringify(command), result };
    business.receipts.push({
      id: command.requestId,
      operation: `event-ticketing.${command.operation}`,
      at: new Date().toISOString(),
      simulated: true,
    });
    if (action) {
      action.status = "executed";
      action.result = { simulated: true, operation: command.operation };
    }
    save();
    return Response.json({ saved: true, result, simulated: true });
  } catch (error) {
    if (action) {
      action.status = "failed";
      action.error = error instanceof Error ? error.message : "Event change failed";
      save();
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Event change failed", simulated: true },
      { status: 409 },
    );
  }
}
