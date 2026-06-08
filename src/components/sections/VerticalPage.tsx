"use client";

import {
  Check, PhoneMissed, Clock, UserX, Monitor, Moon, FileText, Users,
  CalendarX, SearchX, Thermometer, DollarSign, RefreshCw, Database,
  Wrench, Scale, Briefcase, Building2, ArrowUpRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { Container, Eyebrow, BookCallButton } from "@/components/v2/studio/primitives";
import { RevealHeading } from "@/components/v2/studio/RevealHeading";
import { OpsConsole } from "@/components/v2/studio/OpsConsole";
import { INDUSTRY_FEEDS } from "@/content/industry-feeds";
import type { Vertical } from "@/lib/types";

const iconMap: Record<string, LucideIcon> = {
  PhoneMissed, Clock, UserX, Monitor, Moon, FileText, Users,
  CalendarX, SearchX, Thermometer, DollarSign, RefreshCw, Database,
  Wrench, Scale, Briefcase, Building2,
};

/* Shared type recipes (NOT the .display-* classes — those are owned by the CSS
   section-reveal system; RevealHeading drives its own word-stagger entrance). */
const H1 = "font-display font-extrabold leading-[1.04] tracking-[-0.035em] text-[clamp(2.1rem,3.8vw,3.9rem)] text-heading";
const H2 = "font-display font-bold leading-[1.06] tracking-[-0.03em] text-[clamp(1.85rem,3.2vw,2.9rem)] text-heading";

/* Related reading — maps each vertical to the articles that match its operations,
   so every industry page links into the learn library and back into /services. */
type RelatedArticle = { slug: string; title: string };
const RELATED_READING: Record<string, RelatedArticle[]> = {
  "home-services": [
    { slug: "home-service-automations-2026", title: "5 Automations Every Home Service Business Needs in 2026" },
    { slug: "ai-for-contractors", title: "AI for Contractors: How Home Service Businesses Win More Jobs" },
    { slug: "servicetitan-vs-housecall-pro-vs-jobber", title: "ServiceTitan vs Housecall Pro vs Jobber, Compared for 2026" },
  ],
  "law-firms": [
    { slug: "ai-for-law-firms", title: "AI for Law Firms: Save 10+ Hours Per Week" },
    { slug: "ai-tools-law-firms-2026", title: "5 AI Tools Every Law Firm Should Be Using in 2026" },
    { slug: "ai-intake-personal-injury-firms", title: "AI Client Intake for Personal Injury Firms: A Complete Guide" },
  ],
  "real-estate": [
    { slug: "ai-for-real-estate-agents", title: "AI for Real Estate Agents: Automate Follow-Up, Win More Listings" },
    { slug: "ai-for-real-estate-teams", title: "AI for Real Estate Teams: Automate Follow-Up, Close More Deals" },
  ],
  "professional-services": [
    { slug: "ai-for-accountants", title: "AI for Accountants and Bookkeepers: Automate Client Onboarding" },
    { slug: "best-crm-small-business-2026", title: "The Best CRM for Small Businesses in 2026" },
  ],
};

interface VerticalPageProps {
  vertical: Vertical;
}

export function VerticalPage({ vertical }: VerticalPageProps) {
  const heroSolutions = vertical.solutions.slice(0, 2);
  const restSolutions = vertical.solutions.slice(2);
  const opsFeed = INDUSTRY_FEEDS[vertical.slug];
  const relatedReading = RELATED_READING[vertical.slug] ?? [];

  return (
    <>
      {/* hero — statement + this trade's live ops console (the signature motif) */}
      <section className="relative flex min-h-[88vh] items-center overflow-hidden pt-32 pb-20">
        <Container width="wide">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div className="min-w-0">
              <AnimateOnScroll>
                <Eyebrow className="mb-7">{vertical.name}</Eyebrow>
              </AnimateOnScroll>
              <RevealHeading
                as="h1"
                className={H1}
                lead={vertical.heroHeadlineWhite}
                accent={vertical.heroHeadlineGold}
                delay={0.12}
              />
              <AnimateOnScroll delay={0.25}>
                <p className="mt-7 max-w-xl text-lg leading-relaxed text-white-secondary">
                  {vertical.heroSubheadline}
                </p>
              </AnimateOnScroll>
              <AnimateOnScroll delay={0.35}>
                <div className="mt-9">
                  <BookCallButton />
                </div>
              </AnimateOnScroll>
            </div>
            {opsFeed && (
              <AnimateOnScroll as="div" delay={0.2} className="relative min-w-0">
                <OpsConsole
                  name={vertical.name}
                  feed={opsFeed.feed}
                  footer={
                    <p className="text-center font-mono text-[0.6rem] uppercase tracking-[0.18em] text-white-muted">
                      A day at a {vertical.name.replace(/s$/, "").toLowerCase()}, run by Accelerate
                    </p>
                  }
                />
              </AnimateOnScroll>
            )}
          </div>
        </Container>
      </section>

      {/* pain points */}
      <section className="section-y section-divide relative bg-[var(--bg-section-warm)]">
        <Container width="wide">
          <AnimateOnScroll><Eyebrow className="mb-6">sound familiar?</Eyebrow></AnimateOnScroll>
          <RevealHeading
            className={`${H2} mb-3 max-w-3xl`}
            lead="The problems costing you"
            accent="real money."
          />
          <AnimateOnScroll delay={0.15}>
            <p className="mb-12 max-w-xl text-base leading-relaxed text-white-muted">
              These are the issues we hear from {vertical.name.toLowerCase()} businesses every week.
            </p>
          </AnimateOnScroll>
          <div className="grid gap-4 md:grid-cols-2">
            {vertical.painPoints.map((pain, i) => {
              const Icon = iconMap[pain.icon] || Monitor;
              return (
                <AnimateOnScroll
                  key={pain.title}
                  as="div"
                  delay={i * 0.05}
                  className="flex gap-5 rounded-2xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] p-6 backdrop-blur-md sm:p-7"
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_60%,transparent)] text-gold">
                    <Icon className="h-6 w-6" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="mb-2 font-display text-lg font-semibold text-heading">{pain.title}</h3>
                    <p className="text-sm leading-relaxed text-white-muted">{pain.description}</p>
                  </div>
                </AnimateOnScroll>
              );
            })}
          </div>
        </Container>
      </section>

      {/* solutions */}
      <section className="section-y section-divide relative bg-[var(--bg-section-deep)]">
        <Container width="wide">
          <AnimateOnScroll><Eyebrow className="mb-6">what we build</Eyebrow></AnimateOnScroll>
          <RevealHeading
            className={`${H2} mb-3 max-w-3xl`}
            lead="Purpose-built systems we"
            accent="build and run."
          />
          <AnimateOnScroll delay={0.15}>
            <p className="mb-12 max-w-2xl text-base leading-relaxed text-white-muted">
              Every solution is scoped to {vertical.name.toLowerCase()} operations: your
              tools, your workflow, your goals.
            </p>
          </AnimateOnScroll>

          <div className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              {heroSolutions.map((solution, i) => (
                <AnimateOnScroll
                  key={solution.title}
                  as="div"
                  delay={i * 0.06}
                  className="flex h-full flex-col rounded-2xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_88%,transparent)] p-7 backdrop-blur-md sm:p-9"
                >
                  <h3 className="mb-3 font-display text-xl font-semibold text-heading">{solution.title}</h3>
                  <p className="mb-5 leading-relaxed text-white-secondary">{solution.description}</p>
                  <ul className="mt-auto flex flex-col gap-2">
                    {solution.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-white-secondary">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" strokeWidth={2.5} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </AnimateOnScroll>
              ))}
            </div>

            {restSolutions.length > 0 && (
              <div className={`grid gap-4 sm:grid-cols-2 ${restSolutions.length >= 3 ? "lg:grid-cols-3" : ""}`}>
                {restSolutions.map((solution, i) => (
                  <AnimateOnScroll
                    key={solution.title}
                    as="div"
                    delay={i * 0.05}
                    className="flex h-full flex-col rounded-2xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] p-6 backdrop-blur-md"
                  >
                    <h3 className="mb-2 font-display text-base font-semibold text-heading">{solution.title}</h3>
                    <p className="mb-4 text-sm leading-relaxed text-white-muted">{solution.description}</p>
                    <ul className="mt-auto flex flex-col gap-1.5">
                      {solution.features.slice(0, 3).map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-xs text-white-muted">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" strokeWidth={2.5} />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </AnimateOnScroll>
                ))}
              </div>
            )}
          </div>
        </Container>
      </section>

      {/* case study */}
      {vertical.caseStudy && (
        <section className="section-y section-divide relative">
          <Container width="wide">
            <AnimateOnScroll><Eyebrow className="mb-6">case study</Eyebrow></AnimateOnScroll>
            <RevealHeading className={`${H2} mb-10 max-w-3xl`} lead={vertical.caseStudy.title} />
            <AnimateOnScroll delay={0.1} as="div" className="rounded-2xl border border-border-gold/40 bg-[color-mix(in_srgb,var(--gold-base)_4%,var(--bg-elevated))] p-8 backdrop-blur-md sm:p-12">
              <p className="mb-10 max-w-3xl text-lg leading-relaxed text-white-secondary">
                {vertical.caseStudy.description}
              </p>
              <div className="grid gap-3 sm:gap-4 md:grid-cols-4">
                {vertical.caseStudy.metrics.map((metric, i) => (
                  <AnimateOnScroll
                    key={metric.label}
                    as="div"
                    delay={0.15 + i * 0.05}
                    className="rounded-xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] p-5 text-center"
                  >
                    <p className="mb-1 font-display text-2xl font-bold text-gold sm:text-3xl">{metric.value}</p>
                    <p className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-white-muted">{metric.label}</p>
                  </AnimateOnScroll>
                ))}
              </div>
            </AnimateOnScroll>
          </Container>
        </section>
      )}

      {/* related reading — link each industry into the learn library + /services */}
      {relatedReading.length > 0 && (
        <section className="section-y section-divide relative bg-[var(--bg-section-warm)]">
          <Container width="wide">
            <AnimateOnScroll><Eyebrow className="mb-6">go deeper</Eyebrow></AnimateOnScroll>
            <RevealHeading
              className={`${H2} mb-3 max-w-3xl`}
              lead="Related reading for"
              accent={`${vertical.name.toLowerCase()}.`}
            />
            <AnimateOnScroll delay={0.15}>
              <p className="mb-12 max-w-2xl text-base leading-relaxed text-white-muted">
                Guides on the automation, intake, and follow-up systems we build and
                run for {vertical.name.toLowerCase()} businesses.
              </p>
            </AnimateOnScroll>

            <div className={`grid gap-4 sm:grid-cols-2 ${relatedReading.length >= 3 ? "lg:grid-cols-3" : ""}`}>
              {relatedReading.map((article, i) => (
                <AnimateOnScroll key={article.slug} as="div" delay={i * 0.06}>
                  <Link
                    href={`/learn/${article.slug}`}
                    className="group flex h-full flex-col rounded-2xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] p-6 backdrop-blur-md transition-colors hover:border-border-gold/50"
                  >
                    <span className="mb-4 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-white-muted">
                      Guide
                    </span>
                    <h3 className="mb-5 font-display text-lg font-semibold leading-snug text-heading">
                      {article.title}
                    </h3>
                    <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-gold">
                      Read the guide
                      <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </span>
                  </Link>
                </AnimateOnScroll>
              ))}
            </div>

            <AnimateOnScroll delay={0.2}>
              <Link
                href="/services"
                className="group mt-8 inline-flex items-center gap-1.5 font-display text-base font-semibold text-heading transition-colors hover:text-gold"
              >
                See everything we build and run
                <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </AnimateOnScroll>
          </Container>
        </section>
      )}

      {/* closing — master style */}
      <section className="section-y section-divide relative">
        <Container width="wide">
          <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
            <div className="min-w-0">
              <AnimateOnScroll><Eyebrow className="mb-7">start</Eyebrow></AnimateOnScroll>
              <RevealHeading
                as="h2"
                className="font-display font-extrabold leading-[1.0] tracking-[-0.04em] text-[clamp(2.4rem,4.6vw,4.5rem)] text-heading"
                lead="A plan built for"
                accent={`${vertical.name.toLowerCase()}.`}
              />
            </div>
            <div className="flex flex-col gap-7">
              <AnimateOnScroll delay={0.15}>
                <p className="text-lg leading-relaxed text-white-secondary">
                  30 minutes. We&apos;ll map exactly where AI and automation move the
                  needle for your business. No pitch, no obligation.
                </p>
              </AnimateOnScroll>
              <AnimateOnScroll delay={0.25}><BookCallButton /></AnimateOnScroll>
              <AnimateOnScroll delay={0.35} as="div" className="flex flex-wrap gap-x-8 gap-y-3 border-t border-border-glass pt-6 font-mono text-xs uppercase tracking-[0.15em] text-white-muted">
                <span>Free</span><span>·</span>
                <span>30 minutes</span><span>·</span>
                <span>No obligation</span><span>·</span>
                <span>Direct to the founder</span>
              </AnimateOnScroll>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
