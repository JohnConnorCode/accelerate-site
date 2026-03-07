"use client";

import { Suspense, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-init";
import { prefersReducedMotion } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { SignalMark } from "@/components/ui/SignalMark";
import {
  heroReveal,
  heroTagline,
  heroHeadline,
  heroStaggerDramatic,
} from "@/lib/animations";
import { trackConversion } from "@/lib/analytics";

const HeroCanvas = dynamic(
  () => import("@/components/three/HeroCanvas"),
  { ssr: false }
);

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!sectionRef.current || !contentRef.current) return;
    if (prefersReducedMotion()) return;

    gsap.to(contentRef.current, {
      opacity: 0,
      y: -80,
      scale: 0.97,
      ease: "none",
      scrollTrigger: {
        trigger: sectionRef.current,
        start: "top top",
        end: "50% top",
        scrub: 0.5,
      },
    });

    const bgEl = sectionRef.current.querySelector("[data-hero-bg]");
    if (bgEl) {
      gsap.to(bgEl, {
        opacity: 0,
        y: 80,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom top",
          scrub: 0.5,
        },
      });
    }
  }, { scope: sectionRef });

  return (
    <section
      ref={sectionRef}
      className="relative isolate overflow-hidden min-h-screen flex items-center justify-center pt-24 pb-20 sm:pt-28 sm:pb-28"
    >
      <Suspense
        fallback={
          <div className="absolute inset-0 -z-10" style={{ background: "var(--bg-base)" }} />
        }
      >
        <HeroCanvas />
      </Suspense>

      {/* Atmospheric glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(800px,100vw)] h-[500px] pointer-events-none z-[5]"
        style={{
          background:
            "radial-gradient(ellipse, var(--glow-soft) 0%, transparent 70%)",
        }}
      />

      {/* Background SignalMark */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[4] opacity-40">
        <SignalMark size="lg" />
      </div>

      <div
        ref={contentRef}
        className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center pointer-events-none"
      >
        <motion.div
          variants={heroStaggerDramatic}
          initial="hidden"
          animate="visible"
        >
          <motion.p
            variants={heroTagline}
            className="text-sm font-medium text-[var(--gold-light)] tracking-wide uppercase mb-4"
          >
            AI-Powered Growth for Small Business
          </motion.p>

          <motion.h1
            variants={heroHeadline}
            className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-[-0.03em] mb-6"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            <span className="text-[var(--heading-color)]">Grow Your Company</span>
            <br />
            <span className="text-[var(--heading-color)]">and Revenue </span>
            <br className="sm:hidden" />
            <span className="text-gold-gradient font-editorial">on Autopilot</span>
          </motion.h1>

          <motion.p
            variants={heroReveal}
            className="text-lg sm:text-xl text-[var(--white-muted)] max-w-2xl mx-auto leading-relaxed mb-10"
          >
            We build and manage the AI agents, automations, and websites that
            help small businesses book more clients, respond in minutes, and
            reclaim 20+ hours a week.
          </motion.p>

          <motion.div
            variants={heroReveal}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-14"
          >
            <Link
              href="/contact"
              className="pointer-events-auto"
              onClick={() => trackConversion("CTA Click", { section: "Hero", cta_text: "Book a Free Discovery Call", href: "/contact" })}
            >
              <Button variant="primary" size="lg" className="w-full sm:w-auto">
                Book a Free Discovery Call
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link
              href="/resources"
              className="pointer-events-auto"
              onClick={() => trackConversion("CTA Click", { section: "Hero", cta_text: "Get the AI Playbook", href: "/resources" })}
            >
              <Button
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto border-gradient-animated"
              >
                Get the AI Playbook
              </Button>
            </Link>
          </motion.div>

          {/* Trust bar */}
          <motion.div
            variants={heroReveal}
            className="flex flex-wrap items-center justify-center gap-x-3 sm:gap-x-6 gap-y-2 text-xs uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[var(--white-muted)] pointer-events-auto"
          >
            <span className="hidden sm:inline">AI strategy &amp; delivery</span>
            <span className="hidden sm:inline text-[var(--white-muted)]" aria-hidden="true">|</span>
            <span className="hidden sm:inline">Live in 1–2 weeks</span>
            <span className="hidden sm:inline text-[var(--white-muted)]" aria-hidden="true">|</span>
            <span className="hidden sm:inline">Transparent pricing</span>
            <span className="hidden sm:inline text-[var(--white-muted)]" aria-hidden="true">|</span>
            <span className="hidden sm:inline">Free discovery call</span>
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none z-20"
        style={{
          background: "linear-gradient(to bottom, transparent, var(--bg-base))",
        }}
      />
    </section>
  );
}
