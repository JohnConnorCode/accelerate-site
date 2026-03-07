"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Rocket,
  TrendingUp,
  Handshake,
  MapPin,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { AmbientOrbs } from "@/components/ui/AmbientOrbs";
import { ParallaxLayer } from "@/components/ui/ParallaxLayer";
import { PageHero } from "@/components/ui/PageHero";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { Stats } from "@/components/sections/Stats";
import { scaleRotate, clipRevealLeft } from "@/lib/animations";
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
      {/* Hero — immersive */}
      <PageHero
        variant="immersive"
        background="starfield"
        label="About Us"
        title={
          <>
            Built by a Business Owner,{" "}
            <span className="text-gold-gradient">for Business Owners</span>
          </>
        }
        description="We're not a tech company that sells to small businesses. We're small business operators who build technology. That changes everything about how we work."
        backgroundLayers={
          <>
            <ParallaxLayer speed={0.4} className="absolute inset-0">
              <div className="absolute top-[20%] left-[15%] w-64 h-64 rounded-full bg-[radial-gradient(circle,rgba(var(--accent-rgb),0.06)_0%,transparent_70%)]" />
            </ParallaxLayer>
            <ParallaxLayer speed={-0.3} className="absolute inset-0">
              <div className="absolute bottom-[30%] right-[10%] w-48 h-48 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.03)_0%,transparent_70%)]" />
            </ParallaxLayer>
            <div className="absolute inset-0 dot-grid opacity-30" />
          </>
        }
      />

      <SectionDivider variant="fade" />

      {/* Origin Story */}
      <section className="py-24 bg-[var(--bg-base)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Left: Sticky founder card */}
            <div className="lg:sticky lg:top-32 lg:self-start">
              <ScrollReveal animation="blur-up">
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
              </ScrollReveal>
            </div>

            {/* Right: Scrolling narrative */}
            <div className="lg:col-span-2 space-y-12">
              <ScrollReveal animation="slide-left">
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
              </ScrollReveal>

              <ScrollReveal animation="slide-right">
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
              </ScrollReveal>

              <ScrollReveal animation="slide-left">
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
              </ScrollReveal>
            </div>
          </div>
        </div>
      </section>

      <SectionDivider variant="glow" />

      {/* Mission */}
      <section className="py-24 bg-[var(--bg-base)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal animation="clip-left">
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

      <SectionDivider variant="glow" />

      {/* Values — broken grid */}
      <section className="py-24 bg-[var(--bg-base)] relative overflow-hidden">
        <AmbientOrbs count={4} color="gold" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <ScrollReveal animation="blur-up" className="mb-16">
            <SectionHeader
              heading={
                <>
                  What We <span className="text-gold-gradient">Stand For</span>
                </>
              }
            />
          </ScrollReveal>

          {/* First value — full width */}
          {(() => {
            const firstValue = values[0];
            if (!firstValue) return null;
            const FirstIcon = firstValue.icon;
            return (
              <motion.div
                variants={scaleRotate}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="mb-6"
              >
                <GlassCard hover="lift" padding="lg" className="flex flex-col sm:flex-row items-start gap-6">
                  <FirstIcon className="w-10 h-10 text-[var(--gold-base)] shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-[var(--heading-color)] mb-3">
                      {firstValue.title}
                    </h3>
                    <p className="text-[var(--white-secondary)] leading-relaxed mb-4">
                      {firstValue.description}
                    </p>
                    <span className="text-sm text-[var(--gold-light)] font-medium">{firstValue.metric}</span>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })()}

          {/* Second + third values — side by side with offset */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {values.slice(1).map((value, i) => {
              const Icon = value.icon;
              return (
                <motion.div
                  key={value.title}
                  variants={scaleRotate}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  className={i === 1 ? "sm:mt-8" : ""}
                >
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
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <SectionDivider variant="glow" />

      {/* Stats */}
      <Stats />

      <SectionDivider variant="glow" />

      {/* Trust Signals — Mini Case Studies */}
      <section className="py-24 bg-[var(--bg-section-warm)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal animation="blur-up" className="mb-16">
            <SectionHeader
              label="Track Record"
              heading={
                <>
                  Results That <span className="text-gold-gradient">Speak</span>
                </>
              }
            />
          </ScrollReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {caseStudies.slice(0, 3).map((study, i) => (
              <motion.div
                key={study.id}
                variants={clipRevealLeft}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
              >
                <GlassCard hover="lift" padding="lg" className="h-full flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display text-lg font-bold text-[var(--heading-color)]">
                      {study.businessName}
                    </h3>
                    {study.location && (
                      <div className="flex items-center gap-1 text-xs text-[var(--white-muted)]">
                        <MapPin className="w-3 h-3" />
                        {study.location}
                      </div>
                    )}
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
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <SectionDivider variant="fade" />

      {/* CTA */}
      <FinalCTA
        heading={
          <>
            Let&apos;s See If We&apos;re a{" "}
            <span className="text-gold-gradient">Fit</span>
          </>
        }
        description="No pitch deck. No 12-email sequence. Just a 30-minute conversation about your business."
        primaryCTA={{ label: "Book a Free Discovery Call", href: "/contact" }}
        secondaryCTA={{ label: "Get Your Growth Plan", href: "/plan-builder" }}
      />
    </>
  );
}
