"use client";

import { useRef } from "react";
import Image from "next/image";
import {
  Target,
  Rocket,
  Mail as MailIcon,
  Calendar,
  DollarSign,
  Zap,
  Send,
  MessageSquare,
  CreditCard,
  Cog,
  Brain,
  Phone,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-init";
import { prefersReducedMotion } from "@/lib/utils";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { integrationTools } from "@/content/integrations";

const iconMap: Record<string, LucideIcon> = {
  Target,
  Rocket,
  Mail: MailIcon,
  Calendar,
  DollarSign,
  Zap,
  Send,
  MessageSquare,
  CreditCard,
  Cog,
  Brain,
  Phone,
};

export function Integrations() {
  const gridRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!gridRef.current) return;
    if (prefersReducedMotion()) return;

    const cards = gridRef.current.querySelectorAll("[data-tool-card]");

    gsap.fromTo(cards,
      { opacity: 0, scale: 0.8 },
      {
        opacity: 1,
        scale: 1,
        duration: 0.4,
        delay: 0.2,
        stagger: 0.04,
        ease: "back.out(1.5)",
        scrollTrigger: {
          trigger: gridRef.current,
          start: "top 85%",
          toggleActions: "play none none none",
        },
      }
    );
  }, { scope: gridRef });

  return (
    <section className="relative py-24 bg-[var(--bg-section-deep)] overflow-hidden">
      <div className="grid-perspective" />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal animation="clip-reveal">
          <SectionHeader
            label="Integrations"
            heading={
              <>
                Your Stack. <span className="text-gold-gradient">Our Glue.</span>
              </>
            }
            description="We&apos;re tool-agnostic. We connect to your existing stack and recommend what actually fits, not what pays us a commission."
            className="mb-12"
          />
        </ScrollReveal>

        <div
          ref={gridRef}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4"
        >
          {integrationTools.map((tool) => {
            const Icon = iconMap[tool.icon];
            if (!Icon && !tool.logo) return null;
            return (
              <div
                key={tool.name}
                data-tool-card
                className="card-outline rounded-xl p-3 sm:p-4 flex flex-col items-center gap-3 cursor-default group hover:border-border-gold transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-xl bg-transparent border border-border-glass flex items-center justify-center group-hover:border-border-gold group-hover:bg-[var(--glow-soft)] transition-all">
                  {tool.logo ? (
                    <Image
                      src={tool.logo}
                      alt={`${tool.name} logo`}
                      width={20}
                      height={20}
                      className="w-5 h-5 opacity-70 group-hover:opacity-100 transition-opacity"
                    />
                  ) : Icon ? (
                    <Icon className="w-5 h-5 text-gold-light" aria-hidden="true" />
                  ) : null}
                </div>
                <span className="text-xs font-medium text-white-primary text-center leading-tight">
                  {tool.name}
                </span>
              </div>
            );
          })}
        </div>

        <p className="text-center text-sm text-white-muted mt-8">
          Plus hundreds more through custom integrations.
        </p>
      </div>
    </section>
  );
}
