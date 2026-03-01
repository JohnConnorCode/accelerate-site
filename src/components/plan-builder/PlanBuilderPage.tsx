"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Clock, Shield, Sparkles } from "lucide-react";
import { heroReveal } from "@/lib/animations";
import { ConversationalChat } from "./ConversationalChat";

export function PlanBuilderPage() {
  // Ensure page starts at the top
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="min-h-screen pt-32 pb-20 px-4 sm:px-6 relative">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.08),transparent_70%)]" />
      </div>

      <div className="relative z-10">
        {/* Hero */}
        <motion.div
          variants={heroReveal}
          initial="hidden"
          animate="visible"
          className="text-center mb-12 max-w-2xl mx-auto"
        >
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-[var(--heading-color)] mb-4 leading-tight">
            Build Your Custom{" "}
            <span className="text-gold-gradient">Growth Plan</span>
          </h1>
          <p className="text-[var(--white-secondary)] text-base sm:text-lg max-w-xl mx-auto mb-6">
            Answer a few questions about your business and get a
            personalized roadmap with pricing, timelines, and ROI projections.
          </p>

          {/* Trust signals — inline text, not pills */}
          <div className="flex items-center justify-center gap-5 flex-wrap text-xs text-[var(--white-muted)]">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[var(--gold-base)]" />
              5 minutes
            </span>
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[var(--gold-base)]" />
              Personalized by AI
            </span>
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[var(--gold-base)]" />
              Free &amp; private
            </span>
          </div>
        </motion.div>

        {/* Chat */}
        <ConversationalChat />
      </div>
    </main>
  );
}
