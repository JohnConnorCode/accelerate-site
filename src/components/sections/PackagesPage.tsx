"use client";

import Link from "next/link";
import { Check, X, ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/Accordion";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { PageHero } from "@/components/ui/PageHero";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { staggerBento, bentoItem, scaleIn } from "@/lib/animations";
import { cn, formatCurrency } from "@/lib/utils";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { packages, packageFaqs } from "@/content/packages";
import type { ServicePackage } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    <motion.div
      id={pkg.slug}
      variants={isHighlighted ? scaleIn : bentoItem}
      className={cn(
        "relative flex flex-col",
        isHighlighted && "lg:-mt-4 lg:mb-4 z-10"
      )}
    >
      {isHighlighted && (
        <div className="flex items-center justify-center gap-1.5 mb-3 text-sm font-semibold text-[var(--gold-light)]">
          <Sparkles className="w-3.5 h-3.5" />
          Most Popular
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
          <div className="mb-6">
            <h3
              className="font-display text-2xl font-bold text-[var(--heading-color)] mb-1"
            >
              {pkg.name}
            </h3>
            <p className="text-sm text-[var(--white-muted)]">{pkg.tagline}</p>
            <p className="text-xs text-[var(--white-muted)] italic mt-1">Best for: {pkg.idealFor}</p>
          </div>

          <div className="mb-6">
            <div className="flex items-baseline gap-1">
              <span
                className={cn(
                  "font-display text-4xl font-bold tracking-tight",
                  isHighlighted ? "text-gold-gradient" : "text-[var(--heading-color)]"
                )}
              >
                {formatCurrency(pkg.priceOneTime)}
              </span>
              <span className="text-[var(--white-muted)] text-sm ml-1">one-time</span>
            </div>
            {pkg.priceMonthly > 0 && (
              <p className="text-sm text-[var(--white-muted)] mt-1">
                + {formatCurrency(pkg.priceMonthly)}/mo for ongoing services
              </p>
            )}
          </div>

          <div className="border-t border-[var(--border-light)] mb-6" />

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
                    className="w-4 h-4 text-[var(--white-muted)] opacity-50 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                )}
                <span
                  className={cn(
                    "text-sm leading-relaxed",
                    feature.included ? "text-[var(--text-nav)]" : "text-[var(--white-muted)]"
                  )}
                >
                  {feature.name}
                  {feature.included && feature.detail && (
                    <span className="text-[var(--white-muted)] ml-1">
                      &mdash; {feature.detail}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>

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
    </motion.div>
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
              className="text-left text-sm font-medium text-[var(--white-muted)] pb-4 pr-4 pl-4 sm:pl-0"
              scope="col"
            >
              Feature
            </th>
            {packages.map((pkg) => (
              <th
                key={pkg.id}
                className={cn(
                  "text-center text-sm font-semibold pb-4 px-4",
                  pkg.highlighted ? "text-[var(--gold-base)]" : "text-[var(--heading-color)]"
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
                "border-t border-[var(--border-subtle)]",
                idx % 2 === 0 && "bg-white/[0.02]"
              )}
            >
              <td className="py-3 pr-4 pl-4 sm:pl-0 text-sm text-[var(--white-secondary)]">
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
      {/* Hero */}
      <PageHero
        label="Packages"
        title={<>Transparent Pricing,{" "}<span className="text-gold-gradient text-shimmer">Real Results</span></>}
        description="Transparent pricing, clear deliverables. Pick the package that matches where you are today and upgrade whenever you're ready."
      />

      <SectionDivider variant="fade" />

      {/* Pricing Cards */}
      <section className="py-24 bg-[var(--bg-base)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={staggerBento}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-start"
          >
            {packages.map((pkg) => (
              <PricingCard key={pkg.id} pkg={pkg} />
            ))}
          </motion.div>

          <AnimateOnScroll>
            <p className="text-center text-sm text-[var(--white-muted)] mt-10">
              All prices in USD. Payment plans available for Grow and Accelerate
              packages.
            </p>
          </AnimateOnScroll>
        </div>
      </section>

      <SectionDivider variant="glow" />

      {/* Social Proof */}
      <section className="py-12 bg-[var(--bg-base)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <GlassCard variant="prominent" padding="md" className="text-center">
              <p className="text-[var(--white-secondary)] font-medium">
                Trusted by 50+ small businesses across 4 industries
              </p>
            </GlassCard>
          </AnimateOnScroll>
        </div>
      </section>

      <SectionDivider variant="glow" />

      {/* Feature Comparison Table */}
      <section className="py-24 bg-[var(--bg-section-deep)] relative overflow-hidden">
        <div className="absolute inset-0 grid-diamond pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <ScrollReveal animation="blur-up">
            <SectionHeader
              heading={
                <>
                  Compare{" "}
                  <span className="text-gold-gradient">Every Feature</span>
                </>
              }
              description="See exactly what is included in each package so you can choose with confidence."
              className="mb-12"
            />
          </ScrollReveal>

          <ScrollReveal animation="clip-left" delay={0.15}>
            <GlassCard variant="prominent" padding="lg">
              <ComparisonTable />
            </GlassCard>
          </ScrollReveal>
        </div>
      </section>

      <SectionDivider variant="glow" />

      {/* FAQ Section */}
      <section className="py-24 bg-[var(--bg-base)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <SectionHeader
              heading={
                <>
                  Frequently Asked{" "}
                  <span className="text-gold-gradient">Questions</span>
                </>
              }
              description="Everything you need to know about our packages and pricing."
              className="mb-12"
            />
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

          <AnimateOnScroll>
            <p className="text-center text-sm text-[var(--white-muted)] mt-8">
              Can&apos;t find your question? Email us at{" "}
              <a
                href="mailto:john@acceleratewith.us"
                className="text-[var(--gold-light)] hover:text-[var(--text-nav-hover)] transition-colors"
              >
                john@acceleratewith.us
              </a>
            </p>
          </AnimateOnScroll>
        </div>
      </section>

      <SectionDivider variant="fade" />

      {/* Bottom CTA */}
      <FinalCTA
        heading={<>Not sure which package is right?</>}
        description="Take 2 minutes to answer a few questions and get a personalized recommendation with projected ROI for your business."
        primaryCTA={{ label: "Get Your Growth Plan", href: "/plan-builder" }}
        secondaryCTA={{ label: "Book a Free Consultation", href: "/contact" }}
      />
    </>
  );
}
