"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Clock, Shield, Sparkles } from "lucide-react";
import { fadeUp } from "@/lib/animations";
import { ConversationalChat } from "./ConversationalChat";

export function PlanBuilderPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="min-h-screen pt-28 sm:pt-36 pb-24 px-4 sm:px-6 relative">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 gradient-mesh opacity-40" />
        <div className="absolute inset-0 grid-overlay opacity-20" />
        <div className="hero-glow-orb hero-glow-orb-gold absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      </div>

      <div className="relative z-10">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="text-center mb-12 max-w-3xl mx-auto"
        >
          <p className="section-label">Growth Plan</p>
          <h1 className="page-heading leading-[1.1] mb-5">
            Your Custom{" "}
            <span className="text-gold-gradient">Growth Plan</span>
            {" "}in 5 Minutes
          </h1>
          <p className="text-lg sm:text-xl text-white-secondary max-w-2xl mx-auto leading-relaxed mb-6">
            Answer a few quick questions. Our AI builds a personalized
            strategy with recommendations, timelines, and pricing.
          </p>

          <div className="flex items-center justify-center gap-6 flex-wrap text-sm text-white-muted">
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gold" />
              5 minutes
            </span>
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-gold" />
              Personalized by AI
            </span>
            <span className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-gold" />
              Free & private
            </span>
          </div>
        </motion.div>

        <ConversationalChat />
      </div>
    </main>
  );
}
