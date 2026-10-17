import { z } from "zod";
import { ACCELERATE_TENANT_SLUG } from "@/lib/tenancy/constants";

export const eventDefinitionSchema = z
  .object({
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(100),
    title: z.string().trim().min(1).max(160),
    headline: z.string().trim().min(1).max(180),
    description: z.string().trim().min(1).max(3000),
    starts_at: z.iso.datetime({ offset: true }),
    ends_at: z.iso.datetime({ offset: true }),
    timezone: z
      .string()
      .max(80)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: value });
          return true;
        } catch (error) {
          if (error instanceof RangeError) return false;
          throw error;
        }
      }, "Choose a valid time zone"),
    venue_name: z.string().trim().min(1).max(160),
    venue_address: z.string().trim().min(1).max(300),
    price_cents: z.number().int().min(100).max(10000000),
    capacity: z.number().int().min(1).max(10000),
    refund_cutoff: z.iso.datetime({ offset: true }),
    refund_policy: z.string().trim().min(1).max(1500),
    support_description: z.string().trim().min(1).max(1000),
    status: z.enum(["draft", "published", "paused", "closed"]),
  })
  .strict()
  .refine((event) => Date.parse(event.ends_at) > Date.parse(event.starts_at), {
    message: "End time must follow start time",
    path: ["ends_at"],
  })
  .refine((event) => Date.parse(event.refund_cutoff) <= Date.parse(event.starts_at), {
    message: "Refund cutoff must precede the workshop",
    path: ["refund_cutoff"],
  });
export type EventDefinition = z.infer<typeof eventDefinitionSchema>;
export type TicketEvent = EventDefinition & {
  id: string;
  tenant_id: string;
  revision: number;
  created_at: string;
  updated_at: string;
  paid_tickets?: number;
  reserved_tickets?: number;
  available_tickets?: number;
  gross_cents?: number;
  refunded_cents?: number;
};
export type TicketOrder = {
  id: string;
  tenant_id: string;
  event_id: string;
  request_id: string;
  request_digest: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  refund_cents: number;
  buyer_name: string;
  buyer_email: string;
  company: string;
  business_need: string;
  state: "reserved" | "checkout" | "paid" | "expired" | "refunded";
  event_snapshot: EventDefinition;
  attribution: Record<string, string>;
  stripe_account_id: string;
  livemode: boolean;
  stripe_session_id: string | null;
  stripe_checkout_url: string | null;
  payment_intent_id: string | null;
  expires_at: string;
  paid_at: string | null;
  created_at: string;
  email_status: "pending" | "sent" | "attention";
  email_error: string | null;
};
export type TicketOrderSummary = Omit<
  TicketOrder,
  "request_id" | "request_digest" | "stripe_checkout_url"
>;
export const ticketCheckoutSchema = z
  .object({
    requestId: z.uuid(),
    revision: z.number().int().positive(),
    quantity: z.number().int().min(1).max(40),
    name: z.string().trim().min(1).max(160),
    email: z
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    attribution: z
      .partialRecord(
        z.enum(["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]),
        z.string().max(160),
      )
      .default({}),
  })
  .strict();
export const saveTicketEventSchema = z
  .object({
    eventId: z.uuid(),
    revision: z.number().int().min(0),
    requestId: z.uuid(),
    event: eventDefinitionSchema,
  })
  .strict();
export const ticketAdminCommandSchema = z.discriminatedUnion("operation", [
  saveTicketEventSchema.extend({ operation: z.literal("save_event") }),
  z
    .object({ operation: z.literal("retry_confirmation"), orderId: z.uuid(), requestId: z.uuid() })
    .strict(),
  z.object({ operation: z.literal("reconcile"), eventId: z.uuid(), requestId: z.uuid() }).strict(),
]);
export const ticketAdminProposalSchema = z
  .object({ mode: z.literal("propose"), command: ticketAdminCommandSchema })
  .strict();
export function eventPath(tenantSlug: string, slug: string) {
  return `${tenantSlug === ACCELERATE_TENANT_SLUG ? "" : `/t/${encodeURIComponent(tenantSlug)}`}/events/${encodeURIComponent(slug)}`;
}
export function ticketMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);
}
export function eventTiming(event: Pick<EventDefinition, "starts_at" | "ends_at" | "timezone">) {
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: event.timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: event.timezone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  return {
    date: date.format(new Date(event.starts_at)),
    time: `${time.format(new Date(event.starts_at))} – ${time.format(new Date(event.ends_at))}`,
  };
}
export function eventLocalTime(iso: string, timezone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export function eventLocalToIso(local: string, timezone: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))
    throw new Error("Enter a complete date and time");
  const utc = Date.parse(`${local}:00Z`);
  let candidate = utc;
  for (let i = 0; i < 3; i++)
    candidate +=
      utc - Date.parse(`${eventLocalTime(new Date(candidate).toISOString(), timezone)}:00Z`);
  const iso = new Date(candidate).toISOString();
  if (eventLocalTime(iso, timezone) !== local)
    throw new Error("That local time does not exist in the selected time zone");
  return iso;
}
export function eventCalendar(event: EventDefinition, orderId: string) {
  const escape = (value: string) =>
    value
      .replace(/\\/g, "\\\\")
      .replace(/\r\n|\r|\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  const stamp = (value: string) =>
    new Date(value)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Business Runtime//Workshop//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${orderId}@accelerate-ticketing`,
    `DTSTAMP:${stamp(event.starts_at)}`,
    `DTSTART:${stamp(event.starts_at)}`,
    `DTEND:${stamp(event.ends_at)}`,
    `SUMMARY:${escape(event.title)}`,
    `LOCATION:${escape(`${event.venue_name}, ${event.venue_address}`)}`,
    `DESCRIPTION:${escape("Check your ticket confirmation for current admission status. Bring your business questions and an example of work you would like AI to help with.")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return (
    lines
      .map((line) => {
        let folded = "",
          current = "",
          bytes = 0;
        for (const character of line) {
          const size = new TextEncoder().encode(character).length;
          if (bytes + size > 74) {
            folded += current + "\r\n";
            current = " ";
            bytes = 1;
          }
          current += character;
          bytes += size;
        }
        return folded + current;
      })
      .join("\r\n") + "\r\n"
  );
}
export function ticketOrdersCsv(orders: ReadonlyArray<TicketOrderSummary>) {
  const cell = (value: unknown) => {
    const text = String(value ?? "");
    return `"${(/^[\s]*[=+@\-]|^[\t\r\n]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`;
  };
  return [
    [
      "Order",
      "Buyer",
      "Email",
      "Company",
      "Business need",
      "Tickets",
      "Status",
      "Paid USD",
      "Refunded USD",
      "Confirmation",
      "Stripe session",
    ],
    ...orders.map((o) => [
      o.id,
      o.buyer_name,
      o.buyer_email,
      o.company,
      o.business_need,
      o.quantity,
      o.state,
      o.paid_at ? (o.total_cents / 100).toFixed(2) : "0.00",
      (o.refund_cents / 100).toFixed(2),
      o.email_status,
      o.stripe_session_id,
    ]),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
}
