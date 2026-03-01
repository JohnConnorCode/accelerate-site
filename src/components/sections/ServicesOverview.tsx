"use client";

import Link from "next/link";
import { Globe, Zap, Bot, ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { staggerBento, bentoItem } from "@/lib/animations";

const iconMap: Record<string, LucideIcon> = { Globe, Zap, Bot };

type ServiceDefinition = {
  icon: keyof typeof iconMap;
  name: string;
  outcome: string;
  description: string;
  href: string;
};

const services: ServiceDefinition[] = [
  {
    icon: "Globe",
    name: "AI-Powered Websites",
    outcome: "Turn your website into your best salesperson",
    description:
      "Next.js sites built for conversion with AI chat, smart forms, and personalized CTAs.",
    href: "/services#websites",
  },
  {
    icon: "Zap",
    name: "Automations & Workflows",
    outcome: "Get 10 hours back every single week",
    description:
      "Connect your CRM, calendar, email, and SMS into one automated system.",
    href: "/services#automations",
  },
  {
    icon: "Bot",
    name: "AI Agents",
    outcome: "An employee who works nights, weekends, and holidays",
    description:
      "Voice and chat agents that answer, qualify, and book while your team sleeps.",
    href: "/services#agents",
  },
];

export function ServicesOverview() {
  return (
    <section className="py-36 bg-[var(--bg-base)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimateOnScroll className="text-center mb-16">
          <p className="section-label">
            What We Build & Run
          </p>
          <h2 className="section-heading mb-4">
            Three systems that pay for themselves.
          </h2>
        </AnimateOnScroll>

        <motion.div
          variants={staggerBento}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {services.map((service, i) => (
            <motion.div
              key={service.name}
              variants={bentoItem}
              className={i === 0 ? "md:col-span-2" : ""}
            >
              <ServiceCard service={service} highlight={i === 0} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function ServiceCard({ service, highlight }: { service: ServiceDefinition; highlight: boolean }) {
  const Icon = iconMap[service.icon];

  return (
    <Link href={service.href} className="block h-full group">
      <div
        className={`relative glass rounded-2xl h-full card-hover-shine hover:border-gold-glow transition-all duration-300 overflow-hidden ${
          highlight ? "p-10" : "p-8"
        }`}
      >
        <div className="relative flex flex-col gap-5">
          <div className="w-12 h-12 rounded-lg bg-[rgba(212,175,55,0.08)] flex items-center justify-center">
            {Icon && <Icon className="w-6 h-6 text-[var(--gold-base)]" />}
          </div>
          <div>
            <h3 className="text-2xl font-semibold text-white mb-1">
              {service.name}
            </h3>
            <p className="text-[var(--gold-light)] text-sm font-medium mb-3">
              {service.outcome}
            </p>
            <p className="text-[var(--white-muted)] leading-relaxed">{service.description}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-sm text-[var(--white-muted)] group-hover:text-[var(--text-nav-hover)] transition-colors">
            Learn More
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </Link>
  );
}
