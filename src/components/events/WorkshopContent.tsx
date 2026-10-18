import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, MapPin, ScanSearch, Workflow, Route } from "lucide-react";
import { getTeamMember } from "@/content/team";
import {
  eventTiming,
  ticketMoney,
  type TicketEvent,
} from "@/lib/revenue-os/event-ticketing-contract";
import { ACCELERATE_TENANT_SLUG } from "@/lib/tenancy/constants";
import { distributionProfile } from "@/lib/distribution/profile";
import { PublicHeroEntrance } from "@/components/motion/PublicHeroEntrance";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { EventCheckout } from "./EventCheckout";
import styles from "./workshop.module.css";

export function WorkshopContent({
  event,
  tenantSlug,
  preview = false,
}: {
  event: TicketEvent;
  tenantSlug: string;
  preview?: boolean;
}) {
  const timing = eventTiming(event);
  const branded = distributionProfile() === "branded" && tenantSlug === ACCELERATE_TENANT_SLUG;
  const presenters = branded
    ? ["john-connor", "matthew-rolnick"].map(getTeamMember).filter((member) => member !== null)
    : [];
  const starts = new Date(event.starts_at);
  const datePart = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { timeZone: event.timezone, ...options }).format(starts);
  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        {preview && (
          <p className={styles.preview} role="status">
            Administrator preview · {event.status} · checkout disabled
          </p>
        )}
        <PublicHeroEntrance className={styles.hero} aria-labelledby="workshop-heading">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow} data-hero-step="1">
              <span className={styles.liveDot} aria-hidden="true" /> In-person business workshop
            </p>
            <h1 id="workshop-heading" data-hero-step="2">
              {event.headline}
            </h1>
            <p className={styles.intro} data-hero-step="3">
              {event.description}
            </p>
            <div className={styles.heroAction} data-hero-step="4">
              <a href="#tickets" className={styles.heroCta}>
                Reserve your place · {ticketMoney(event.price_cents)}{" "}
                <ArrowUpRight size={18} aria-hidden="true" />
              </a>
            </div>
          </div>
          <div className={styles.heroVisual} data-hero-step="4">
            <time className={styles.datePlate} dateTime={event.starts_at} aria-label={timing.date}>
              <span>
                {datePart({ month: "short" })}
                <small>{datePart({ year: "numeric" })}</small>
              </span>
              <strong>{datePart({ day: "numeric" })}</strong>
              <span className={styles.dateDay}>{datePart({ weekday: "long" })}</span>
            </time>
            {presenters.length > 0 && (
              <div className={styles.heroPresenters}>
                {presenters.map((member) => (
                  <figure key={member.slug}>
                    <Image
                      src={member.image}
                      alt={member.name}
                      width={220}
                      height={260}
                      sizes="(max-width: 800px) 40vw, 180px"
                      className={styles.heroPortrait}
                    />
                    <figcaption>
                      <span>{member.name}</span>
                      <small>{member.role}</small>
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
          <dl className={styles.facts} data-hero-step="5">
            <div>
              <dt>
                <CalendarDays size={20} aria-hidden="true" />
                When
              </dt>
              <dd>
                {timing.date}
                <br />
                {timing.time}
              </dd>
            </div>
            <div>
              <dt>
                <MapPin size={20} aria-hidden="true" />
                Where
              </dt>
              <dd>
                {event.venue_name}
                <br />
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue_address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {event.venue_address} <ArrowUpRight size={12} aria-hidden="true" />
                </a>
              </dd>
            </div>
          </dl>
        </PublicHeroEntrance>
        <div className={styles.layout}>
          <AnimateOnScroll className={styles.checkoutWrap} delay={0.12}>
            <EventCheckout event={event} tenantSlug={tenantSlug} preview={preview} />
          </AnimateOnScroll>
          <div className={styles.content}>
            <AnimateOnScroll>
              <section className={styles.section} aria-labelledby="takeaways">
                <div className={styles.sectionHeading}>
                  <span aria-hidden="true">01</span>
                  <h2 id="takeaways">Leave knowing what to do first.</h2>
                </div>
                <div className={styles.takeaways}>
                  {[
                    {
                      Icon: ScanSearch,
                      title: "Find the useful opportunities",
                      copy: "Look at the work your business does every day and identify where AI could return time, improve service, or support new revenue.",
                    },
                    {
                      Icon: Workflow,
                      title: "See the workflows in action",
                      copy: "Follow real examples of customer follow-up, repetitive administration, and reporting. Understand how the pieces connect and where people stay in control.",
                    },
                    {
                      Icon: Route,
                      title: "Choose a practical starting point",
                      copy: "Prioritize an opportunity for your own business, define a first step, and decide what a useful result would look like.",
                    },
                  ].map(({ Icon, title, copy }) => (
                    <article key={title}>
                      <div className={styles.takeawayIcon}>
                        <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
                      </div>
                      <div>
                        <h3>{title}</h3>
                        <p>{copy}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </AnimateOnScroll>
            <AnimateOnScroll>
              <section className={styles.section} aria-labelledby="agenda">
                <div className={styles.sectionHeading}>
                  <span aria-hidden="true">02</span>
                  <h2 id="agenda">A focused 90 minutes.</h2>
                </div>
                <ol className={styles.agenda}>
                  {[
                    [
                      "10 min",
                      "Start with the business",
                      "Identify the work consuming time and the opportunities that could support revenue.",
                    ],
                    [
                      "20 min",
                      "Shape your AI strategy",
                      "Choose where to start, what to measure, and what your team needs to make it work.",
                    ],
                    [
                      "35 min",
                      "Watch practical demonstrations",
                      "See complete business workflows, with room to ask how they could apply to your operation.",
                    ],
                    [
                      "20 min",
                      "Apply the ideas",
                      "Map a first use case and the next steps for your own business.",
                    ],
                    [
                      "5 min",
                      "Questions and next steps",
                      "Clarify your starting point and the support available after the workshop.",
                    ],
                  ].map(([time, title, description]) => (
                    <li key={title}>
                      <span>{time}</span>
                      <div>
                        <h3>{title}</h3>
                        <p>{description}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            </AnimateOnScroll>
            {presenters.length > 0 && (
              <AnimateOnScroll>
                <section className={styles.section} aria-labelledby="presenters">
                  <div className={styles.sectionHeading}>
                    <span aria-hidden="true">03</span>
                    <h2 id="presenters">Your presenters.</h2>
                  </div>
                  <div className={styles.speakers}>
                    {presenters.map((member) => (
                      <article key={member.slug}>
                        <p className={styles.role}>{member.role}, Accelerate</p>
                        <h3>{member.name}</h3>
                        <p>
                          {member.slug === "john-connor"
                            ? "John helps businesses decide where AI belongs, then builds and manages the systems that put the strategy to work. He is the founder of Accelerate and SuperDebate."
                            : "Matthew brings experience in partnerships, business development, and live events. His work spans sales leadership at Groupon and strategy and innovation at Yaymaker."}
                        </p>
                        <Link href={`/team/${member.slug}`}>
                          Meet {member.slug === "john-connor" ? "John" : "Matthew"}{" "}
                          <ArrowUpRight size={16} aria-hidden="true" />
                        </Link>
                      </article>
                    ))}
                  </div>
                </section>
              </AnimateOnScroll>
            )}
            <AnimateOnScroll>
              <section className={styles.support} aria-labelledby="support">
                <h2 id="support">Support beyond the workshop.</h2>
                <p>{event.support_description}</p>
                {branded && (
                  <Link href="/contact">
                    Talk with us about implementation <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                )}
              </section>
            </AnimateOnScroll>
            <AnimateOnScroll>
              <section className={styles.prepare} aria-labelledby="prepare">
                <h2 id="prepare">Come with a business question.</h2>
                <p>
                  This workshop is for business owners, leaders, and operators getting started with
                  AI or deciding what to do next. You do not need a technical background. Bring an
                  example of work you would like to improve. A laptop is helpful if you want to work
                  along.
                </p>
              </section>
            </AnimateOnScroll>
          </div>
        </div>
      </div>
    </div>
  );
}
