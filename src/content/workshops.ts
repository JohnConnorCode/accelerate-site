import type { EventDefinition } from "@/lib/revenue-os/event-ticketing-contract";

export const WORKSHOP_EVENT: EventDefinition = {
  slug: "ai-strategy-workshop-chicago-2026",
  title: "AI for Your Business: A Practical Strategy Workshop",
  headline: "Build an AI strategy you can put to work.",
  description:
    "Join John Connor and Matthew Rolnick for a practical workshop on using AI to grow revenue and get time back. See real business workflows in action, identify opportunities in your own company, and leave with clear priorities for getting started.",
  starts_at: "2026-11-11T12:00:00-06:00",
  ends_at: "2026-11-11T13:30:00-06:00",
  timezone: "America/Chicago",
  venue_name: "Ferris & Co.",
  venue_address: "1 W Monroe Street, Chicago, IL 60603",
  price_cents: 5000,
  capacity: 40,
  refund_cutoff: "2026-11-09T12:00:00-06:00",
  refund_policy:
    "Full refunds are available for requests received by noon Chicago time on November 9, 2026. Contact john@acceleratewith.us with your order reference. If Accelerate cancels the workshop, all tickets will be refunded in full.",
  support_description:
    "Want help putting your strategy into practice? Optional one-on-one implementation support is available after the workshop and is priced separately from admission.",
  status: "draft",
};
export const WORKSHOP_EVENT_ID = "acce1e8e-1111-4111-8111-202611110001";
