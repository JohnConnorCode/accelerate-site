"use client";

import { motion } from "framer-motion";
import { Download, ArrowRight, ClipboardCheck, Zap, BarChart3 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { leadMagnets } from "@/content/lead-magnets";
import { staggerContainer, fadeUp } from "@/lib/animations";
import { cn } from "@/lib/utils";
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
    <div className="py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <Badge variant="gold" className="mb-4">
            Free Downloads
          </Badge>
          <h1
            className="text-3xl md:text-5xl font-bold text-white-primary mb-4"
            style={{ fontFamily: "var(--font-space-grotesk), var(--font-inter), sans-serif" }}
          >
            Resources That Actually{" "}
            <span className="text-gold-gradient">Help</span>
          </h1>
          <p className="text-lg text-white-secondary max-w-2xl mx-auto">
            No fluff, no filler. Practical guides, checklists, and comparisons
            built for small business owners who want to make smarter decisions
            about AI and automation.
          </p>
        </motion.div>

        {/* Resource Cards */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20"
        >
          {leadMagnets.map((resource) => {
            const Icon = iconMap[resource.icon] || Download;
            return (
              <motion.div key={resource.id} variants={fadeUp}>
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
                    <Badge>{categoryLabels[resource.category]}</Badge>
                  </div>
                  <h2
                    className="text-xl font-bold text-white-primary mb-1"
                    style={{ fontFamily: "var(--font-space-grotesk), var(--font-inter), sans-serif" }}
                  >
                    {resource.title}
                  </h2>
                  <p className="text-sm text-[var(--gold-light)] mb-3">
                    {resource.subtitle}
                  </p>
                  <p className="text-sm text-white-secondary flex-1 mb-6">
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

        {/* Tools CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-20"
        >
          <GlassCard variant="gold" padding="lg" className="text-center">
            <h2
              className="text-2xl md:text-3xl font-bold text-white-primary mb-3"
              style={{ fontFamily: "var(--font-space-grotesk), var(--font-inter), sans-serif" }}
            >
              Want More Than a Download?
            </h2>
            <p className="text-white-secondary max-w-xl mx-auto mb-6">
              Try our free interactive tools for instant, personalized insights.
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
        </motion.div>

        {/* Solution Generator CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h2
            className="text-2xl md:text-3xl font-bold text-white-primary mb-3"
            style={{ fontFamily: "var(--font-space-grotesk), var(--font-inter), sans-serif" }}
          >
            Ready for a Custom Plan?
          </h2>
          <p className="text-white-secondary mb-6 max-w-lg mx-auto">
            Our AI-powered Solution Generator builds a personalized growth plan
            for your business in under 5 minutes.
          </p>
          <Link href="/#solution-generator">
            <Button variant="primary" size="lg" pulse>
              Get Your Growth Plan
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </motion.div>
      </div>

      {/* Resource Gate Modal */}
      {gatedResource && (
        <ResourceGate
          resourceId={gatedResource}
          onClose={() => setGatedResource(null)}
        />
      )}
    </div>
  );
}
