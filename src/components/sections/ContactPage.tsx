"use client";

import Link from "next/link";
import { Mail, ArrowRight, Clock, Zap } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { PageHero } from "@/components/ui/PageHero";
import { ContactForm } from "@/components/sections/ContactForm";

export function ContactPageContent() {
  const heroVisual = (
    <div className="space-y-4">
      <GlassCard padding="md" hover="lift">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-[rgba(var(--accent-rgb),0.1)] border border-[rgba(var(--accent-rgb),0.2)] flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5 text-[var(--gold-base)]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--heading-color)]">Email</p>
            <a
              href="mailto:john@acceleratewith.us"
              className="text-sm text-[var(--white-secondary)] hover:text-[var(--gold-light)] transition-colors"
            >
              john@acceleratewith.us
            </a>
          </div>
        </div>
      </GlassCard>

      <GlassCard padding="md" hover="lift">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-[rgba(var(--accent-rgb),0.1)] border border-[rgba(var(--accent-rgb),0.2)] flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-[var(--gold-base)]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--heading-color)]">Response Time</p>
            <p className="text-sm text-[var(--white-secondary)]">Within 1 business day</p>
          </div>
        </div>
      </GlassCard>

      <GlassCard padding="md" hover="lift">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-[rgba(var(--accent-rgb),0.1)] border border-[rgba(var(--accent-rgb),0.2)] flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-[var(--gold-base)]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--heading-color)]">Discovery Call</p>
            <p className="text-sm text-[var(--white-secondary)]">Free, 30 minutes</p>
          </div>
        </div>
      </GlassCard>
    </div>
  );

  return (
    <>
      {/* Hero — split with info cards */}
      <PageHero
        variant="split"
        label="Contact"
        title={
          <>
            Let&rsquo;s Talk About{" "}
            <span className="text-gold-gradient">Your Business</span>
          </>
        }
        description="Tell us where you are and where you want to go. We'll respond within one business day."
        visual={heroVisual}
      />

      <SectionDivider variant="fade" />

      {/* Form Section */}
      <section className="py-24 bg-[var(--bg-base)] relative overflow-hidden">
        <div className="absolute inset-0 grid-overlay-fine pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
            {/* Left: Form */}
            <ScrollReveal animation="blur-up" className="lg:col-span-3">
              <ContactForm />
            </ScrollReveal>

            {/* Right: CTA */}
            <ScrollReveal animation="slide-right" delay={0.15} className="lg:col-span-2">
              <div className="space-y-6">
                <GlassCard variant="gold" padding="lg">
                  <h3 className="font-display text-xl font-bold text-[var(--heading-color)] mb-3">
                    Want a custom AI plan?
                  </h3>
                  <p className="text-sm text-[var(--white-secondary)] mb-5 leading-relaxed">
                    Answer a few questions and get a personalized growth plan
                    with recommendations, timelines, and pricing — free.
                  </p>
                  <Link href="/plan-builder">
                    <Button variant="primary" size="md">
                      Get Your Growth Plan
                      <ArrowRight className="w-4 h-4 ml-1.5" />
                    </Button>
                  </Link>
                </GlassCard>
              </div>
            </ScrollReveal>
          </div>

          {/* Trust badges below form */}
          <div className="mt-12 flex items-center justify-center gap-6 flex-wrap text-sm text-[var(--white-muted)]">
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--gold-base)]" />
              &lt; 24hr response
            </span>
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[var(--gold-base)]" />
              No obligation
            </span>
            <span className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-[var(--gold-base)]" />
              Direct to founder
            </span>
          </div>
        </div>
      </section>
    </>
  );
}
