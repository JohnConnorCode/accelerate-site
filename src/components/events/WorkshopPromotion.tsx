import { WORKSHOP_EVENT_ID } from "@/content/workshops";
import Link from "next/link";
import { ACCELERATE_TENANT_SLUG } from "@/lib/tenancy/constants";
import { loadPublicTicketEvent } from "@/lib/revenue-os/event-ticketing";
import { eventPath, eventTiming, ticketMoney } from "@/lib/revenue-os/event-ticketing-contract";
import styles from "./workshop.module.css";
import { WorkshopBanner } from "./WorkshopBanner";
export async function WorkshopPromotion() {
  const event = await loadPublicTicketEvent(
    ACCELERATE_TENANT_SLUG,
    { eventId: WORKSHOP_EVENT_ID },
    true,
  ).catch(() => null);
  if (!event) return null;
  const href = eventPath(ACCELERATE_TENANT_SLUG, event.slug);
  const timing = eventTiming(event);
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: event.timezone,
    month: "short",
    day: "numeric",
  }).format(new Date(event.starts_at));
  return (
    <>
      <WorkshopBanner
        eventId={event.id}
        startsAt={event.starts_at}
        headline={event.headline}
        schedule={`${date} · ${timing.time} · ${event.venue_name}`}
        href={href}
        price={ticketMoney(event.price_cents)}
        available={event.available_tickets}
      />
      <noscript>
        <section className={styles.promotion} aria-label="Upcoming workshop">
          <div>
            <p>
              {timing.date} · {event.venue_name}
            </p>
            <h2>{event.title}</h2>
          </div>
          <Link href={href}>
            Workshop tickets · {ticketMoney(event.price_cents)} <span aria-hidden="true">↗</span>
          </Link>
        </section>
      </noscript>
    </>
  );
}
