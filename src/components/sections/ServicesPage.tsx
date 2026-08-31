"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Check, ArrowUpRight, Compass, Workflow, TrendingUp, MessageCircle, PenTool, BarChart3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { Section, Container, Eyebrow, Heading, BookCallButton, useReveal, CallTerms } from "@/components/v2/studio/primitives";
import { RevealHeading } from "@/components/v2/studio/RevealHeading";
import { HERO_HEADING } from "@/lib/type-recipes";
import { ApprovalQueue } from "@/components/command-center/ApprovalQueue";
import type { LiveQueueItem } from "@/components/command-center/ApprovalQueue";
import { services } from "@/content/services";
import { trackConversion } from "@/lib/analytics";

const iconMap: Record<string, LucideIcon> = {
  Compass, Workflow, TrendingUp, MessageCircle, PenTool, BarChart3,
};

const SERVICE_QUEUE: LiveQueueItem[] = [
  { id: "scope", kind: "note", title: "Scope mapped to the operating constraint", because: "The sequence of work is ready for review." },
  { id: "workflow", kind: "task", title: "Workflow build moved into testing", because: "The handoff is being tested against the real process." },
  { id: "integration", kind: "deal", title: "Core tools connected", because: "The system can now pass the right context between teams." },
  { id: "handoff", kind: "calendar", title: "Team handoff scheduled", because: "The people who run it are included before it goes live." },
  { id: "improve", kind: "email", title: "Weekly improvement brief prepared", because: "The next useful change is waiting with the evidence." },
];

/* One editorial service row: the service's reason first, then the concrete
   work. This avoids repeating a decorative "live demo" in every card. */
