"use client";

import Link from "next/link";
import { Check, X, ArrowUpRight, Sparkles } from "lucide-react";
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from "@/components/ui/Accordion";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { Section, Container, Eyebrow, Heading, BookCallButton } from "@/components/v2/studio/primitives";
import { RevealHeading } from "@/components/v2/studio/RevealHeading";
import { ProofStrip } from "@/components/v2/studio/ProofStrip";
import { HERO_HEADING } from "@/lib/type-recipes";
import { cn, formatCurrency } from "@/lib/utils";
import { packages, packageFaqs } from "@/content/packages";
import type { ServicePackage } from "@/lib/types";
import { trackConversion } from "@/lib/analytics";

function getAllFeatureNames(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const pkg of packages) {
    for (const f of pkg.features) {
      if (!seen.has(f.name)) {
        seen.add(f.name);
        out.push(f.name);
      }
    }
  }
  return out;
}

function PricingCard({ pkg }: { pkg: ServicePackage }) {
  const featured = pkg.highlighted;
  return (
    <AnimateOnScroll
      as="div"
      delay={featured ? 0.05 : 0}
      className={cn(
        "relative flex h-full flex-col",
        featured && "lg:-mt-4 lg:mb-4 lg:z-10"
      )}
    >
      {featured && (
        <p className="mb-3 flex items-center justify-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.22em] text-gold">
          <Sparkles className="h-3 w-3" />
          Most popular
        </p>
      )}
      <div
        id={pkg.slug}
        className={cn(
          "flex h-full flex-1 flex-col rounded-2xl border bg-[color-mix(in_srgb,var(--bg-elevated)_92%,transparent)] p-6 backdrop-blur-md sm:p-8",
          featured
            ? "border-border-gold shadow-[0_0_0_1px_var(--border-gold),inset_0_1px_0_rgba(255,255,255,0.06),0_20px_60px_rgba(0,0,0,0.25)]"
            : "border-border-glass shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
        )}
      >
        <div className="mb-6">
          <h3 className="font-display text-2xl font-bold tracking-[-0.02em] text-heading">
            {pkg.name}
          </h3>
          <p className="mt-1 text-sm text-white-muted">{pkg.tagline}</p>
          <p className="mt-1 text-xs italic text-white-muted">Best for: {pkg.idealFor}</p>
        </div>
        <div className="mb-6">
          <div className="flex items-baseline gap-2">
            <span className={cn("font-display text-4xl font-bold tracking-tight", featured ? "text-gold" : "text-heading")}>
              {formatCurrency(pkg.priceOneTime)}
            </span>
            <span className="text-sm text-white-muted">one-time</span>
          </div>
          {pkg.priceMonthly > 0 && (
            <p className="mt-1 text-sm text-white-muted">
              + {formatCurrency(pkg.priceMonthly)}/mo for ongoing services
            </p>
          )}
        </div>
        <div className="mb-6 border-t border-border-glass" />
        <ul className="mb-8 flex flex-1 flex-col gap-3" role="list">
          {pkg.features.map((feature) => (
            <li key={feature.name} className="flex items-start gap-3">
              {feature.included ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" strokeWidth={2.5} aria-hidden />
              ) : (
                <X className="mt-0.5 h-4 w-4 shrink-0 text-white-muted opacity-50" aria-hidden />
              )}
              <span className={cn("text-sm leading-relaxed", feature.included ? "text-white-secondary" : "text-white-muted")}>
                {feature.name}
                {feature.included && feature.detail && (
                  <span className="ml-1 text-white-muted">({feature.detail})</span>
                )}
              </span>
            </li>
          ))}
        </ul>
        <Link
          href={pkg.ctaLink}
          data-cursor="link"
          onClick={() => trackConversion("Package Selected", { package_name: pkg.name })}
          className={cn(
            "group mt-auto inline-flex items-center justify-center gap-2.5 rounded-full px-7 py-3.5 text-sm font-semibold transition-colors",
            featured ? "bg-gold text-btn-text hover:opacity-90" : "border border-border-glass text-heading hover:border-border-gold hover:text-gold"
          )}
        >
          {pkg.ctaText}
          <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>
    </AnimateOnScroll>
  );
}

