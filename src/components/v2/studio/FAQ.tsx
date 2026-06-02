"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Plus } from "lucide-react";
import { EASE } from "@/lib/animations";
import { Eyebrow } from "./primitives";
import { homeFaqs } from "@/content/home-faq";

/* Objection-handling, right before the close. Single-sourced from home-faq.ts
   (the same Q&As that feed the FAQ JSON-LD), so the page and the structured
   data agree. First item open so the section never reads as an empty stack. */
export function FAQ() {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState<number | null>(0);

  const rv = (delay = 0) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 20 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: "-80px" as const },
          transition: { duration: 0.6, ease: EASE, delay },
        };

  return (
    <section className="section-y section-divide relative">
      <div className="page-shell page-shell--narrow">
        <motion.div {...rv()}>
          <Eyebrow className="mb-6">FAQ</Eyebrow>
          <h2 className="display-2 max-w-2xl">Questions, answered.</h2>
        </motion.div>

        <motion.ul {...rv(0.1)} className="mt-12 border-t border-white/10">
          {homeFaqs.map((faq, i) => {
            const isOpen = open === i;
            return (
              <li key={faq.question} className="border-b border-white/10">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  data-cursor="link"
                  className="group flex w-full items-center justify-between gap-6 py-6 text-left"
                >
                  <span
                    className={`text-lg font-semibold transition-colors ${
                      isOpen ? "text-heading" : "text-white-secondary group-hover:text-heading"
                    }`}
                  >
                    {faq.question}
                  </span>
                  <Plus
                    className={`h-5 w-5 shrink-0 text-gold transition-transform duration-300 ${
                      isOpen ? "rotate-45" : ""
                    }`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: EASE }}
                      className="overflow-hidden"
                    >
                      <p className="max-w-2xl pb-6 pr-8 text-base leading-relaxed text-white-muted">
                        {faq.answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </motion.ul>
      </div>
    </section>
  );
}
