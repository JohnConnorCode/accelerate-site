"use client";

import Link from "next/link";
import { Mail, ArrowRight } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { PageHero } from "@/components/ui/PageHero";
import { ContactForm } from "@/components/sections/ContactForm";

export function ContactPageContent() {
  return (
    <>
      <PageHero
        label="Contact"
        title={
          <>
            Let&rsquo;s Talk About{" "}
            <span className="text-gold-gradient">Your Business</span>
          </>
        }
        description="Tell us where you are and where you want to go. We'll respond within one business day."
      />

      <div className="section-divider" />

      <section className="py-24 bg-[var(--bg-base)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
            {/* Left: Form */}
            <AnimateOnScroll className="lg:col-span-3">
              <ContactForm />
            </AnimateOnScroll>

            {/* Right: Email + CTA */}
            <AnimateOnScroll delay={0.15} className="lg:col-span-2">
              <div className="space-y-6">
                <GlassCard padding="lg">
                  <h3 className="font-display text-xl font-bold text-[var(--heading-color)] mb-4">
                    Email Us Directly
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[rgba(var(--accent-rgb),0.1)] border border-[rgba(var(--accent-rgb),0.2)] flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5 text-[var(--gold-base)]" />
                    </div>
                    <a
                      href="mailto:john@acceleratewith.us"
                      className="text-[var(--white-primary)] hover:text-[var(--gold-light)] transition-colors"
                    >
                      john@acceleratewith.us
                    </a>
                  </div>
                </GlassCard>

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
            </AnimateOnScroll>
          </div>
        </div>
      </section>
    </>
  );
}
