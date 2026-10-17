import { notFound, redirect } from "next/navigation";
import { WORKSHOP_EVENT_ID } from "@/content/workshops";
import { ACCELERATE_TENANT_SLUG } from "@/lib/tenancy/constants";
import { loadPublicTicketEvent } from "@/lib/revenue-os/event-ticketing";
import { eventPath } from "@/lib/revenue-os/event-ticketing-contract";

export const dynamic = "force-dynamic";

export default async function WorkshopLink() {
  const event = await loadPublicTicketEvent(ACCELERATE_TENANT_SLUG, {
    eventId: WORKSHOP_EVENT_ID,
  });
  if (!event) notFound();
  redirect(eventPath(ACCELERATE_TENANT_SLUG, event.slug));
}
