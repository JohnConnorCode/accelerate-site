"use client";

import { Download, ArrowRight, ClipboardCheck, Zap, BarChart3 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { PageHero } from "@/components/ui/PageHero";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { AmbientOrbs } from "@/components/ui/AmbientOrbs";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { staggerBento, bentoItem, clipRevealLeft, slideFromRight } from "@/lib/animations";
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

  // First resource featured, rest in grid
  const featured = leadMagnets[0];
  const rest = leadMagnets.slice(1);

  return (
    <>
      {/* Hero — editorial */}
      <PageHero
        variant="editorial"
        background="orbs"
        itemAnimation={slideFromRight}
        label="Free Resources"
        title={
          <>
            Resources That Actually{" "}
            <span className="text-gold-gradient">Help</span>
          </>
        }
        description="No fluff, no filler. Practical guides, checklists, and comparisons built for small business owners who want to make smarter decisions about AI and automation."
        accentText="RESOURCES"
      />

      <SectionDivider variant="fade" />

      {/* Featured + Grid */}
      <section className="py-24 bg-[var(--bg-base)] relative overflow-hidden">
        <AmbientOrbs count={3} color="white" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Featured resource — full width with clipRevealLeft */}
          {featured && (() => {
            const FeaturedIcon = iconMap[featured.icon] || Download;
            return (
              <motion.div
                variants={clipRevealLeft}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="mb-10"
              >
                <GlassCard
                  variant="gold"
                  padding="lg"
                  hover="lift"
                  className="flex flex-col sm:flex-row items-start gap-6"
                >
                  <div className="w-14 h-14 rounded-lg bg-gold-gradient flex items-center justify-center shrink-0">
                    <FeaturedIcon className="w-7 h-7 text-black" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--white-muted)]">
                        {categoryLabels[featured.category]}
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--gold-base)]">
                        Most Downloaded
                      </span>
                    </div>
                    <h2 className="font-display text-2xl font-bold text-[var(--heading-color)] mb-1">
                      {featured.title}
                    </h2>
                    <p className="text-sm text-[var(--gold-light)] mb-3">
                      {featured.subtitle}
                    </p>
                    <p className="text-sm text-[var(--white-secondary)] mb-6">
                      {featured.description}
                    </p>
                    <Button onClick={() => setGatedResource(featured.id)}>
                      <Download className="w-4 h-4 mr-2" />
                      Download Free
                    </Button>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })()}

          {/* Rest in 2-col bento grid */}
          <motion.div
            variants={staggerBento}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-6"
          >
            {rest.map((resource) => {
              const Icon = iconMap[resource.icon] || Download;
              return (
                <motion.div key={resource.id} variants={bentoItem}>
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
                    </div>
                    <h2 className="font-display text-xl font-bold text-[var(--heading-color)] mb-1">
                      {resource.title}
                    </h2>
                    <p className="text-sm text-[var(--gold-light)] mb-3">
                      {resource.subtitle}
                    </p>
                    <p className="text-sm text-[var(--white-secondary)] flex-1 mb-6">
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
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      <SectionDivider variant="glow" />

      {/* Testimonial */}
      <section className="py-24 bg-[var(--bg-base)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal animation="clip-left">
            <GlassCard variant="prominent" padding="lg" className="text-center">
              <blockquote className="font-display text-lg sm:text-xl text-[var(--white-primary)] leading-relaxed italic mb-4">
                &ldquo;The AI Readiness Checklist helped us realize we were
                leaving $50K on the table with slow follow-ups. We fixed it in
                two weeks.&rdquo;
              </blockquote>
              <p className="text-sm text-[var(--white-muted)]">
                Small business owner, Home Services
              </p>
            </GlassCard>
          </ScrollReveal>
        </div>
      </section>

      <SectionDivider variant="fade" />

      {/* Single consolidated CTA */}
      <FinalCTA
        heading={<>Want Personalized Insights?</>}
        description="Our free interactive tools give you instant, data-driven recommendations specific to your business."
        primaryCTA={{ label: "Grade My Website", href: "/tools/website-grader" }}
        secondaryCTA={{ label: "Calculate My ROI", href: "/tools/roi-calculator" }}
      />

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
