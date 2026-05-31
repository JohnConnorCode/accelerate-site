"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Wrench, Scale, KeyRound, Briefcase, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { MaskReveal } from "./MaskReveal";
import { Eyebrow } from "./primitives";
import { OpsConsole } from "./OpsConsole";
import { INDUSTRY_FEEDS } from "@/content/industry-feeds";

type Item = { slug: string; name: string; outcome: string; icon: LucideIcon };

// Row metadata for the list; the per-industry ops feed + metric live in the
// shared INDUSTRY_FEEDS content module (also used by vertical landing pages).
const ITEMS: Item[] = [
  { slug: "home-services", name: "Home Services", outcome: "Every call answered. More jobs booked.", icon: Wrench },
  { slug: "law-firms", name: "Law Firms", outcome: "Faster intake. More cases signed.", icon: Scale },
  { slug: "real-estate", name: "Real Estate", outcome: "Less chasing. More closings.", icon: KeyRound },
  { slug: "professional-services", name: "Professional Services", outcome: "A pipeline you can predict.", icon: Briefcase },
];

export function IndustryList() {
  // Default to the first industry so the stage is always alive — never empty.
  const [active, setActive] = useState(0);
  const current = ITEMS[active]!;
  const Icon = current.icon;
  const data = INDUSTRY_FEEDS[current.slug]!;

  return (
    <section className="section-y section-divide relative">
      <div className="page-shell">
        <Eyebrow className="mb-6">Industries</Eyebrow>
        <h2 className="display-2 max-w-4xl">
          <MaskReveal>
            Built for your trade, not a template.
          </MaskReveal>
        </h2>
        <AnimateOnScroll delay={0.1}>
          <p className="mt-5 max-w-xl text-lg text-white-muted">
            The same lifecycle — find, win, keep, grow — tuned to how your trade actually runs.
            <span className="hidden lg:inline"> Hover an industry to watch a day go by.</span>
          </p>
        </AnimateOnScroll>

        <div className="mt-12 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:gap-16">
          {/* ── left: the editorial list ── */}
          <div className="border-t border-border-glass">
            {ITEMS.map((it, i) => {
              const isActive = active === i;
              return (
                <AnimateOnScroll as="div" key={it.slug} delay={i * 0.06}>
                  <Link
                    href={`/industries/${it.slug}`}
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    className="group relative flex items-center justify-between gap-6 border-b border-border-glass py-6 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] sm:py-7"
                  >
                    {/* left-edge accent stripe — present for the active row, grows on hover */}
                    <span
                      aria-hidden
                      className={`pointer-events-none absolute left-0 top-1/2 h-12 w-[3px] origin-center -translate-y-1/2 rounded-full bg-gold transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        isActive ? "scale-y-100" : "scale-y-0 group-hover:scale-y-100"
                      }`}
                    />
                    <span className="flex items-center gap-4 sm:gap-6">
                      {/* mobile icon badge — gives each row its own card identity */}
                      <span
                        aria-hidden
                        className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_72%,transparent)] text-gold lg:hidden"
                      >
                        <it.icon className="relative h-5 w-5" strokeWidth={1.75} />
                      </span>
                      <span
                        className={`w-7 font-mono text-base font-semibold text-gold transition-opacity duration-300 sm:w-8 sm:text-xl ${
                          isActive ? "opacity-100" : "opacity-40 group-hover:opacity-100"
                        }`}
                      >
                        0{i + 1}
                      </span>
                      <span className="flex flex-col gap-1.5">
                        <span
                          className={`font-display text-3xl font-bold tracking-[-0.03em] transition-all duration-300 group-hover:translate-x-1.5 sm:text-5xl ${
                            isActive ? "translate-x-1.5 text-heading" : "text-white-secondary"
                          }`}
                        >
                          {it.name}
                        </span>
                        <span className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-white-muted lg:hidden">
                          {it.outcome}
                        </span>
                      </span>
                    </span>
                    <ArrowUpRight
                      className={`hidden h-6 w-6 shrink-0 text-gold transition-opacity sm:block ${
                        isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      }`}
                    />
                  </Link>
                </AnimateOnScroll>
              );
            })}

            {/* examples, not limits */}
            <AnimateOnScroll as="div" delay={ITEMS.length * 0.06}>
              <Link
                href="/contact"
                className="group flex items-center justify-between gap-6 border-b border-border-glass py-6 sm:py-7"
              >
                <span className="flex items-center gap-5">
                  <Plus className="h-6 w-6 shrink-0 text-gold" />
                  <span className="font-display text-xl font-medium tracking-[-0.02em] text-white-muted transition-colors group-hover:text-heading sm:text-2xl">
                    Don&apos;t see yours? If you have customers, we can help.
                  </span>
                </span>
                <ArrowUpRight className="h-6 w-6 shrink-0 text-gold opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            </AnimateOnScroll>
          </div>

          {/* ── right: the anchored live-ops console (desktop) ── */}
          <div className="hidden lg:block lg:sticky lg:top-28">
            <AnimateOnScroll as="div" delay={0.15}>
            <OpsConsole
              name={current.name}
              feed={data.feed}
              footer={
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-lg border border-border-gold bg-[var(--glass-gold-bg)] text-gold">
                      <Icon className="h-4 w-4" strokeWidth={1.75} />
                    </span>
                    <span className="font-display text-lg font-extrabold leading-none tracking-[-0.02em] text-heading">
                      {data.metric}
                    </span>
                  </div>
                  <Link
                    href={`/industries/${current.slug}`}
                    className="inline-flex shrink-0 items-center gap-1 font-mono text-[0.68rem] font-bold uppercase tracking-[0.12em] text-gold transition-opacity hover:opacity-70"
                  >
                    See how <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              }
            />
            </AnimateOnScroll>
          </div>
        </div>
      </div>
    </section>
  );
}
