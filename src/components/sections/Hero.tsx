"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { heroStagger, heroItem } from "@/lib/animations";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="orb-gold top-[-10%] right-[-5%]" />
        <div className="orb-white bottom-[-15%] left-[-10%]" />
      </div>

      {/* Content */}
      <motion.div
        variants={heroStagger}
        initial="hidden"
        animate="visible"
        className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center pt-24"
      >
        <motion.p
          variants={heroItem}
          className="text-sm sm:text-base text-[var(--gold-light)] font-medium tracking-wide uppercase mb-6"
        >
          AI Automation Agency
        </motion.p>

        <motion.h1
          variants={heroItem}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6"
          style={{ fontFamily: "var(--font-space-grotesk), var(--font-inter), sans-serif" }}
        >
          Stop Losing Leads.{" "}
          <span className="text-gold-gradient">Start Growing.</span>
        </motion.h1>

        <motion.p
          variants={heroItem}
          className="text-lg sm:text-xl text-white/65 max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          We build AI-powered websites, automations, and intelligent agents that
          help small businesses capture more leads and save hours every week.
        </motion.p>

        <motion.div
          variants={heroItem}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Link href="/#solution-generator">
            <Button variant="primary" size="lg" className="w-full sm:w-auto">
              Get Your Growth Plan
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
          <Link href="/#how-it-works">
            <Button variant="secondary" size="lg" className="w-full sm:w-auto">
              See How It Works
            </Button>
          </Link>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          variants={heroItem}
          className="mt-20 flex justify-center"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <ChevronDown className="w-6 h-6 text-white/20" />
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}
