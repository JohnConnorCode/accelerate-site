"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { Container, Eyebrow, BookCallButton, CallTerms } from "@/components/v2/studio/primitives";
import { RevealHeading } from "@/components/v2/studio/RevealHeading";
import { ProofStrip } from "@/components/v2/studio/ProofStrip";
import { HERO_HEADING } from "@/lib/type-recipes";
import { services } from "@/content/services";
import { trackConversion } from "@/lib/analytics";

function ServiceBand({
  service,
  index,
}: {
  service: (typeof services)[number];
  index: number;
}) {
  return (
    <section
      id={service.id}
      className="services-band border-t border-[color-mix(in_srgb,var(--fg)_12%,transparent)] py-[clamp(3.2rem,6vw,5.5rem)]"
    >
      <Container>
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-16">
          <div>
            <p className="label mb-5">{String(index + 1).padStart(2, "0")}</p>
            <h2 className="h2">{service.name}</h2>
            <p className="mt-5 max-w-[46ch] text-[1.02rem] leading-[1.75] text-white-secondary">
              {service.problemStatement}
            </p>
            <p className="mt-4 max-w-[46ch] text-[1.02rem] leading-[1.75] text-white-secondary">
              {service.description}
            </p>
          </div>
          <div>
            <p className="label mb-5">What you get</p>
            <ul className="flex flex-col">
              {service.deliverables.slice(0, 6).map((d) => (
                <li
                  key={d}
                  className="border-t border-[color-mix(in_srgb,var(--fg)_12%,transparent)] py-3 text-[0.97rem] leading-[1.55] text-white-secondary last:border-b"
                >
                  {d}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <p className="font-display text-lg font-semibold tracking-[-0.02em] text-heading">
                {service.pricingDisplay}
              </p>
              <Link
                href="/contact"
                onClick={() => trackConversion("Service Get Started", { service: service.name })}
                className="ink-sweep text-[15px] text-[var(--fg)]"
              >
                Get started <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

const STEPS = [
  { n: "01", t: "Diagnostic", d: "We map where hours disappear: unanswered inquiries, stale follow-up, work that should not need a person." },
  { n: "02", t: "The plan", d: "A phased sequence of what to automate first, so the team gets the week back where it counts." },
  { n: "03", t: "Build", d: "We put the systems into the tools you already use. Phase one is live in under two weeks." },
  { n: "04", t: "Run", d: "We train the people who touch it, then keep the machine running." },
];

export function ServicesPageContent() {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    services.forEach((service) => {
      const el = document.getElementById(service.id);
      if (!el) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) setActiveId(service.id);
        },
        { rootMargin: "-50% 0px -50% 0px" }
      );
      observer.observe(el);
      observers.push(observer);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <>
      <section className="page-offset-roomy relative">
        <Container className="pb-[clamp(4.5rem,8vw,7rem)] pt-[clamp(2.5rem,5vw,4rem)]">
          <AnimateOnScroll>
            <Eyebrow className="mb-7">what we do</Eyebrow>
          </AnimateOnScroll>
          <RevealHeading
            as="h1"
            className={HERO_HEADING}
            lead="We take the work"
            accent="your people should not be doing."
            delay={0.1}
          />
          <AnimateOnScroll delay={0.22}>
            <p className="mt-7 max-w-[46ch] text-[1.08rem] leading-[1.8] text-white-secondary">
              Diagnose, build, and run. Intake, follow-up, and scheduling come off the team. The same people spend the week on jobs, cases, and clients.
            </p>
          </AnimateOnScroll>
          <AnimateOnScroll delay={0.32}>
            <div className="mt-10">
              <BookCallButton location="services_inline" />
            </div>
          </AnimateOnScroll>
        </Container>
      </section>

      <nav
        className="services-subnav sticky z-[80] border-y border-[color-mix(in_srgb,var(--fg)_12%,transparent)] bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur-md"
        aria-label="Service quick navigation"
      >
        <div className="page-shell flex gap-1 overflow-x-auto py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {services.map((service) => {
            const isActive = activeId === service.id;
            return (
              <a
                key={service.id}
                href={`#${service.id}`}
                className={`flex min-h-11 shrink-0 items-center whitespace-nowrap px-3.5 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.16em] transition-colors ${
                  isActive ? "text-heading" : "text-white-muted hover:text-heading"
                }`}
              >
                {service.name}
              </a>
            );
          })}
        </div>
      </nav>

      {services.map((service, i) => (
        <ServiceBand key={service.id} service={service} index={i} />
      ))}

      <ProofStrip />

      <section className="relative border-t border-[color-mix(in_srgb,var(--fg)_12%,transparent)] py-[clamp(4.5rem,8vw,7rem)]">
        <Container>
          <Eyebrow className="mb-6">how we work</Eyebrow>
          <h2 className="h2 mb-12 max-w-[18ch]">Solving constraints, not selling software.</h2>
          <div className="steps" style={{ marginTop: 0 }}>
            {STEPS.map((s) => (
              <div key={s.n} className="step">
                <p className="step-n">{s.n}</p>
                <div className="step-t">
                  <h3 className="h3">{s.t}</h3>
                </div>
                <p>{s.d}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="ink-panel relative">
        <Container className="py-[clamp(4.5rem,8vw,7rem)]">
          <Eyebrow className="mb-7 !text-[var(--panel-fg)]">start here</Eyebrow>
          <h2 className="h2" style={{ color: "var(--panel-fg)" }}>
            Give them the week
            <br />
            <span className="it">back.</span>
          </h2>
          <p className="lede mt-7 max-w-[46ch]" style={{ color: "var(--soft)" }}>
            Thirty minutes. We look at where the hours go. You leave with a plan, yours to keep either way.
          </p>
          <div className="mt-10">
            <BookCallButton variant="inverse" location="services_closing" />
          </div>
          <CallTerms className="mt-8 !border-[color-mix(in_srgb,var(--paper)_18%,transparent)] !text-[var(--soft)]" />
        </Container>
      </section>
    </>
  );
}
