"use client";

import Link from "next/link";
import {
  ArrowRight,
  Rocket,
  TrendingUp,
  Handshake,
  User,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import {
  AnimateOnScroll,
  StaggerContainer,
} from "@/components/ui/AnimateOnScroll";
import { Stats } from "@/components/sections/Stats";
import { fadeUp } from "@/lib/animations";

const values = [
  {
    icon: Rocket,
    title: "Build Fast",
    description:
      "We ship in weeks, not months. Your business can't wait for a six-month project timeline. We move fast, iterate, and get you live quickly.",
  },
  {
    icon: TrendingUp,
    title: "Deliver Results",
    description:
      "We measure success by your growth, not our hours. Every project has clear metrics, and we track them from day one.",
  },
  {
    icon: Handshake,
    title: "No Fluff",
    description:
      "No long-term contracts. No vanity metrics. No overblown promises. We earn your business every month by delivering real results.",
  },
];

export function AboutPageContent() {
  return (
    <>
      {/* Hero */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
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
              The Team Behind{" "}
              <span className="text-gold-gradient">Accelerate</span>
            </h1>
            <p className="text-lg sm:text-xl text-white/65 max-w-2xl mx-auto leading-relaxed">
              We are builders and business owners who understand what it takes to
              grow a company from the ground up.
            </p>
          </AnimateOnScroll>
        </div>
      </section>

      <div className="section-divider" />

      {/* Founder Section */}
      <section className="py-24 bg-[var(--bg-base)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <GlassCard variant="prominent" padding="lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                {/* Photo placeholder */}
                <div className="flex justify-center md:justify-start">
                  <div className="w-48 h-48 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-glass)] flex items-center justify-center">
                    <User className="w-20 h-20 text-white/20" />
                  </div>
                </div>

                {/* Bio */}
                <div className="md:col-span-2 space-y-4">
                  <div>
                    <h2
                      className="text-2xl sm:text-3xl font-bold text-white mb-1"
                      style={{
                        fontFamily:
                          "var(--font-space-grotesk), var(--font-inter), sans-serif",
                      }}
                    >
                      John Connor
                    </h2>
                    <p className="text-[var(--gold-light)] font-medium">
                      Founder
                    </p>
                  </div>

                  <div className="space-y-3 text-white/65 leading-relaxed">
                    <p>
                      Over a decade building technology platforms. Drove 15x
                      revenue growth to 300K+ monthly active users at Upland.
                      Raised over $1M for Sparkblox through partnerships with
                      Chainlink and Algorand. Built HelpWith to 3,000+ service
                      providers.
                    </p>
                    <p>
                      Also runs a roofing company in Mississippi. That
                      firsthand experience is the difference between theory
                      and knowing what actually works for small businesses.
                    </p>
                    <p className="text-white/80 font-medium italic">
                      &quot;Not just a tech person selling to businesses. A
                      business owner who builds technology.&quot;
                    </p>
                  </div>
                </div>
              </div>
            </GlassCard>
          </AnimateOnScroll>
        </div>
      </section>

      <div className="section-divider" />

      {/* Mission */}
      <section className="py-24 bg-[var(--bg-base)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <GlassCard variant="gold" padding="lg" className="text-center">
              <p className="text-sm text-[var(--gold-light)] font-medium tracking-wide uppercase mb-4">
                Our Mission
              </p>
              <p
                className="text-xl sm:text-2xl text-white leading-relaxed"
                style={{
                  fontFamily:
                    "var(--font-space-grotesk), var(--font-inter), sans-serif",
                }}
              >
                Help small businesses compete with larger competitors using
                AI-powered tools, without enterprise budgets or technical teams.
              </p>
            </GlassCard>
          </AnimateOnScroll>
        </div>
      </section>

      <div className="section-divider" />

      {/* Values */}
      <section className="py-24 bg-[var(--bg-base)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll className="text-center mb-16">
            <h2
              className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4"
              style={{
                fontFamily:
                  "var(--font-space-grotesk), var(--font-inter), sans-serif",
              }}
            >
              What We <span className="text-gold-gradient">Stand For</span>
            </h2>
          </AnimateOnScroll>

          <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {values.map((value) => {
              const Icon = value.icon;
              return (
                <AnimateOnScroll key={value.title} variants={fadeUp}>
                  <GlassCard hover="lift" padding="lg" className="h-full">
                    <Icon className="w-10 h-10 text-[var(--gold-base)] mb-5" />
                    <h3 className="text-xl font-semibold text-white mb-3">
                      {value.title}
                    </h3>
                    <p className="text-white/60 leading-relaxed">
                      {value.description}
                    </p>
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

      {/* CTA */}
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
                  Ready to Work Together?
                </h2>
                <p className="text-lg text-white/65 max-w-xl mx-auto mb-8">
                  Book a free consultation and see exactly how Accelerate can
                  grow your business. No commitment, no pressure, just a clear
                  plan.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/contact">
                    <Button
                      variant="primary"
                      size="lg"
                      className="w-full sm:w-auto"
                    >
                      Book Your Free Consultation
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </Link>
                  <Link href="/#solution-generator">
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
