"use client";

import { Mail, Phone, Calendar } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  AnimateOnScroll,
} from "@/components/ui/AnimateOnScroll";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/Accordion";
import { ContactForm } from "@/components/sections/ContactForm";
import { faqs } from "@/content/faqs";

export function ContactPageContent() {
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
              Let&apos;s Talk{" "}
              <span className="text-gold-gradient">Growth</span>
            </h1>
            <p className="text-lg sm:text-xl text-white/65 max-w-2xl mx-auto leading-relaxed">
              Tell us about your business and we will put together a plan that
              makes sense for where you are and where you want to go.
            </p>
          </AnimateOnScroll>
        </div>
      </section>

      <div className="section-divider" />

      {/* Contact Section */}
      <section className="py-24 bg-[var(--bg-base)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Left: Form */}
            <AnimateOnScroll>
              <ContactForm />
            </AnimateOnScroll>

            {/* Right: Contact Info */}
            <AnimateOnScroll delay={0.15}>
              <div className="space-y-6">
                {/* Contact Details */}
                <GlassCard padding="lg">
                  <h3
                    className="text-xl font-bold text-white mb-6"
                    style={{
                      fontFamily:
                        "var(--font-space-grotesk), var(--font-inter), sans-serif",
                    }}
                  >
                    Get in Touch
                  </h3>
                  <div className="space-y-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] flex items-center justify-center shrink-0">
                        <Mail className="w-5 h-5 text-[var(--gold-base)]" />
                      </div>
                      <div>
                        <p className="text-sm text-white/50">Email</p>
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
                        <p className="text-sm text-white/50">Phone</p>
                        <p className="text-white">(Coming soon)</p>
                      </div>
                    </div>
                  </div>
                </GlassCard>

                {/* Calendly Placeholder */}
                <GlassCard variant="gold" padding="lg">
                  <div className="flex items-center gap-3 mb-4">
                    <Calendar className="w-6 h-6 text-[var(--gold-base)]" />
                    <h3
                      className="text-xl font-bold text-white"
                      style={{
                        fontFamily:
                          "var(--font-space-grotesk), var(--font-inter), sans-serif",
                      }}
                    >
                      Schedule a Call
                    </h3>
                  </div>
                  <p className="text-white/65 text-sm mb-6">
                    Prefer to talk live? Book a free 30-minute consultation
                    and we will walk through your options together.
                  </p>
                  <div className="w-full h-48 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-glass)] flex items-center justify-center">
                    <p className="text-white/30 text-sm">
                      Calendly embed placeholder
                    </p>
                  </div>
                </GlassCard>
              </div>
            </AnimateOnScroll>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* FAQ Section */}
      <section className="py-24 bg-[var(--bg-base)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll className="text-center mb-12">
            <h2
              className="text-3xl sm:text-4xl font-bold tracking-tight mb-4"
              style={{
                fontFamily:
                  "var(--font-space-grotesk), var(--font-inter), sans-serif",
              }}
            >
              Frequently Asked{" "}
              <span className="text-gold-gradient">Questions</span>
            </h2>
            <p className="text-lg text-white/60">
              Quick answers to the questions we hear most.
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
