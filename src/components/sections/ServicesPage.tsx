"use client";

import Link from "next/link";
import { Globe, Zap, Bot, Check, ArrowRight } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import {
  AnimateOnScroll,
  StaggerContainer,
} from "@/components/ui/AnimateOnScroll";
import { fadeUp } from "@/lib/animations";
import { services } from "@/content/services";

const iconMap: Record<string, React.ElementType> = { Globe, Zap, Bot };

const anchorMap: Record<string, string> = {
  "ai-websites": "websites",
  automations: "automations",
  "ai-agents": "agents",
};

export function ServicesPageContent() {
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
              Services Built to{" "}
              <span className="text-gold-gradient">Grow Your Business</span>
            </h1>
            <p className="text-lg sm:text-xl text-white/65 max-w-2xl mx-auto leading-relaxed">
              From AI-powered websites to intelligent automation, we build
              comprehensive solutions that bring in more leads and save you
              hours every week.
            </p>
          </AnimateOnScroll>
        </div>
      </section>

      <div className="section-divider" />

      {/* Individual Service Sections */}
      {services.map((service) => {
        const Icon = iconMap[service.icon] || Globe;
        const anchor = anchorMap[service.id] || service.id;

        return (
          <div key={service.id}>
            <section id={anchor} className="py-24 bg-[var(--bg-base)]">
              <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
                  {/* Service Info */}
                  <AnimateOnScroll>
                    <GlassCard variant="prominent" padding="lg">
                      <Icon className="w-12 h-12 text-[var(--gold-base)] mb-5" />
                      <h2
                        className="text-2xl sm:text-3xl font-bold text-white mb-4"
                        style={{
                          fontFamily:
                            "var(--font-space-grotesk), var(--font-inter), sans-serif",
                        }}
                      >
                        {service.name}
                      </h2>
                      <p className="text-white/60 leading-relaxed mb-6">
                        {service.description}
                      </p>
                      <div className="flex items-baseline gap-2 mb-6">
                        <span
                          className="text-2xl font-bold text-gold-gradient"
                          style={{
                            fontFamily:
                              "var(--font-space-grotesk), var(--font-inter), sans-serif",
                          }}
                        >
                          {service.pricingDisplay}
                        </span>
                      </div>
                      <Link href="/#solution-generator">
                        <Button variant="primary" size="md">
                          Get a Custom Quote
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </Link>
                    </GlassCard>
                  </AnimateOnScroll>

                  {/* Deliverables */}
                  <AnimateOnScroll delay={0.15}>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-5">
                        What you get
                      </h3>
                      <StaggerContainer as="ul" className="space-y-3">
                        {service.deliverables.map((deliverable) => (
                          <AnimateOnScroll
                            key={deliverable}
                            variants={fadeUp}
                            as="div"
                          >
                            <li className="flex items-start gap-3">
                              <Check className="w-5 h-5 text-[var(--gold-base)] shrink-0 mt-0.5" />
                              <span className="text-white/70 text-sm leading-relaxed">
                                {deliverable}
                              </span>
                            </li>
                          </AnimateOnScroll>
                        ))}
                      </StaggerContainer>
                    </div>
                  </AnimateOnScroll>
                </div>
              </div>
            </section>
            <div className="section-divider" />
          </div>
        );
      })}

      {/* Not Sure CTA */}
      <section className="py-24 bg-[var(--bg-base)] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-radial from-[rgba(212,175,55,0.06)] to-transparent" />
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <AnimateOnScroll>
            <GlassCard variant="gold" padding="none" className="text-center">
              <div className="p-10 sm:p-14">
                <h2
                  className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4"
                  style={{
                    fontFamily:
                      "var(--font-space-grotesk), var(--font-inter), sans-serif",
                  }}
                >
                  Not sure what you need?
                </h2>
                <p className="text-lg text-white/65 max-w-xl mx-auto mb-8">
                  Take 2 minutes to answer a few questions and get a
                  personalized plan with exactly what your business needs, along
                  with pricing and projected ROI.
                </p>
                <Link href="/#solution-generator">
                  <Button variant="primary" size="lg" pulse>
                    Build My Custom Plan
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              </div>
            </GlassCard>
          </AnimateOnScroll>
        </div>
      </section>
    </>
  );
}