function ServiceBand({
  service,
  ordinal,
}: {
  service: (typeof services)[number];
  ordinal: number;
}) {
  const Icon = iconMap[service.icon];
  const ref = useReveal<HTMLElement>();

  return (
    <section
      ref={ref}
      id={service.id}
      className="services-band section-reveal scroll-mt-[126px]"
    >
      <div className="page-shell services-band-grid">
        <div className="services-band-intro">
          <div>
            {Icon && (
              <span className="services-band-icon">
                <Icon className="h-5 w-5" strokeWidth={1.6} />
              </span>
            )}
            <p className="services-band-number">{String(ordinal).padStart(2, "0")}</p>
            <h2 className="services-band-title">{service.name}</h2>
            <p className="services-band-problem">
              {service.problemStatement}
            </p>
            <p className="services-band-description">
              {service.description}
            </p>
          </div>
        </div>

        <div className="services-band-deliverables">
          <div>
            <p className="services-band-deliverables-label">
              What you get
            </p>
            <ul className="services-band-deliverables-list">
              {service.deliverables.map((d) => (
                <li key={d}>
                  <Check aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
            <div className="services-band-action">
              <p>{service.pricingDisplay}</p>
              <Link
                href="/contact"
                data-cursor="link"
                onClick={() => trackConversion("Service Get Started", { service: service.name })}
                className="services-band-link"
              >
                <span>Start a conversation</span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { n: "01", t: "The session", d: "Thirty minutes on how the business works, what the team wants to change, and where time or revenue is being lost." },
  { n: "02", t: "The recommendation", d: "A written view of where AI fits, the right type of solution, what should happen first, and why." },
  { n: "03", t: "The delivery", d: "We provide the agreed consulting, custom build, integrations, training, or managed execution against a clear scope." },
  { n: "04", t: "The improvement", d: "When ongoing help makes sense, we operate the work, support the team, measure what changes, and keep improving it." },
];

export function ServicesPageContent() {
  const [activeId, setActiveId] = useState<string>(services[0]!.id);
  const quickNavRef = useRef<HTMLDivElement>(null);

  // Scrollspy tracks the reading line rather than a zero-height observer
  // window. The old observer could miss a section entirely on short mobile
  // viewports, leaving the rail stale while the reader continued down-page.
  useEffect(() => {
    let frame = 0;
    const updateActiveService = () => {
      frame = 0;
      const readingLine = Math.max(144, window.innerHeight * 0.38);
      let nextId = services[0]!.id;
      for (const service of services) {
        const section = document.getElementById(service.id);
        if (section && section.getBoundingClientRect().top <= readingLine) nextId = service.id;
      }
      setActiveId((current) => current === nextId ? current : nextId);
    };
    const scheduleUpdate = () => {
      if (!frame) frame = requestAnimationFrame(updateActiveService);
    };
    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, []);

  // Keep the selected item centered inside the rail. Scrolling the rail
  // directly never changes the document's vertical scroll position.
  useEffect(() => {
    const rail = quickNavRef.current;
    const activeLink = rail?.querySelector<HTMLElement>(`[data-service-id="${activeId}"]`);
    if (!rail || !activeLink) return;
    const left = activeLink.offsetLeft - (rail.clientWidth - activeLink.offsetWidth) / 2;
    rail.scrollTo({ left: Math.max(0, left), behavior: "auto" });
  }, [activeId]);

  return (
    <>
      <section className="page-offset-roomy relative flex min-h-[88vh] items-center overflow-hidden pb-20">
        <Container width="wide">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div className="min-w-0">
              <AnimateOnScroll><Eyebrow className="mb-7">what we do</Eyebrow></AnimateOnScroll>
              <RevealHeading
                as="h1"
                className={HERO_HEADING}
                lead="AI strategy and solutions."
                accent="Built around your business."
                delay={0.1}
              />
              <AnimateOnScroll delay={0.25}>
                <p className="mt-7 max-w-xl text-lg leading-relaxed text-white-secondary">
                  We help you decide where AI belongs, build the right workflows, agents, tools, and integrations, and stay involved through execution, training, and improvement.
                </p>
              </AnimateOnScroll>
              <AnimateOnScroll delay={0.35}>
                <div className="mt-9 flex items-center gap-6">
                  <BookCallButton location="services_inline" />
                  <Link
                    href="#strategy"
                    data-cursor="link"
                    className="text-sm font-medium text-white-secondary underline-offset-4 transition-colors hover:text-gold hover:underline"
                  >
                    See how we help
                  </Link>
                </div>
              </AnimateOnScroll>
            </div>

            <AnimateOnScroll as="div" delay={0.2} className="relative min-w-0">
              <ApprovalQueue
                items={SERVICE_QUEUE}
                header="delivery queue"
                actions={["Map", "Build", "Run"]}
                footer={["Completed today", "Running / improving"]}
                initialCount={18}
              />
            </AnimateOnScroll>
          </div>
        </Container>
      </section>

      {/* Sticky service quick-nav — follows the current service on its own. */}
      <nav
        className="services-subnav sticky z-[80]"
        aria-label="Service quick navigation"
      >
        <div ref={quickNavRef} className="services-subnav-rail page-shell">
          {services.map((service) => {
            const Icon = iconMap[service.icon];
            const isActive = activeId === service.id;
            return (
              <a
                key={service.id}
                href={`#${service.id}`}
                data-cursor="link"
                data-service-id={service.id}
                onClick={() => setActiveId(service.id)}
                aria-current={isActive ? "location" : undefined}
                className={`services-subnav-link ${
                  isActive
                    ? "is-active"
                    : ""
                }`}
              >
                {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={2} />}
                {service.name}
              </a>
            );
          })}
        </div>
      </nav>

      {/* per-service bands */}
      {services.map((service, index) => (
        <ServiceBand key={service.id} service={service} ordinal={index + 1} />
      ))}

      {/* process timeline — master language: numbered nodes + connector */}
      <Section width="wide" className="bg-[var(--bg-section-warm)]">
        <Eyebrow className="mb-6">the process</Eyebrow>
        <Heading size={2} as="h2" className="mb-12 max-w-3xl">
          How an engagement works
        </Heading>
        <div className="relative mx-auto max-w-2xl">
          <div className="absolute bottom-12 left-[18px] top-3 w-px bg-[color-mix(in_srgb,var(--gold-base)_40%,transparent)]" aria-hidden />
          {STEPS.map((s, i) => (
            <AnimateOnScroll key={s.n} delay={i * 0.08} as="div" className="relative mb-8 flex items-start gap-6 last:mb-0">
              <span className="relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border-gold bg-bg-base font-mono text-xs font-semibold text-gold">
                {s.n}
              </span>
              <div className="pt-1">
                <h3 className="font-display text-xl font-semibold text-heading sm:text-2xl">{s.t}</h3>
                <p className="mt-1.5 max-w-md text-sm leading-relaxed text-white-muted">{s.d}</p>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </Section>

      {/* closing CTA — master language, not the old FinalCTA */}
      <Section width="wide" divide>
        <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          <div>
            <Eyebrow className="mb-7">start</Eyebrow>
            <Heading size={1} as="h2">
              Book the session. Keep the plan.
            </Heading>
          </div>
          <div className="flex flex-col gap-7">
            <p className="text-lg leading-relaxed text-white-secondary">
              A free strategy session with the engineers who would do the work. You leave with a written plan. Yours to keep either way.
            </p>
            <BookCallButton location="services_closing" />
            <CallTerms />
          </div>
        </div>
      </Section>
    </>
  );
}
