"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-init";
import { prefersReducedMotion } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { InteractiveGridField } from "@/components/v2/InteractiveGridField";
import {
  heroReveal,
  heroTagline,
  heroHeadline,
  heroStaggerDramatic,
} from "@/lib/animations";
import { trackConversion } from "@/lib/analytics";

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
      {/* Base */}
      <div
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{ background: "var(--bg-base)" }}
      />
      {/* Immersive interactive point-grid (parallax target) */}
      <div data-hero-bg className="absolute inset-0 -z-10">
        {/* ambient breathing glow — alive even before cursor moves */}
        <div
          className="hero-glow absolute left-1/2 top-[42%] h-[520px] w-[min(820px,100vw)]"
          style={{
            background:
              "radial-gradient(circle, rgba(var(--accent-rgb),0.18) 0%, transparent 70%)",
          }}
        />
        <InteractiveGridField className="absolute inset-0 h-full w-full" />
        {/* vignette to seat the type */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 42%, transparent 52%, var(--bg-base) 92%)",
          }}
        />
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
            className="font-mono text-xs sm:text-sm font-medium text-gold tracking-wide mb-5"
          >
            {"// ai · automation · cutting-edge strategy"}
          </motion.p>

          <motion.h1
            variants={heroHeadline}
            className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-bold leading-[1.02] tracking-[-0.035em] mb-6"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            <span className="text-heading">Accelerate your business</span>
            <br />
            <span className="text-gold">with AI.</span>
          </motion.h1>

          <motion.p
            variants={heroReveal}
            className="text-lg sm:text-xl text-white-secondary max-w-2xl mx-auto leading-relaxed mb-10"
          >
            We solve your technology problems, automate the busywork, and turn
            more of your inquiries into booked revenue. The AI systems that{" "}
            <span className="text-heading font-semibold">drive your business</span>{" "}
            and make you money.
          </motion.p>

          <motion.div
            variants={heroReveal}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-14"
          >
            <Link
              href="/contact"
              className="pointer-events-auto"
              onClick={() => trackConversion("CTA Click", { section: "Hero", cta_text: "Book a Free Strategy Call", href: "/contact" })}
            >
              <Button variant="primary" size="lg" className="w-full sm:w-auto">
                Book a Free Strategy Call
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link
              href="/industries"
              className="pointer-events-auto"
              onClick={() => trackConversion("CTA Click", { section: "Hero", cta_text: "See what we build", href: "/industries" })}
            >
              <Button
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto border-gradient-animated"
              >
                See what we build
              </Button>
            </Link>
          </motion.div>

          {/* Trust bar */}
          <motion.div
            variants={heroReveal}
            className="flex flex-wrap items-center justify-center gap-x-3 sm:gap-x-6 gap-y-2 text-xs uppercase tracking-[0.15em] sm:tracking-[0.2em] text-white-muted pointer-events-auto"
          >
            <span className="hidden sm:inline">AI strategy &amp; delivery</span>
            <span className="hidden sm:inline text-white-muted" aria-hidden="true">|</span>
            <span className="hidden sm:inline">Working from day one</span>
            <span className="hidden sm:inline text-white-muted" aria-hidden="true">|</span>
            <span className="hidden sm:inline">Transparent pricing</span>
            <span className="hidden sm:inline text-white-muted" aria-hidden="true">|</span>
            <span className="hidden sm:inline">Free strategy call</span>
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
