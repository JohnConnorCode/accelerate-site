"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Check, ArrowUpRight, Compass, Workflow, TrendingUp, MessageCircle, PenTool, BarChart3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { Section, Eyebrow, Heading, BookCallButton } from "@/components/v2/studio/primitives";
import { services } from "@/content/services";

const iconMap: Record<string, LucideIcon> = {
  Compass, Workflow, TrendingUp, MessageCircle, PenTool, BarChart3,
};

/* ────────────────────────────────────────────────────────────────────────────
   Single per-service section. Alternates background, mirrors the homepage's
   refined dark-glass language. No fabricated metrics, no case-study links —
   the deliverables list + pricing + CTA are the content. */
function ServiceBand({
  service,
  index,
}: {
  service: (typeof services)[number];
  index: number;
}) {
  const Icon = iconMap[service.icon];
  const isReversed = index % 2 !== 0;
  const bgClass = index % 2 === 0 ? "bg-bg-base" : "bg-[var(--bg-section-warm)]";

  return (
    <section id={service.id} className={`section-y scroll-mt-[104px] ${bgClass}`}>
      <div className="page-shell grid items-start gap-10 lg:grid-cols-5 lg:gap-16">
        {/* text — 3 cols, order flips alternating rows */}
        <div className={`lg:col-span-3 ${isReversed ? "lg:order-2" : ""}`}>
          <AnimateOnScroll>
            {Icon && (
              <span className="mb-5 inline-grid h-12 w-12 place-items-center rounded-xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] text-gold">
                <Icon className="h-6 w-6" strokeWidth={1.75} />
              </span>
            )}
            <h2 className="display-3 mb-3">{service.name}</h2>
            <p className="mb-4 max-w-2xl text-base italic leading-relaxed text-white-muted">
              {service.problemStatement}
            </p>
            <p className="max-w-2xl text-base leading-relaxed text-white-secondary">
              {service.description}
            </p>
          </AnimateOnScroll>
        </div>

        {/* deliverables card — 2 cols */}
        <div className={`lg:col-span-2 ${isReversed ? "lg:order-1" : ""}`}>
          <AnimateOnScroll delay={0.1}>
            <div className="rounded-2xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_92%,transparent)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md sm:p-7">
              <p className="mb-4 font-mono text-[0.62rem] uppercase tracking-[0.22em] text-white-muted">
                What you get
              </p>
              <ul className="mb-7 flex flex-col gap-2.5">
                {service.deliverables.map((d) => (
                  <li key={d} className="flex items-start gap-3 text-sm leading-relaxed text-white-secondary">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" strokeWidth={2.5} />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border-glass pt-5">
                <p className="font-display text-lg font-semibold text-heading">{service.pricingDisplay}</p>
                <Link
                  href="/contact"
                  data-cursor="link"
                  className="group inline-flex items-center gap-1.5 text-sm font-semibold text-heading"
                >
                  <span className="ink-sweep">Get started</span>
                  <ArrowUpRight className="h-4 w-4 text-gold transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              </div>
            </div>
          </AnimateOnScroll>
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { n: "01", t: "Discovery", d: "A free 30-minute call. We learn how your business runs and where AI moves the needle first." },
  { n: "02", t: "Strategy & Roadmap", d: "A tailored plan with exact deliverables, timeline, and projected ROI — before you spend a dollar." },
  { n: "03", t: "Build & Launch", d: "We handle the technical work end-to-end — configuration, integration, testing, training. Live within weeks." },
  { n: "04", t: "Optimize & Grow", d: "Ongoing measurement, learning, and tuning so the system keeps getting sharper after launch." },
];

export function ServicesPageContent() {
  const [activeId, setActiveId] = useState<string>("");

  // sticky-nav active state — observed against viewport center
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
      {/* hero — master style: eyebrow + display heading + supporting + CTA */}
      <Section width="wide" className="pt-32">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div>
            <Eyebrow className="mb-7">our services</Eyebrow>
            <Heading size={1} as="h1" className="text-[clamp(2.4rem,4.6vw,4.75rem)] leading-[1.02]">
              Six systems that <Heading.Italic>do the work</Heading.Italic>
            </Heading>
            <p className="mt-7 max-w-md text-base leading-relaxed text-white-secondary">
              We don&apos;t sell software. We build and run custom AI systems —
              strategy, automation, engagement, content, reporting — tailored to
              your business. <span className="font-semibold text-gold">Guaranteed.</span>
            </p>
            <div className="mt-9 flex items-center gap-6">
              <BookCallButton />
              <Link
                href="#strategy"
                data-cursor="link"
                className="text-sm font-medium text-white-secondary underline-offset-4 transition-colors hover:text-gold hover:underline"
              >
                See the systems
              </Link>
            </div>
          </div>

          {/* service icon grid — visual that matches the rest of the page */}
          <div className="grid grid-cols-3 gap-3">
            {services.map((s, i) => {
              const Icon = iconMap[s.icon];
              if (!Icon) return null;
              return (
                <AnimateOnScroll
                  key={s.id}
                  delay={0.05 * i}
                  as="div"
                  className="relative grid aspect-square place-items-center overflow-hidden rounded-2xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)]"
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{ background: "radial-gradient(70% 70% at 50% 30%, rgba(var(--accent-rgb),0.18), transparent 70%)" }}
                  />
                  <Icon className="relative h-7 w-7 text-gold" strokeWidth={1.6} />
                  <span className="absolute bottom-2 left-2 right-2 truncate text-center font-mono text-[0.55rem] uppercase tracking-[0.16em] text-white-muted">
                    {s.name}
                  </span>
                </AnimateOnScroll>
              );
            })}
          </div>
        </div>
      </Section>

      {/* sticky service quick-nav — on-brand colors */}
      <nav
        className="sticky top-[60px] z-[80] border-b border-border-glass bg-bg-base/85 backdrop-blur-md"
        aria-label="Service quick navigation"
      >
        <div className="page-shell flex gap-1 overflow-x-auto py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {services.map((service) => {
            const Icon = iconMap[service.icon];
            const isActive = activeId === service.id;
            return (
              <a
                key={service.id}
                href={`#${service.id}`}
                data-cursor="link"
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "border-b-2 border-gold bg-[color-mix(in_srgb,var(--gold-base)_14%,transparent)] text-gold"
                    : "text-white-muted hover:bg-[color-mix(in_srgb,var(--gold-base)_8%,transparent)] hover:text-white-primary"
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
      {services.map((service, i) => (
        <ServiceBand key={service.id} service={service} index={i} />
      ))}

      {/* process timeline — master language: numbered nodes + connector */}
      <Section width="wide" className="bg-[var(--bg-section-warm)]">
        <Eyebrow className="mb-6">the process</Eyebrow>
        <Heading size={2} as="h2" className="mb-12 max-w-3xl">
          From kickoff to running, <Heading.Italic>in weeks</Heading.Italic>
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
            <Heading size={1} as="h2" className="text-[clamp(2.6rem,5.4vw,5.5rem)] leading-[0.98]">
              Not sure where to <Heading.Italic>start?</Heading.Italic>
            </Heading>
          </div>
          <div className="flex flex-col gap-7">
            <p className="text-lg leading-relaxed text-white-secondary">
              Book a free discovery call. We&apos;ll learn your business and tell
              you exactly where AI can help — no pitch, no obligation.
            </p>
            <BookCallButton />
            <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-border-glass pt-6 font-mono text-xs uppercase tracking-[0.15em] text-white-muted">
              <span>Free</span><span>·</span>
              <span>30 minutes</span><span>·</span>
              <span>No obligation</span><span>·</span>
              <span>Direct to the founder</span>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
