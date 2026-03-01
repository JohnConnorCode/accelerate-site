"use client";

import Link from "next/link";
import { Wrench, Scale, Briefcase, Building2, ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { staggerBento, bentoItem } from "@/lib/animations";
import { GridPattern } from "@/components/ui/Illustrations";

const iconMap: Record<string, LucideIcon> = {
  Wrench,
  Scale,
  Briefcase,
  Building2,
};

const industries = [
  {
    name: "Home Services",
    icon: "Wrench",
    description:
      "Roofing, HVAC, plumbing, electrical. Answer every call and book more jobs — even from the job site.",
    href: "/industries/home-services",
  },
  {
    name: "Law Firms",
    icon: "Scale",
    description:
      "Solo practitioners and small firms. Faster intake, more signed retainers, less admin.",
    href: "/industries/law-firms",
  },
  {
    name: "Professional Services",
    icon: "Briefcase",
    description:
      "Accountants, advisors, consultants. Grow beyond referrals with systems that fill your calendar.",
    href: "/industries/professional-services",
  },
  {
    name: "Real Estate",
    icon: "Building2",
    description:
      "Agents and brokerages. Respond in seconds, nurture for months, close more deals.",
    href: "/industries/real-estate",
  },
];


export function Industries() {
  return (
    <section className="relative py-28 bg-[var(--bg-base)] overflow-hidden">
      <GridPattern className="absolute inset-0 opacity-[0.08] pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimateOnScroll className="text-center mb-16">
          <h2 className="section-heading mb-4">
            Built for how{" "}
            <span className="text-gold-gradient">your industry</span> actually works.
          </h2>
          <p className="text-lg text-[var(--white-muted)] max-w-2xl mx-auto">
            Generic tools waste your money. We build systems around the way your customers find, choose, and hire you.
          </p>
        </AnimateOnScroll>

        <motion.div
          variants={staggerBento}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {industries.map((industry, i) => {
            const Icon = iconMap[industry.icon];
            if (!Icon) return null;
            const isOffset = i % 2 === 1;

            return (
              <motion.div
                key={industry.name}
                variants={bentoItem}
                className={isOffset ? "lg:mt-8" : ""}
              >
                <Link href={industry.href} className="block h-full group">
                  <div className="relative glass rounded-xl p-8 h-full flex flex-col items-start card-hover-shine hover:border-gold-glow transition-all duration-300 overflow-hidden">
                    {/* Top accent line — reveals on hover */}
                    <div className="absolute top-0 left-0 right-0 h-px bg-gold-gradient scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />

                    <div className="w-12 h-12 rounded-lg bg-[rgba(212,175,55,0.08)] flex items-center justify-center mb-5">
                      <Icon className="w-6 h-6 text-[var(--gold-base)]" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {industry.name}
                    </h3>
                    <p className="text-sm text-[var(--white-muted)] leading-relaxed mb-4 flex-1">
                      {industry.description}
                    </p>
                    <span className="inline-flex items-center gap-1 text-sm text-[var(--white-muted)] group-hover:text-[var(--gold-light)] transition-colors">
                      Learn More
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>

      </div>
    </section>
  );
}
