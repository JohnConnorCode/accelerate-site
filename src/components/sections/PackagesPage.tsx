"use client";

import Link from "next/link";
import { Check, X, ArrowRight, Sparkles } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/Accordion";
import {
  AnimateOnScroll,
  StaggerContainer,
} from "@/components/ui/AnimateOnScroll";
import { fadeUp } from "@/lib/animations";
import { cn, formatCurrency } from "@/lib/utils";
import { packages, packageFaqs } from "@/content/packages";
import type { ServicePackage } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collect every unique feature name across all packages, preserving order. */
function getAllFeatureNames(): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const pkg of packages) {
    for (const f of pkg.features) {
      if (!seen.has(f.name)) {
        seen.add(f.name);
        names.push(f.name);
      }
    }
  }
  return names;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PricingCard({ pkg }: { pkg: ServicePackage }) {
  const isHighlighted = pkg.highlighted;

  return (
    <div
      id={pkg.slug}
      className={cn(
        "relative flex flex-col",
        isHighlighted && "lg:-mt-4 lg:mb-4 z-10"
      )}
    >
      {/* "Most Popular" badge floating above card */}
      {isHighlighted && (
        <div className="flex justify-center mb-3">
          <Badge variant="gold" className="gap-1.5">
            <Sparkles className="w-3 h-3" />
            Most Popular
          </Badge>
        </div>
      )}

      <GlassCard
        variant={isHighlighted ? "gold" : "default"}
        hover="lift"
        padding="none"
        className={cn(
          "flex flex-col flex-1",
          isHighlighted && "border-gold-glow"
        )}
      >
        <div className="p-6 sm:p-8 flex flex-col flex-1">
          {/* Header */}
          <div className="mb-6">
            <h3
              className="text-2xl font-bold text-white mb-1"
              style={{
                fontFamily:
                  "var(--font-space-grotesk), var(--font-inter), sans-serif",
              }}
            >
              {pkg.name}
            </h3>
            <p className="text-sm text-white/50">{pkg.tagline}</p>
          </div>

          {/* Price */}
          <div className="mb-6">
            <div className="flex items-baseline gap-1">
              <span
                className={cn(
                  "text-4xl font-bold tracking-tight",
                  isHighlighted ? "text-gold-gradient" : "text-white"
                )}
                style={{
                  fontFamily:
                    "var(--font-space-grotesk), var(--font-inter), sans-serif",
                }}
              >
                {formatCurrency(pkg.priceOneTime)}
              </span>
              <span className="text-white/40 text-sm ml-1">one-time</span>
            </div>
            {pkg.priceMonthly > 0 && (
              <p className="text-sm text-white/50 mt-1">
                + {formatCurrency(pkg.priceMonthly)}/mo for ongoing services
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-white/10 mb-6" />

          {/* Feature list */}
          <ul className="space-y-3 mb-8 flex-1" role="list">
            {pkg.features.map((feature) => (
              <li key={feature.name} className="flex items-start gap-3">
                {feature.included ? (
                  <Check
                    className="w-4 h-4 text-[var(--gold-base)] shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                ) : (
                  <X
                    className="w-4 h-4 text-white/20 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                )}
                <span
                  className={cn(
                    "text-sm leading-relaxed",
                    feature.included ? "text-white/70" : "text-white/30"
                  )}
                >
                  {feature.name}
                  {feature.included && feature.detail && (
                    <span className="text-white/40 ml-1">
                      &mdash; {feature.detail}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>

          {/* CTA */}
          <Link href={pkg.ctaLink} className="mt-auto">
            <Button
              variant={isHighlighted ? "primary" : "secondary"}
              size="lg"
              className="w-full"
              pulse={isHighlighted}
            >
              {pkg.ctaText}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}

function ComparisonTable() {
  const featureNames = getAllFeatureNames();

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="w-full min-w-[640px] border-collapse" role="table">
        <thead>
          <tr>
            <th
              className="text-left text-sm font-medium text-white/50 pb-4 pr-4 pl-4 sm:pl-0"
              scope="col"
            >
              Feature
            </th>
            {packages.map((pkg) => (
              <th
                key={pkg.id}
                className={cn(
                  "text-center text-sm font-semibold pb-4 px-4",
                  pkg.highlighted ? "text-[var(--gold-base)]" : "text-white"
                )}
                scope="col"
              >
                {pkg.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {featureNames.map((featureName, idx) => (
            <tr
              key={featureName}
              className={cn(
                "border-t border-white/5",
                idx % 2 === 0 && "bg-white/[0.02]"
              )}
            >
              <td className="py-3 pr-4 pl-4 sm:pl-0 text-sm text-white/60">
                {featureName}
              </td>
              {packages.map((pkg) => {
                const feature = pkg.features.find(
                  (f) => f.name === featureName
                );
                const included = feature?.included ?? false;
                return (
                  <td key={pkg.id} className="py-3 px-4 text-center">
                    {included ? (
                      <Check
                        className="w-4 h-4 text-[var(--gold-base)] mx-auto"
                        aria-label={`${featureName} included in ${pkg.name}`}
                      />
                    ) : (
                      <span
                        className="block w-4 h-[2px] bg-white/15 mx-auto rounded"
                        aria-label={`${featureName} not included in ${pkg.name}`}
                      />
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

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export function PackagesPageContent() {
  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Hero Section                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        {/* Background orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="orb-gold top-[-10%] right-[-5%]" />
          <div className="orb-white bottom-[-15%] left-[-10%]" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <AnimateOnScroll>
            <h1
              className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-6"
              style={{
                fontFamily:
                  "var(--font-space-grotesk), var(--font-inter), sans-serif",
              }}
            >
              Transparent Pricing,{" "}
              <span className="text-gold-gradient">Real Results</span>
            </h1>
            <p className="text-lg sm:text-xl text-white/65 max-w-2xl mx-auto leading-relaxed">
              No hidden fees, no long-term contracts. Pick the package that
              matches where you are today and upgrade whenever you are ready.
            </p>
          </AnimateOnScroll>
        </div>
      </section>

      <div className="section-divider" />

      {/* ------------------------------------------------------------------ */}
      {/* Pricing Cards                                                       */}
      {/* ------------------------------------------------------------------ */}
      <section className="py-24 bg-[var(--bg-base)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-start">
            {packages.map((pkg) => (
              <AnimateOnScroll key={pkg.id} variants={fadeUp}>
                <PricingCard pkg={pkg} />
              </AnimateOnScroll>
            ))}
          </StaggerContainer>

          <AnimateOnScroll>
            <p className="text-center text-sm text-white/40 mt-10">
              All prices in USD. Payment plans available for Grow and Accelerate
              packages.
            </p>
          </AnimateOnScroll>
        </div>
      </section>

      <div className="section-divider" />

      {/* ------------------------------------------------------------------ */}
      {/* Feature Comparison Table                                            */}
      {/* ------------------------------------------------------------------ */}
      <section className="py-24 bg-[var(--bg-base)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <h2
              className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-4"
              style={{
                fontFamily:
                  "var(--font-space-grotesk), var(--font-inter), sans-serif",
              }}
            >
              Compare{" "}
              <span className="text-gold-gradient">Every Feature</span>
            </h2>
            <p className="text-center text-white/50 mb-12 max-w-xl mx-auto">
              See exactly what is included in each package so you can choose
              with confidence.
            </p>
          </AnimateOnScroll>

          <AnimateOnScroll delay={0.15}>
            <GlassCard variant="prominent" padding="lg">
              <ComparisonTable />
            </GlassCard>
          </AnimateOnScroll>
        </div>
      </section>

      <div className="section-divider" />

      {/* ------------------------------------------------------------------ */}
      {/* FAQ Section                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section className="py-24 bg-[var(--bg-base)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <h2
              className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-4"
              style={{
                fontFamily:
                  "var(--font-space-grotesk), var(--font-inter), sans-serif",
              }}
            >
              Frequently Asked{" "}
              <span className="text-gold-gradient">Questions</span>
            </h2>
            <p className="text-center text-white/50 mb-12 max-w-xl mx-auto">
              Everything you need to know about our packages and pricing.
            </p>
          </AnimateOnScroll>

          <AnimateOnScroll delay={0.1}>
            <Accordion type="single" collapsible>
              {packageFaqs.map((faq, index) => (
                <AccordionItem key={index} value={`faq-${index}`}>
                  <AccordionTrigger>{faq.question}</AccordionTrigger>
                  <AccordionContent>{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </AnimateOnScroll>
        </div>
      </section>

      <div className="section-divider" />

      {/* ------------------------------------------------------------------ */}
      {/* Bottom CTA                                                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="py-24 bg-[var(--bg-base)] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-radial from-[rgba(212,175,55,0.06)] to-transparent" />
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <AnimateOnScroll>
            <GlassCard variant="gold" padding="none" className="text-center">
              <div className="p-10 sm:p-14">
                <h2
                  className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4"
                  style={{
                    fontFamily:
                      "var(--font-space-grotesk), var(--font-inter), sans-serif",
                  }}
                >
                  Not sure which package is right?
                </h2>
                <p className="text-lg text-white/65 max-w-xl mx-auto mb-8">
                  Take 2 minutes to answer a few questions and get a
                  personalized recommendation with projected ROI for your
                  business.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/#solution-generator">
                    <Button
                      variant="primary"
                      size="lg"
                      pulse
                      className="w-full sm:w-auto"
                    >
                      Build My Custom Plan
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </Link>
                  <Link href="/contact">
                    <Button
                      variant="secondary"
                      size="lg"
                      className="w-full sm:w-auto"
                    >
                      Book a Free Consultation
                    </Button>
                  </Link>
                </div>
              </div>
            </GlassCard>
          </AnimateOnScroll>
        </div>
      </section>
    </>
  );
}
