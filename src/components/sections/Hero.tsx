"use client";

import { Suspense, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-init";
import { Button } from "@/components/ui/Button";
import { heroReveal, heroStaggerDramatic } from "@/lib/animations";

const HeroCanvas = dynamic(
  () => import("@/components/three/HeroCanvas"),
  { ssr: false }
);

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!sectionRef.current || !contentRef.current) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

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
      className="relative isolate overflow-hidden min-h-screen flex items-center justify-center pt-28 pb-28"
    >
      <Suspense
        fallback={
          <div className="absolute inset-0 -z-10" style={{ background: "var(--bg-base)" }} />
        }
      >
        <HeroCanvas />
      </Suspense>

      <div
        ref={contentRef}
        className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center pointer-events-none"
      >
        <motion.div
          variants={heroStaggerDramatic}
          initial="hidden"
          animate="visible"
        >
          {/* Industry qualifier */}
          <motion.p
            variants={heroReveal}
            className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gold-base)] mb-8"
          >
            The growth team for service businesses
          </motion.p>

          <motion.h1
            variants={heroReveal}
            className="font-display text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.05] tracking-[-0.03em] mb-6"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            <span className="text-[var(--heading-color)]">Book more jobs. Answer every call.</span>
            <br />
            <span className="text-[var(--heading-color)]">
              Never miss a <span className="text-gold-gradient">follow-up again.</span>
            </span>
          </motion.h1>

          <motion.p
            variants={heroReveal}
            className="text-lg sm:text-xl text-[var(--white-muted)] max-w-2xl mx-auto leading-relaxed mb-10"
          >
            We build your website, AI agents, and automations — then run them
            alongside you. Every call answered. Every follow-up sent. Every
            opportunity won.
          </motion.p>

          <motion.div
            variants={heroReveal}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
          >
            <Link href="/contact" className="pointer-events-auto">
              <Button variant="primary" size="lg" className="w-full sm:w-auto">
                Book a free strategy call
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link href="/results" className="pointer-events-auto">
              <Button
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto border-gradient-animated"
              >
                See client results
              </Button>
            </Link>
          </motion.div>

          {/* Trust bar — industries served */}
          <motion.div
            variants={heroReveal}
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs uppercase tracking-[0.2em] text-[var(--white-muted)] pointer-events-auto"
          >
            <span>Home Services</span>
            <span className="hidden sm:inline text-[var(--white-muted)]">|</span>
            <span>Law Firms</span>
            <span className="hidden sm:inline text-[var(--white-muted)]">|</span>
            <span>Professional Services</span>
            <span className="hidden sm:inline text-[var(--white-muted)]">|</span>
            <span>Real Estate</span>
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none z-20"
        style={{
          background: "linear-gradient(to bottom, transparent, var(--bg-section-warm))",
        }}
      />
    </section>
  );
}
