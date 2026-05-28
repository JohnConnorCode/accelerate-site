"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Minus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { SectionMarker } from "@/components/v2/SectionMarker";
import { homeFaqs } from "@/content/home-faq";

export function V2FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="relative bg-bg-base py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <AnimateOnScroll className="lg:sticky lg:top-28 lg:self-start">
            <SectionMarker n="08" label="FAQ" className="mb-5" />
            <h2 className="section-heading">Questions, answered straight.</h2>
            <p className="section-description !mx-0">
              Still unsure? The discovery call exists for exactly that.
            </p>
            <Link
              href="/contact"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-gold-light transition-colors hover:text-gold"
            >
              Ask us directly →
            </Link>
          </AnimateOnScroll>

          <div className="flex flex-col">
            {homeFaqs.map((faq, i) => {
              const isOpen = open === i;
              return (
                <div key={faq.question} className="border-b border-border-glass first:border-t">
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 py-5 text-left"
                    aria-expanded={isOpen}
                  >
                    <span className="text-base font-semibold text-heading sm:text-lg">
                      {faq.question}
                    </span>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border-gold text-gold">
                      {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <p className="pb-5 pr-10 text-sm leading-relaxed text-white-muted sm:text-[0.95rem]">
                          {faq.answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
