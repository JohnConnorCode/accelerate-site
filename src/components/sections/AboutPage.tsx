"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Rocket,
  TrendingUp,
  Handshake,
  MapPin,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import {
  AnimateOnScroll,
  StaggerContainer,
} from "@/components/ui/AnimateOnScroll";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PageHero } from "@/components/ui/PageHero";
import { Stats } from "@/components/sections/Stats";
import { fadeUp } from "@/lib/animations";
import { caseStudies } from "@/content/case-studies";

const values = [
  {
    icon: Rocket,
    title: "Ship Fast, Iterate Faster",
    description:
      "We ship in weeks, not months. Your business can't wait for a six-month project timeline. We move fast, get you live, and optimize from real data instead of guesswork.",
    metric: "1–2 weeks avg. time to launch",
  },
  {
    icon: TrendingUp,
    title: "Measure Everything That Matters",
    description:
      "We measure success by your growth, not our hours. Every project has clear metrics from day one, and we track them obsessively so you always know what's working.",
    metric: "+40% avg. revenue lift at 90 days",
  },
  {
    icon: Handshake,
    title: "Earn It Every Month",
    description:
      "No vanity metrics. No overblown promises. We earn your business every single month by delivering results you can see in your bank account.",
    metric: "94% client retention rate",
  },
];

function FounderPhoto() {
  return (
    <div className="w-32 h-32 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-glass)] overflow-hidden mx-auto mb-4 relative">
      <span className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-[var(--gold-light)]" aria-hidden="true">
        JC
      </span>
      <Image
        src="/images/john.jpg"
        alt="John Connor — Founder of Accelerate"
        width={128}
        height={128}
        className="relative z-10 object-cover w-full h-full"
      />
    </div>
  );
}

