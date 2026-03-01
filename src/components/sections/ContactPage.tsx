"use client";

import { Mail, Phone, Calendar, ArrowRight, MessageSquare, FileText, CheckCircle, Shield, Clock, Users } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import {
  AnimateOnScroll,
  StaggerContainer,
} from "@/components/ui/AnimateOnScroll";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { PageHero } from "@/components/ui/PageHero";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/Accordion";
import { ContactForm } from "@/components/sections/ContactForm";
import { faqs } from "@/content/faqs";
import { fadeUp } from "@/lib/animations";
import { testimonials } from "@/content/testimonials";

export function ContactPageContent() {
  const sarahTestimonial = testimonials.find((t) => t.id === "testimonial-2");

  return (
    <>
      {/* Hero */}
      <PageHero
        label="Contact"
        title={
          <>
            Your Growth Plan Starts with a{" "}
            <span className="text-gold-gradient">Conversation</span>
          </>
        }
        description="Tell us where you are and where you want to go. We'll respond within one business day with honest feedback on whether we can help."
      >
        <div className="flex items-center justify-center gap-6 flex-wrap mt-8 text-sm text-[var(--white-muted)]">
          <span className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[var(--gold-base)]" />
            No contracts
          </span>
          <span className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--gold-base)]" />
            Response &lt; 24 hours
          </span>
          <span className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--gold-base)]" />
            94% retention
          </span>
        </div>
      </PageHero>

      <div className="section-divider" />

      {/* Contact Section */}
      <section className="py-24 bg-[var(--bg-base)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Social proof bar */}
          <AnimateOnScroll className="text-center mb-12">
            <div className="inline-flex items-center gap-3">
              <div className="flex -space-x-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-[rgba(212,175,55,0.4)] to-[rgba(212,175,55,0.15)] border-2 border-[var(--bg-base)]"
                  />
                ))}
              </div>
              <p className="text-sm text-[var(--white-muted)]">
                Trusted by 50+ small businesses
              </p>
            </div>
          </AnimateOnScroll>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Left: Form */}
            <AnimateOnScroll>
              <ContactForm />
            </AnimateOnScroll>

            {/* Right: Contact Info + Cards */}
            <AnimateOnScroll delay={0.15}>
              <div className="space-y-6">
                {/* Contact Details */}
                <GlassCard padding="lg">
                  <h3 className="font-display text-xl font-bold text-white mb-6">
                    Get in Touch
                  </h3>
                  <div className="space-y-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] flex items-center justify-center shrink-0">
                        <Mail className="w-5 h-5 text-[var(--gold-base)]" />
                      </div>
                      <div>
                        <p className="text-sm text-[var(--white-muted)]">Email</p>
                        <a
                          href="mailto:hello@acceleratewith.us"
                          className="text-white hover:text-[var(--gold-light)] transition-colors"
                        >
                          hello@acceleratewith.us
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] flex items-center justify-center shrink-0">
                        <Phone className="w-5 h-5 text-[var(--gold-base)]" />
                      </div>
                      <div>
                        <p className="text-sm text-[var(--white-muted)]">Phone</p>
                        <p className="text-white">(Coming soon)</p>
                      </div>
                    </div>
                  </div>
                </GlassCard>

                {/* Calendly Placeholder */}
                <GlassCard variant="gold" padding="lg">
                  <div className="flex items-center gap-3 mb-4">
                    <Calendar className="w-6 h-6 text-[var(--gold-base)]" />
                    <h3 className="font-display text-xl font-bold text-white">
                      Skip the Back and Forth
                    </h3>
                  </div>
                  <p className="text-[var(--white-secondary)] text-sm mb-6">
                    Book a free 30-minute strategy call. No pitch, no pressure
                    — just an honest assessment of what AI can do for your
                    business.
                  </p>
                  <div className="w-full h-48 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-glass)] flex items-center justify-center">
                    <p className="text-[var(--white-muted)] text-sm">
                      Calendly embed placeholder
                    </p>
                  </div>
                </GlassCard>

                {/* Testimonial Card */}
                {sarahTestimonial && (
                  <GlassCard variant="prominent" padding="lg">
                    <div className="border-l-2 border-[var(--gold-base)] pl-4">
                      <p className="text-[var(--text-nav)] text-sm italic leading-relaxed mb-3">
                        &ldquo;{sarahTestimonial.quote}&rdquo;
                      </p>
                      <p className="text-sm font-medium text-white">
                        {sarahTestimonial.name}
                      </p>
                      <p className="text-xs text-[var(--white-muted)]">
                        {sarahTestimonial.title}, {sarahTestimonial.businessType}
                      </p>
                    </div>
                  </GlassCard>
                )}
              </div>
            </AnimateOnScroll>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* What Happens Next */}
      <section className="py-24 bg-[var(--bg-section-warm)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll className="text-center mb-16">
            <p className="section-label">What Happens Next</p>
            <h2 className="section-heading mb-4">
              From Inquiry to{" "}
              <span className="text-gold-gradient">Action</span>
            </h2>
          </AnimateOnScroll>

          <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {/* Gold connecting line (desktop) */}
            <div className="hidden md:block absolute top-1/2 left-[16.7%] right-[16.7%] h-px bg-gradient-to-r from-[rgba(212,175,55,0.3)] via-[rgba(212,175,55,0.5)] to-[rgba(212,175,55,0.3)]" />

            {[
              {
                icon: MessageSquare,
                title: "We Reply",
                desc: "Within one business day, a real person responds. We'll ask a few clarifying questions.",
              },
              {
                icon: Calendar,
                title: "Strategy Call",
                desc: "Free 30-minute call where we audit your current setup. No obligation.",
              },
              {
                icon: FileText,
                title: "Custom Plan",
                desc: "Detailed proposal with exact pricing, timeline, and projected ROI.",
              },
            ].map((step) => {
              const Icon = step.icon;
              return (
                <AnimateOnScroll key={step.title} variants={fadeUp}>
                  <GlassCard padding="lg" className="relative text-center h-full">
                    <div className="w-12 h-12 rounded-full bg-[rgba(212,175,55,0.15)] border border-[rgba(212,175,55,0.3)] flex items-center justify-center mx-auto mb-4">
                      <Icon className="w-5 h-5 text-[var(--gold-light)]" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {step.title}
                    </h3>
                    <p className="text-sm text-[var(--white-muted)] leading-relaxed">
                      {step.desc}
                    </p>
                  </GlassCard>
                </AnimateOnScroll>
              );
            })}
          </StaggerContainer>
        </div>
      </section>

      <div className="section-divider" />

      {/* FAQ Section */}
      <section className="py-24 bg-[var(--bg-base)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll className="text-center mb-12">
            <h2 className="section-heading mb-4">
              Common Questions{" "}
              <span className="text-gold-gradient">Answered</span>
            </h2>
            <p className="text-lg text-[var(--white-secondary)]">
              Everything you need to know before reaching out.
            </p>
          </AnimateOnScroll>

          <AnimateOnScroll>
            <Accordion type="single" collapsible>
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`faq-${index}`}>
                  <AccordionTrigger>{faq.question}</AccordionTrigger>
                  <AccordionContent>{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </AnimateOnScroll>
        </div>
      </section>
    </>
  );
}
