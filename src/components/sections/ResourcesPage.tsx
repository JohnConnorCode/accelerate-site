"use client";

import { Download, ArrowRight, ClipboardCheck, Zap, BarChart3 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { PageHero } from "@/components/ui/PageHero";
import {
  AnimateOnScroll,
  StaggerContainer,
} from "@/components/ui/AnimateOnScroll";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { fadeUp } from "@/lib/animations";
import { leadMagnets } from "@/content/lead-magnets";
import { ResourceGate } from "@/components/sections/ResourceGate";
import { useState } from "react";

const iconMap: Record<string, LucideIcon> = {
  ClipboardCheck,
  Zap,
  BarChart3,
};

const categoryLabels: Record<string, string> = {
  checklist: "Checklist",
  guide: "Guide",
  comparison: "Comparison",
};

export function ResourcesPage() {
  const [gatedResource, setGatedResource] = useState<string | null>(null);

  return (
    <>
      {/* Hero */}
      <PageHero
        label="Free Resources"
        title={
          <>
            Resources That Actually{" "}
            <span className="text-gold-gradient">Help</span>
          </>
        }
        description="No fluff, no filler. Practical guides, checklists, and comparisons built for small business owners who want to make smarter decisions about AI and automation."
      />

      <div className="section-divider" />

      {/* Resource Cards */}
      <section className="py-24 bg-[var(--bg-base)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {leadMagnets.map((resource, index) => {
              const Icon = iconMap[resource.icon] || Download;
              return (
                <AnimateOnScroll key={resource.id} variants={fadeUp}>
                  <GlassCard
                    variant="prominent"
                    padding="lg"
                    hover="lift"
                    className="h-full flex flex-col"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-gold-gradient flex items-center justify-center">
                        <Icon className="w-5 h-5 text-black" />
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--white-muted)]">
                        {categoryLabels[resource.category]}
                      </span>
                      {index === 0 && (
                        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--gold-base)]">
                          Most Downloaded
                        </span>
                      )}
                    </div>
                    <h2 className="font-display text-xl font-bold text-white mb-1">
                      {resource.title}
                    </h2>
                    <p className="text-sm text-[var(--gold-light)] mb-3">
                      {resource.subtitle}
                    </p>
                    <p className="text-sm text-white/60 flex-1 mb-6">
                      {resource.description}
                    </p>
                    <Button
                      onClick={() => setGatedResource(resource.id)}
                      className="w-full"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Free
                    </Button>
                  </GlassCard>
                </AnimateOnScroll>
              );
            })}
          </StaggerContainer>
        </div>
      </section>

      <div className="section-divider" />

      {/* Testimonial */}
      <section className="py-24 bg-[var(--bg-base)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal animation="clip-reveal">
            <GlassCard variant="prominent" padding="lg" className="text-center">
              <blockquote className="font-display text-lg sm:text-xl text-white leading-relaxed italic mb-4">
                &ldquo;The AI Readiness Checklist helped us realize we were
                leaving $50K on the table with slow follow-ups. We fixed it in
                two weeks.&rdquo;
              </blockquote>
              <p className="text-sm text-white/50">
                Small business owner, Home Services
              </p>
            </GlassCard>
          </ScrollReveal>
        </div>
      </section>

      <div className="section-divider" />

      {/* Tools CTA */}
      <section className="py-24 bg-[var(--bg-base)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <GlassCard variant="gold" padding="lg" className="text-center">
              <h2 className="font-display text-2xl md:text-3xl font-bold text-white mb-3">
                Want Personalized Insights?
              </h2>
              <p className="text-white/60 max-w-xl mx-auto mb-6">
                Our free interactive tools give you instant, data-driven
                recommendations specific to your business.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/tools/website-grader">
                  <Button variant="primary">
                    Grade My Website
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link href="/tools/roi-calculator">
                  <Button variant="secondary">
                    Calculate My ROI
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </GlassCard>
          </AnimateOnScroll>
        </div>
      </section>

      <div className="section-divider" />

      {/* Solution Generator CTA */}
      <section className="py-24 bg-[var(--bg-base)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll className="text-center">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-white mb-3">
              Ready for a Custom Growth Plan?
            </h2>
            <p className="text-white/60 mb-6 max-w-lg mx-auto">
              Our Solution Generator analyzes your business and builds a
              prioritized roadmap with exact pricing and projected ROI. Takes
              under 5 minutes.
            </p>
            <Link href="/#solution-generator">
              <Button variant="primary" size="lg" pulse>
                Get Your Growth Plan
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </AnimateOnScroll>
        </div>
      </section>

      {/* Resource Gate Modal */}
      {gatedResource && (
        <ResourceGate
          resourceId={gatedResource}
          onClose={() => setGatedResource(null)}
        />
      )}
    </>
  );
}
