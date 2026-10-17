import { WORKSHOP_EVENT_ID } from "@/content/workshops";
import Link from "next/link";
import { ACCELERATE_TENANT_SLUG } from "@/lib/tenancy/constants";
import { loadPublicTicketEvent } from "@/lib/revenue-os/event-ticketing";
import { eventPath, eventTiming, ticketMoney } from "@/lib/revenue-os/event-ticketing-contract";
import styles from "./workshop.module.css";
export async function WorkshopPromotion() {
  const event = await loadPublicTicketEvent(
    ACCELERATE_TENANT_SLUG,
    { eventId: WORKSHOP_EVENT_ID },
    true,
  ).catch(() => null);
  if (!event) return null;
  return (
    <section className={styles.promotion} aria-label="Upcoming workshop">
      <div>
        <p>
          {eventTiming(event).date} · {event.venue_name}
        </p>
        <h2>{event.title}</h2>
      </div>
      <Link href={eventPath(ACCELERATE_TENANT_SLUG, event.slug)}>
        Workshop tickets · {ticketMoney(event.price_cents)} <span aria-hidden="true">↗</span>
      </Link>
    </section>
  );
}