function ComparisonTable() {
  const featureNames = getAllFeatureNames();
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-[640px] border-collapse" role="table">
        <thead>
          <tr>
            <th scope="col" className="pb-4 pl-4 pr-4 text-left font-mono text-[0.62rem] uppercase tracking-[0.2em] text-white-muted sm:pl-0">
              Feature
            </th>
            {packages.map((pkg) => (
              <th
                key={pkg.id}
                scope="col"
                className={cn(
                  "px-4 pb-4 text-center font-display text-sm font-semibold",
                  pkg.highlighted ? "text-gold" : "text-heading"
                )}
              >
                {pkg.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {featureNames.map((name, idx) => (
            <tr key={name} className={cn("border-t border-border-glass", idx % 2 === 0 && "bg-white/[0.02]")}>
              <td className="py-3 pl-4 pr-4 text-sm text-white-secondary sm:pl-0">{name}</td>
              {packages.map((pkg) => {
                const feature = pkg.features.find((f) => f.name === name);
                const included = feature?.included ?? false;
                return (
                  <td key={pkg.id} className="px-4 py-3 text-center">
                    {included ? (
                      <Check className="mx-auto h-4 w-4 text-gold" strokeWidth={2.5} aria-label={`${name} included in ${pkg.name}`} />
                    ) : (
                      <span className="mx-auto block h-[2px] w-4 rounded bg-white/15" aria-label={`${name} not included in ${pkg.name}`} />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PackagesPageContent() {
  return (
    <>
      {/* hero — pricing statement + the guarantee that every package shares,
          right where price anxiety peaks */}
      <section className="relative overflow-hidden pt-32 pb-24">
        <Container width="wide">
        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          <div className="min-w-0">
            <AnimateOnScroll><Eyebrow className="mb-7">packages</Eyebrow></AnimateOnScroll>
            <RevealHeading
              as="h1"
              className={HERO_HEADING}
              lead="Pick where you start. Grow from"
              accent="there."
              delay={0.1}
            />
            <AnimateOnScroll delay={0.3}>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-white-secondary">
                Clear scope, clear pricing, no long-term contracts. Every package
                is built and run by our team, not software handed off for you to
                manage, and working from day one.
              </p>
            </AnimateOnScroll>
          </div>
          <AnimateOnScroll as="div" delay={0.2} className="mx-auto w-full max-w-sm">
            <div className="relative overflow-hidden rounded-3xl border border-border-gold/50 bg-[color-mix(in_srgb,var(--gold-base)_5%,var(--bg-elevated))] p-7 backdrop-blur-md">
              <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent opacity-70" />
              <p className="mb-5 font-mono text-[0.62rem] uppercase tracking-[0.22em] text-gold">
                In every package
              </p>
              <ul className="flex flex-col gap-3.5">
                {[
                  "Built and run by us, not software you manage",
                  "A senior team, not a junior account rep",
                  "No long-term contracts. Cancel anytime.",
                  "A direct line to the founder",
                ].map((g) => (
                  <li key={g} className="flex items-start gap-3 text-sm leading-relaxed text-white-secondary">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" strokeWidth={2.5} />
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            </div>
          </AnimateOnScroll>
        </div>
        </Container>
      </section>

      {/* pricing cards */}
      <Section width="wide">
        <div className="grid items-start gap-6 md:grid-cols-3 lg:gap-8">
          {packages.map((pkg) => (
            <PricingCard key={pkg.id} pkg={pkg} />
          ))}
        </div>
        <p className="mt-10 text-center font-mono text-xs uppercase tracking-[0.18em] text-white-muted">
          All prices in USD · payment plans available for Grow and Accelerate
        </p>
      </Section>

      {/* proof, right at the price-decision point */}
      <ProofStrip />

      {/* feature comparison */}
      <Section width="wide" divide className="bg-[var(--bg-section-deep)]">
        <Eyebrow className="mb-6">compare every feature</Eyebrow>
        <Heading size={2} as="h2" className="mb-3 max-w-3xl">
          What&apos;s in each package.
        </Heading>
        <p className="mb-6 max-w-2xl text-base leading-relaxed text-white-muted sm:mb-10">
          See exactly what&apos;s included in each package so you can choose
          with confidence.
        </p>
        <p className="mb-4 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-gold sm:hidden">
          Swipe the table to compare all three →
        </p>
        <AnimateOnScroll
          as="div"
          delay={0.1}
          className="rounded-2xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_92%,transparent)] p-6 backdrop-blur-md sm:p-8"
        >
          <ComparisonTable />
        </AnimateOnScroll>
      </Section>

      {/* faqs */}
      <Section width="text" divide>
        <Eyebrow className="mb-6">frequently asked</Eyebrow>
        <Heading size={2} as="h2" className="mb-3 max-w-3xl">
          Questions, answered.
        </Heading>
        <p className="mb-10 max-w-xl text-base leading-relaxed text-white-muted">
          Everything you need to know about our packages and pricing.
        </p>
        <AnimateOnScroll>
          <Accordion type="single" collapsible>
            {packageFaqs.map((faq, index) => (
              <AccordionItem key={index} value={`faq-${index}`}>
                <AccordionTrigger>{faq.question}</AccordionTrigger>
                <AccordionContent>{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </AnimateOnScroll>
        <p className="mt-8 text-center text-sm text-white-muted">
          Don&apos;t see your question?{" "}
          <a
            href="mailto:john@acceleratewith.us"
            data-cursor="link"
            className="text-gold transition-colors hover:text-gold-light"
          >
            john@acceleratewith.us
          </a>
        </p>
      </Section>

      {/* closing — master style */}
      <Section width="wide" divide>
        <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          <div>
            <Eyebrow className="mb-7">start</Eyebrow>
            <Heading size={1} as="h2">
              Not sure which is right?
            </Heading>
          </div>
          <div className="flex flex-col gap-7">
            <p className="text-lg leading-relaxed text-white-secondary">
              Book a free strategy call. We&apos;ll learn your business and
              recommend the package that fits. No pitch, no obligation.
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
