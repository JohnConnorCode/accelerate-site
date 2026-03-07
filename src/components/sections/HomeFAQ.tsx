"use client";

import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/Accordion";
import { homeFaqs } from "@/content/home-faq";

export function HomeFAQ() {
  return (
    <section className="relative py-24 bg-[var(--bg-section-warm)] overflow-hidden">
      <div className="orb-white -top-32 -right-48 opacity-40" />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal animation="fade-up">
          <SectionHeader
            align="left"
            heading="Common Questions"
            className="mb-12"
          />
        </ScrollReveal>

        <ScrollReveal animation="fade-up" delay={0.15}>
          <Accordion type="single" collapsible>
            {homeFaqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger>{faq.question}</AccordionTrigger>
                <AccordionContent>{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollReveal>
      </div>
    </section>
  );
}
