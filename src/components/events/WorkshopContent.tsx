import Image from "next/image";
import Link from "next/link";
import { getTeamMember } from "@/content/team";
import { eventTiming, type TicketEvent } from "@/lib/revenue-os/event-ticketing-contract";
import { ACCELERATE_TENANT_SLUG } from "@/lib/tenancy/constants";
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
  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        {preview && (
          <p className={styles.preview} role="status">
            Administrator preview · {event.status} · checkout disabled
          </p>
        )}
        <div className={styles.layout}>
          <div className={styles.content}>
            <header className={styles.hero}>
              <p className={styles.eyebrow}>In-person business workshop</p>
              <h1>{event.headline}</h1>
              <p className={styles.intro}>{event.description}</p>
              <dl className={styles.facts}>
                <div>
                  <dt>When</dt>
                  <dd>
                    {timing.date}
                    <br />
                    {timing.time}
                  </dd>
                </div>
                <div>
                  <dt>Where</dt>
                  <dd>
                    {event.venue_name}
                    <br />
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue_address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {event.venue_address}
                    </a>
                  </dd>
                </div>
              </dl>
              <a href="#tickets" className={styles.mobileCta}>
                See tickets and availability
              </a>
            </header>
            <section className={styles.section} aria-labelledby="takeaways">
              <h2 id="takeaways">Leave knowing what to do first.</h2>
              <div className={styles.takeaways}>
                <article>
                  <span>01</span>
                  <h3>Find the useful opportunities</h3>
                  <p>
                    Look at the work your business does every day and identify where AI could return
                    time, improve service, or support new revenue.
                  </p>
                </article>
                <article>
                  <span>02</span>
                  <h3>See the workflows in action</h3>
                  <p>
                    Follow real examples of customer follow-up, repetitive administration, and
                    reporting. Understand how the pieces connect and where people stay in control.
                  </p>
                </article>
                <article>
                  <span>03</span>
                  <h3>Choose a practical starting point</h3>
                  <p>
                    Prioritize an opportunity for your own business, define a first step, and decide
                    what a useful result would look like.
                  </p>
                </article>
              </div>
            </section>
            <section className={styles.section} aria-labelledby="agenda">
              <h2 id="agenda">A focused 90 minutes.</h2>
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
            {tenantSlug === ACCELERATE_TENANT_SLUG && (
              <section className={styles.section} aria-labelledby="presenters">
                <h2 id="presenters">Your presenters.</h2>
                <div className={styles.speakers}>
                  {["john-connor", "matthew-rolnick"].map((slug) => {
                    const member = getTeamMember(slug)!;
                    return (
                      <article key={slug}>
                        <Image
                          src={member.image}
                          alt={member.name}
                          width={160}
                          height={160}
                          className={styles.portrait}
                        />
                        <div>
                          <h3>{member.name}</h3>
                          <p className={styles.role}>{member.role}, Accelerate</p>
                          <p>
                            {slug === "john-connor"
                              ? "John helps businesses decide where AI belongs, then builds and manages the systems that put the strategy to work."
                              : "Matthew brings experience in partnerships, business development, and live events, connecting practical ideas with the people and opportunities that move a business forward."}
                          </p>
                          <Link href={`/team/${slug}`}>
                            Meet {slug === "john-connor" ? "John" : "Matthew"}{" "}
                            <span aria-hidden="true">↗</span>
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
            <section className={styles.support} aria-labelledby="support">
              <h2 id="support">Support beyond the workshop.</h2>
              <p>{event.support_description}</p>
              {tenantSlug === ACCELERATE_TENANT_SLUG && (
                <Link href="/contact">
                  Talk with us about implementation <span aria-hidden="true">↗</span>
                </Link>
              )}
            </section>
            <section className={styles.section} aria-labelledby="prepare">
              <h2 id="prepare">Come with a business question.</h2>
              <p>
                This workshop is for business owners, leaders, and operators getting started with AI
                or deciding what to do next. You do not need a technical background. Bring an
                example of work you would like to improve. A laptop is helpful if you want to work
                along.
              </p>
            </section>
          </div>
          <EventCheckout event={event} tenantSlug={tenantSlug} preview={preview} />
        </div>
      </div>
    </main>
  );
}
