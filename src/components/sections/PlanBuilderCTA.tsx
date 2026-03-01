"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { fadeUp } from "@/lib/animations";

export function PlanBuilderCTA() {
  return (
    <section className="py-24 px-4 sm:px-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.06),transparent_70%)]" />
      </div>

      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        className="relative z-10 max-w-2xl mx-auto text-center"
      >
        <div className="flex items-center justify-center gap-1.5 mb-4 text-sm font-semibold text-[var(--gold-light)]">
          <Sparkles className="w-3.5 h-3.5" />
          Free Custom Roadmap
        </div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-white-primary mb-4">
          See exactly what we&apos;d build for you —{" "}
          <span className="text-gold-gradient">in 5 minutes.</span>
        </h2>
        <p className="text-white-secondary mb-8 max-w-lg mx-auto">
          Answer a few questions about your business. Our AI builds a personalized
          plan with specific systems, pricing, timelines, and projected revenue impact.
        </p>
        <Link href="/plan-builder">
          <Button variant="primary" size="lg" pulse className="group/cta">
            Build My Plan
            <ArrowRight className="w-5 h-5 ml-2 transition-transform duration-200 group-hover/cta:translate-x-0.5" />
          </Button>
        </Link>
      </motion.div>
    </section>
  );
}
