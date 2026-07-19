"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Check, ArrowUpRight, Compass, Workflow, TrendingUp, MessageCircle, PenTool, BarChart3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { Section, Container, Eyebrow, Heading, BookCallButton, useReveal } from "@/components/v2/studio/primitives";
import { RevealHeading } from "@/components/v2/studio/RevealHeading";
import { ProofStrip } from "@/components/v2/studio/ProofStrip";
import { HERO_HEADING } from "@/lib/type-recipes";
import { OpsFeed } from "@/components/v2/living/OpsFeed";
import { services } from "@/content/services";
import { trackConversion } from "@/lib/analytics";

const iconMap: Record<string, LucideIcon> = {
  Compass, Workflow, TrendingUp, MessageCircle, PenTool, BarChart3,
};

/* Static micro-feed per service — the ops-feed motif carried through to each
   card, showing that service's work in the same live-operations language as
   the hero. Deterministic (no timers): three rows, one glance. */
const MICRO_FEEDS: Record<string, { time: string; glyph: string; rgb: string; label: string }[]> = {
  strategy: [
    { time: "09:02", glyph: "◆", rgb: "96,165,250", label: "Opportunity map delivered" },
    { time: "09:15", glyph: "↗", rgb: "163,230,53", label: "ROI projection updated" },
    { time: "11:40", glyph: "✓", rgb: "190,242,100", label: "Quarter roadmap approved" },
  ],
  automation: [
    { time: "07:58", glyph: "→", rgb: "34,211,238", label: "Intake routed → job created" },
    { time: "08:31", glyph: "＄", rgb: "52,211,153", label: "Invoice chased → paid" },
    { time: "08:45", glyph: "✓", rgb: "190,242,100", label: "Morning handoff done by 9am" },
  ],
  sales: [
    { time: "12:04", glyph: "●", rgb: "56,189,248", label: "New inquiry → replied in 40s" },
    { time: "14:22", glyph: "↻", rgb: "167,139,250", label: "Follow-up #3 delivered" },
    { time: "16:51", glyph: "✦", rgb: "163,230,53", label: "Proposal opened → owner pinged" },
  ],
  engagement: [
    { time: "02:11", glyph: "●", rgb: "56,189,248", label: "2am inquiry answered" },
    { time: "09:30", glyph: "✓", rgb: "190,242,100", label: "Appointment confirmed" },
    { time: "17:05", glyph: "★", rgb: "251,191,36", label: "Review request sent" },
  ],
  content: [
    { time: "08:20", glyph: "✎", rgb: "167,139,250", label: "Article drafted → in review" },
    { time: "10:12", glyph: "◆", rgb: "96,165,250", label: "Local page published" },
    { time: "15:44", glyph: "✓", rgb: "190,242,100", label: "Month of posts scheduled" },
  ],
  reporting: [
    { time: "06:30", glyph: "↗", rgb: "163,230,53", label: "Dashboard refreshed" },
    { time: "07:00", glyph: "●", rgb: "56,189,248", label: "Weekly numbers → owner briefed" },
    { time: "07:02", glyph: "◆", rgb: "96,165,250", label: "Forecast updated" },
  ],
};

