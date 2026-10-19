import Link from "next/link";
import {
  ArrowUpRight,
  ClipboardList,
  MessageSquareText,
  NotebookPen,
  Workflow,
} from "lucide-react";
import type { TeamMember } from "@/content/team";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import styles from "./workshop.module.css";

export function WorkshopLearningSections({
  capacity,
  price,
  presenters,
}: {
  capacity: number;
  price: string;
  presenters: TeamMember[];
}) {
  return (
    <>
      <AnimateOnScroll>
        <section className={styles.workshopSection} aria-labelledby="comfortable">
          <div className={styles.sectionHeading}>
            <span aria-hidden="true">01</span>
            <h2 id="comfortable">A comfortable place to learn.</h2>
          </div>
          <div className={styles.prose}>
            <p>
              AI is moving fast. Keeping up can feel overwhelming, especially when it seems like
              everyone else already knows what they’re doing. You don’t have to figure it all out on
              your own.
            </p>
            <p>
              This is a welcoming space to try things, build your skills, and get help along the
              way. Ask us to explain a term, repeat a step, or help you get unstuck. There are no
              stupid questions.
            </p>
            <p className={styles.reassurance}>
              You don’t need to be tech-savvy. Just come ready to learn.
            </p>
          </div>
        </section>
      </AnimateOnScroll>
      <AnimateOnScroll>
        <section className={styles.workshopSection} aria-labelledby="takeaways">
          <div className={styles.sectionHeading}>
            <span aria-hidden="true">02</span>
            <h2 id="takeaways">Practical skills you can use at work.</h2>
          </div>
          <div className={styles.takeaways}>
            {[
              {
                Icon: MessageSquareText,
                title: "Get better answers",
                copy: "Give AI clearer instructions and use simple follow-up questions to improve the result.",
              },
              {
                Icon: ClipboardList,
                title: "Go beyond emails and content",
                copy: "Practice preparing for meetings, organizing information, and planning your work.",
              },
              {
                Icon: NotebookPen,
                title: "Make an everyday task easier",
                copy: "Try a task from your own work, with someone there to walk you through the steps.",
              },
              {
                Icon: Workflow,
                title: "Know what to try next",
                copy: "Explore useful tools and simple automations, and understand where they could help you.",
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
        <section className={styles.support} aria-labelledby="practice">
          <p className={styles.eyebrow}>Learn by doing</p>
          <h2 id="practice">Bring your laptop. We’ll work through it together.</h2>
          <p>
            You’ll follow along, practice, and ask questions throughout the session. Bring one task
            you’d like to make easier:
          </p>
          <ul className={styles.practiceTasks}>
            <li>Following up with clients</li>
            <li>Planning your content</li>
            <li>Tackling a weekly report</li>
          </ul>
          <p>
            Our goal is to help you leave with something you’ve practiced, ideas you can use the
            next day, and more confidence using AI yourself.
          </p>
          <Link href="/learn/what-to-bring-to-an-ai-workshop">
            Choose a task to bring <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </section>
      </AnimateOnScroll>
      <AnimateOnScroll>
        <section className={styles.workshopSection} aria-labelledby="small-group">
          <div className={styles.sectionHeading}>
            <span aria-hidden="true">03</span>
            <h2 id="small-group">A small group and personal attention.</h2>
          </div>
          <div className={styles.prose}>
            <p>
              We’re limiting the workshop to {capacity} participants to make room for questions,
              conversation, and hands-on help.
            </p>
            <p>
              Enjoy pizza and connect with other Chicago professionals who are building their skills
              alongside you. No coding or technical background is needed.
            </p>
          </div>
        </section>
      </AnimateOnScroll>
      <AnimateOnScroll>
        <section className={styles.workshopSection} aria-labelledby="presenters">
          <div className={styles.sectionHeading}>
            <span aria-hidden="true">04</span>
            <h2 id="presenters">Meet your hosts.</h2>
          </div>
          <div className={styles.speakers}>
            {presenters.map((member) => (
              <article key={member.slug}>
                <p className={styles.role}>
                  {member.slug === "john-connor" ? "Your guide" : "Co-host"}
                </p>
                <h3>{member.name}</h3>
                <p>
                  {member.slug === "john-connor"
                    ? "John is an AI automation expert and founder of Accelerate. He’ll guide the session, walk you through the steps, and welcome your questions along the way."
                    : "Matthew co-hosts the workshop with John, bringing experience in business development, partnerships, and live events."}
                </p>
                <Link href={`/team/${member.slug}`}>
                  Meet {member.slug === "john-connor" ? "John" : "Matthew"}{" "}
                  <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
          <div className={styles.closingNote}>
            <p>Invest {price} and 90 minutes in yourself, with someone there to help.</p>
            <a href="#tickets">
              Reserve your seat <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </div>
        </section>
      </AnimateOnScroll>
    </>
  );
}