export function AboutPageContent() {
  return (
    <>
      {/* Hero */}
      <PageHero
        label="About Us"
        title={
          <>
            Built by a Business Owner,{" "}
            <span className="text-gold-gradient">for Business Owners</span>
          </>
        }
        description="We're not a tech company that sells to small businesses. We're small business operators who build technology. That changes everything about how we work."
      />

      <div className="section-divider" />

      {/* Origin Story */}
      <section className="py-24 bg-[var(--bg-base)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Left: Sticky founder card */}
            <div className="lg:sticky lg:top-32 lg:self-start">
              <AnimateOnScroll>
                <GlassCard variant="prominent" padding="lg" className="text-center">
                  <FounderPhoto />
                  <h2 className="font-display text-2xl font-bold text-[var(--heading-color)] mb-1">
                    John Connor
                  </h2>
                  <p className="text-[var(--gold-light)] font-medium mb-2">
                    Founder
                  </p>
                  <p className="text-xs text-[var(--white-muted)]">
                    Tech builder. Business owner. Roofer (seriously).
                  </p>
                </GlassCard>
              </AnimateOnScroll>
            </div>

            {/* Right: Scrolling narrative */}
            <div className="lg:col-span-2 space-y-12">
              <AnimateOnScroll>
                <div>
                  <p className="section-label">The Resume</p>
                  <p className="text-[var(--white-secondary)] leading-relaxed">
                    Over a decade building technology platforms. Drove 15x
                    revenue growth to 300K+ monthly active users at Upland.
                    Raised over $1M for Sparkblox through partnerships with
                    Chainlink and Algorand. Built HelpWith to 3,000+ service
                    providers across four markets.
                  </p>
                </div>
              </AnimateOnScroll>

              <AnimateOnScroll>
                <div>
                  <p className="section-label">The Real Story</p>
                  <div className="space-y-4 text-[var(--white-secondary)] leading-relaxed">
                    <p>
                      But resumes don&apos;t tell you much. Here&apos;s what
                      matters: I also run a roofing company in Mississippi.
                      I&apos;ve sat across the table from a homeowner trying to
                      close a deal. I&apos;ve missed calls because I was up on a
                      roof. I&apos;ve wasted money on a website that looked
                      pretty and generated zero calls.
                    </p>
                    <p>
                      That frustration is why Accelerate exists. I built the
                      tools I wished I had — and they worked. Then contractors I
                      know started asking, &ldquo;Can you set that up for me
                      too?&rdquo;
                    </p>
                  </div>
                </div>
              </AnimateOnScroll>

              <AnimateOnScroll>
                <div>
                  <p className="section-label">The Approach</p>
                  <div className="space-y-4 text-[var(--white-secondary)] leading-relaxed">
                    <p>
                      We&apos;re not trying to be the biggest agency. We take on
                      a limited number of clients so we can actually operate
                      alongside each one. When your AI agent gives a wrong
                      answer at 11 PM, we fix it by morning. When your pipeline
                      dips, we dig into the data before you even notice.
                    </p>
                    <p className="text-[var(--white-primary)] font-medium italic">
                      This isn&apos;t a set-it-and-forget-it shop. We&apos;re in
                      the business of your results.
                    </p>
                  </div>
                </div>
              </AnimateOnScroll>
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* Mission */}
      <section className="py-24 bg-[var(--bg-base)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal animation="clip-reveal">
            <GlassCard variant="gold" padding="lg" className="text-center">
              <p className="text-sm text-[var(--gold-light)] font-medium tracking-wide uppercase mb-4">
                Our Mission
              </p>
              <p className="font-display text-xl sm:text-2xl text-[var(--white-primary)] leading-relaxed">
                Give small businesses the same AI-powered growth tools that
                Fortune 500 companies use — without the enterprise budget, the
                six-month timeline, or the 47-slide strategy deck.
              </p>
            </GlassCard>
          </ScrollReveal>
        </div>
      </section>

      <div className="section-divider" />

      {/* Values */}
      <section className="py-24 bg-[var(--bg-base)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll className="mb-16">
            <SectionHeader
              heading={
                <>
                  What We <span className="text-gold-gradient">Stand For</span>
                </>
              }
            />
          </AnimateOnScroll>

          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {values.map((value) => {
              const Icon = value.icon;
              return (
                <AnimateOnScroll key={value.title} variants={fadeUp}>
                  <GlassCard hover="lift" padding="lg" className="h-full flex flex-col">
                    <Icon className="w-10 h-10 text-[var(--gold-base)] mb-5" />
                    <h3 className="text-xl font-semibold text-[var(--heading-color)] mb-3">
                      {value.title}
                    </h3>
                    <p className="text-[var(--white-secondary)] leading-relaxed flex-1 mb-4">
                      {value.description}
                    </p>
                    <div className="pt-4 border-t border-[var(--border-light)]">
                      <span className="text-sm text-[var(--gold-light)] font-medium">{value.metric}</span>
                    </div>
                  </GlassCard>
                </AnimateOnScroll>
              );
            })}
          </StaggerContainer>
        </div>
      </section>

      <div className="section-divider" />

      {/* Stats */}
      <Stats />

      <div className="section-divider" />

      {/* Trust Signals — Mini Case Studies */}
      <section className="py-24 bg-[var(--bg-section-warm)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll className="mb-16">
            <SectionHeader
              label="Track Record"
              heading={
                <>
                  Results That <span className="text-gold-gradient">Speak</span>
                </>
              }
            />
          </AnimateOnScroll>

          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {caseStudies.slice(0, 3).map((study) => (
              <AnimateOnScroll key={study.id} variants={fadeUp}>
                <GlassCard hover="lift" padding="lg" className="h-full flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display text-lg font-bold text-[var(--heading-color)]">
                      {study.businessName}
                    </h3>
                    <div className="flex items-center gap-1 text-xs text-[var(--white-muted)]">
                      <MapPin className="w-3 h-3" />
                      {study.location}
                    </div>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--gold-base)] mb-4">
                    {study.industry === "home_services"
                      ? "Home Services"
                      : study.industry === "law_firm"
                        ? "Law Firm"
                        : "Professional Services"}
                  </p>
                  <p className="font-display text-2xl font-bold text-gold-gradient mb-2">
                    {study.metrics[0]?.improvement}
                  </p>
                  <p className="text-sm text-[var(--white-secondary)] flex-1 mb-4 line-clamp-2">
                    {study.results.split(".")[0]}.
                  </p>
                  <Link
                    href={`/results/${study.slug}`}
                    className="inline-flex items-center gap-1.5 text-sm text-[var(--text-nav)] hover:text-[var(--text-nav-hover)] link-gold-underline transition-colors"
                  >
                    Read Case Study
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </GlassCard>
              </AnimateOnScroll>
            ))}
          </StaggerContainer>
        </div>
      </section>

      <div className="section-divider" />

      {/* CTA */}
      <section className="py-24 bg-[var(--bg-base)] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-radial from-[rgba(var(--accent-rgb),0.06)] to-transparent" />
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <AnimateOnScroll>
            <GlassCard variant="gold" padding="none" className="text-center">
              <div className="p-10 sm:p-14">
                <h2 className="section-heading mb-4">
                  Let&apos;s See If We&apos;re a{" "}
                  <span className="text-gold-gradient">Fit</span>
                </h2>
                <p className="text-lg text-[var(--white-secondary)] max-w-xl mx-auto mb-8">
                  No pitch deck. No 12-email sequence. Just a 30-minute
                  conversation about your business.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/contact">
                    <Button
                      variant="primary"
                      size="lg"
                      className="w-full sm:w-auto"
                    >
                      Book a Free Discovery Call
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </Link>
                  <Link href="/plan-builder">
                    <Button
                      variant="secondary"
                      size="lg"
                      className="w-full sm:w-auto"
                    >
                      Get Your Growth Plan
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
