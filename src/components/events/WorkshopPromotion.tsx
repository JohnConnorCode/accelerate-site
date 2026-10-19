import { WORKSHOP_EVENT_ID } from "@/content/workshops";
import { getTeamMember } from "@/content/team";
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
  const dateFormat = {
    timeZone: event.timezone,
  };
  const starts = new Date(event.starts_at);
  const date = {
    month: new Intl.DateTimeFormat("en-US", { ...dateFormat, month: "short" }).format(starts),
    day: new Intl.DateTimeFormat("en-US", { ...dateFormat, day: "numeric" }).format(starts),
    label: timing.date,
  };
  const presenters = ["john-connor", "matthew-rolnick"]
    .map(getTeamMember)
    .filter((member) => member !== null)
    .map(({ name, image }) => ({ name, image }));
  return (
    <>
      <WorkshopBanner
        startsAt={event.starts_at}
        date={date}
        headline={event.headline}
        schedule={timing.time}
        venue={event.venue_name}
        presenters={presenters}
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
            View workshop · {ticketMoney(event.price_cents)} <span aria-hidden="true">↗</span>
          </Link>
        </section>
      </noscript>
    </>
  );
}
