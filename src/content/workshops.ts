import type { EventDefinition } from "@/lib/revenue-os/event-ticketing-contract";

export const WORKSHOP_EVENT: EventDefinition = {
  slug: "ai-strategy-workshop-chicago-2026",
  title: "Feel More Confident Using AI",
  headline: "Feel more confident using AI.",
  description:
    "You’ve tried ChatGPT for emails or a little content. You know it can do more, but you’re not quite sure where to start. Join John Connor, AI automation expert and founder of Accelerate, for a friendly, hands-on workshop that helps you take the next step.",
  starts_at: "2026-11-11T12:00:00-06:00",
  ends_at: "2026-11-11T13:30:00-06:00",
  timezone: "America/Chicago",
  venue_name: "Ferris & Co.",
  venue_address: "1 W Monroe Street, Chicago, IL 60603",
  price_cents: 5000,
  capacity: 24,
  refund_cutoff: "2026-11-09T12:00:00-06:00",
  refund_policy:
    "Full refunds are available for requests received by noon Chicago time on November 9, 2026. Contact john@acceleratewith.us with your order reference. If Accelerate cancels the workshop, all tickets will be refunded in full.",
  support_description:
    "Bring your laptop and one task you’d like to make easier. Practice with guidance, ask questions throughout the session, and leave with ideas you can use the next day. Pizza is included.",
  status: "draft",
};
export const WORKSHOP_EVENT_ID = "acce1e8e-1111-4111-8111-202611110001";

export const WORKSHOP_GUIDES = [
  "get-better-answers-from-ai",
  "everyday-work-tasks-to-practice-with-ai",
  "what-to-bring-to-an-ai-workshop",
] as const;