function MicroFeed({ serviceId }: { serviceId: string }) {
  const rows = MICRO_FEEDS[serviceId];
  if (!rows) return null;
  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-base)_88%,transparent)]">
      <p className="flex items-center gap-2 border-b border-border-glass px-3.5 py-2 font-mono text-[0.56rem] uppercase tracking-[0.22em] text-white-muted">
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--gold-base)]" />
        live · operations
      </p>
      <ul className="flex flex-col px-1.5 py-1.5 font-mono text-[0.72rem]">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <span className="text-[0.62rem] tabular-nums text-white-muted">{r.time}</span>
            <span
              className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded text-[0.66rem]"
              style={{ color: `rgb(${r.rgb})`, background: `rgba(${r.rgb},0.14)` }}
            >
              {r.glyph}
            </span>
            <span className="min-w-0 flex-1 truncate text-white-secondary">{r.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Single per-service row. Consistent layout (text left, deliverables card
   right) and vertically centered, so a tall card never leaves a void under a
   short description. Hairline dividers tie the six rows into one cohesive list
   instead of six disjoint full-height sections. */
function ServiceBand({
  service,
}: {
  service: (typeof services)[number];
}) {
  const Icon = iconMap[service.icon];
  const ref = useReveal<HTMLElement>();

  return (
    <section
      ref={ref}
      id={service.id}
      className="section-reveal scroll-mt-[104px] border-t border-border-glass py-14 lg:py-[5.5rem]"
    >
      <div className="page-shell grid items-center gap-10 lg:grid-cols-5 lg:gap-16">
        {/* text — 3 cols */}
        <div className="lg:col-span-3">
          <div>
            {Icon && (
              <span className="mb-5 inline-grid h-12 w-12 place-items-center rounded-xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] text-gold">
                <Icon className="h-6 w-6" strokeWidth={1.75} />
              </span>
            )}
            <h2 className="display-3 mb-3">{service.name}</h2>
            <p className="mb-4 max-w-2xl text-base leading-relaxed text-white-muted">
              {service.problemStatement}
            </p>
            <p className="max-w-2xl text-base leading-relaxed text-white-secondary">
              {service.description}
            </p>
          </div>
        </div>

        {/* deliverables card — 2 cols */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_92%,transparent)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md sm:p-7">
            <MicroFeed serviceId={service.id} />
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
                onClick={() => trackConversion("Service Get Started", { service: service.name })}
                className="group inline-flex items-center gap-1.5 text-sm font-semibold text-heading"
              >
                <span className="ink-sweep">Get started</span>
                <ArrowUpRight className="h-4 w-4 text-gold transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { n: "01", t: "Discovery", d: "A free 30-minute call. We learn how your business runs and where AI moves the needle first." },
  { n: "02", t: "Strategy & Roadmap", d: "A tailored plan with exact deliverables, timeline, and projected ROI, all before you spend a dollar." },
  { n: "03", t: "Build & Launch", d: "We handle the technical work end-to-end: configuration, integration, testing, training. Then it goes live and starts working." },
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
      {/* hero — word-stagger headline + the live operations feed */}
      <section className="relative overflow-hidden pt-32 pb-24">
        <Container width="wide">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
            <div className="min-w-0">
              <AnimateOnScroll><Eyebrow className="mb-7">what we do</Eyebrow></AnimateOnScroll>
              <RevealHeading
                as="h1"
                className={HERO_HEADING}
                lead="The systems we build and run for you."
                delay={0.1}
              />
              <AnimateOnScroll delay={0.25}>
                <p className="mt-7 max-w-md text-base leading-relaxed text-white-secondary">
                  We don&apos;t sell software you have to manage. We design, build, and run
                  custom AI across your whole business, from first inquiry to repeat client.
                  Scoped to your operation, accountable to your numbers, working from day one.
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
                    See the systems
                  </Link>
                </div>
              </AnimateOnScroll>
            </div>

            {/* hero visual — the live operations feed, same as the homepage */}
            <AnimateOnScroll as="div" delay={0.2} className="relative min-w-0">
              <OpsFeed className="w-full shadow-2xl shadow-black/40" />
            </AnimateOnScroll>
          </div>
        </Container>
      </section>

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
      {services.map((service) => (
        <ServiceBand key={service.id} service={service} />
      ))}

      {/* proof, after the visitor has seen what we build */}
      <ProofStrip />

      {/* process timeline — master language: numbered nodes + connector */}
      <Section width="wide" className="bg-[var(--bg-section-warm)]">
        <Eyebrow className="mb-6">the process</Eyebrow>
        <Heading size={2} as="h2" className="mb-12 max-w-3xl">
          From kickoff to running
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
              Not sure where to start?
            </Heading>
          </div>
          <div className="flex flex-col gap-7">
            <p className="text-lg leading-relaxed text-white-secondary">
              Book a free strategy call. We&apos;ll learn your business and tell
              you exactly where AI can help. No pitch, no obligation.
            </p>
            <BookCallButton location="services_closing" />
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
