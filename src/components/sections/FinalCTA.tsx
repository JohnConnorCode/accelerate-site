"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-init";
import { prefersReducedMotion } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { SignalMark } from "@/components/ui/SignalMark";
import { trackConversion } from "@/lib/analytics";

interface FinalCTAProps {
  heading?: ReactNode;
  description?: string;
  primaryCTA?: { label: string; href: string };
  secondaryCTA?: { label: string; href: string };
}

export function FinalCTA({ heading, description, primaryCTA, secondaryCTA }: FinalCTAProps = {}) {
  const sectionRef = useRef<HTMLElement>(null);

  const resolvedHeading = heading ?? (
    <>
      Let&apos;s Talk About <span className="text-gold">Your Business</span>
    </>
  );
  const resolvedDescription =
    description ??
    "Free strategy call. 30 minutes. You walk away with a clear plan, whether you work with us or not.";
  const resolvedPrimary = primaryCTA ?? {
    label: "Book a Free Strategy Call",
    href: "/contact",
  };
  const resolvedSecondary = secondaryCTA ?? null;

  useGSAP(
    () => {
      if (!sectionRef.current) return;
      if (prefersReducedMotion()) return;

      // Parallax: background layers move at different speeds
      const meshBg = sectionRef.current.querySelector("[data-parallax-mesh]");
      const glowBg = sectionRef.current.querySelector("[data-parallax-glow]");

      if (meshBg) {
        gsap.fromTo(
          meshBg,
          { y: 60 },
          {
            y: -60,
            ease: "none",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top bottom",
              end: "bottom top",
              scrub: 1,
            },
          },
        );
      }

      if (glowBg) {
        gsap.fromTo(
          glowBg,
          { scale: 0.8, opacity: 0.3 },
          {
            scale: 1.2,
            opacity: 0.7,
            ease: "none",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top bottom",
              end: "bottom top",
              scrub: 1,
            },
          },
        );
      }

      // Content reveal
      const heading = sectionRef.current.querySelector("[data-cta-heading]");
      const desc = sectionRef.current.querySelector("[data-cta-desc]");
      const founder = sectionRef.current.querySelector("[data-cta-founder]");
      const buttons = sectionRef.current.querySelector("[data-cta-buttons]");

      [heading, desc, founder, buttons].forEach((el, i) => {
        if (!el) return;
        gsap.fromTo(
          el,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            delay: i * 0.15,
            ease: "power2.out",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 70%",
              toggleActions: "play none none none",
            },
          },
        );
      });
    },
    { scope: sectionRef },
  );

  return (
    <section
      ref={sectionRef}
      className="py-16 sm:py-32 md:py-40 relative overflow-hidden bg-bg-base"
    >
      {/* Atmospheric background layers */}
      <div className="absolute inset-0 pointer-events-none">
        <div data-parallax-mesh className="absolute inset-0 gradient-mesh opacity-25" />
        <div className="absolute top-1/2 right-[10%] -translate-y-1/2 opacity-30">
          <SignalMark size="lg" />
        </div>
        <div
          data-parallax-glow
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(700px,95vw)] h-[400px] rounded-full"
          style={{
            background:
              "radial-gradient(ellipse, rgba(var(--accent-rgb),0.08) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Tron perspective grid floor + horizon glow — matches hero */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none z-[1]"
        style={{
          height: "45%",
          overflow: "hidden",
          maskImage:
            "linear-gradient(to bottom, transparent 0%, black 3%, black 80%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, black 3%, black 80%, transparent 100%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: "-20%",
            width: "140%",
            height: "100%",
            perspective: "500px",
            perspectiveOrigin: "50% 0%",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "linear-gradient(rgba(var(--accent-rgb),0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(var(--accent-rgb),0.14) 1px, transparent 1px)",
              backgroundSize: "50px 50px",
              transform: "rotateX(72deg)",
              transformOrigin: "50% 0%",
              animation: "tron-grid-scroll 8s linear infinite",
            }}
          />
        </div>
      </div>
      {/* Horizon glow line */}
      <div
        className="absolute left-0 right-0 pointer-events-none z-[2]"
        style={{
          bottom: "45%",
          height: "48px",
          background:
            "linear-gradient(to bottom, transparent, rgba(var(--accent-rgb),0.06) 40%, rgba(var(--accent-rgb),0.14) 50%, rgba(var(--accent-rgb),0.06) 60%, transparent)",
        }}
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <h2 data-cta-heading className="page-heading mb-6">
          {resolvedHeading}
        </h2>
        <p data-cta-desc className="text-lg sm:text-xl text-white-muted max-w-xl mx-auto mb-8">
          {resolvedDescription}
        </p>
        <div data-cta-founder className="flex items-center justify-center gap-3 mb-10">
          <Image
            src="/images/john.jpg"
            alt="John Connor, Founder of Accelerate"
            width={48}
            height={48}
            className="w-12 h-12 rounded-full object-cover border-2 border-[rgba(var(--accent-rgb),0.3)]"
          />
          <div className="text-left">
            <p className="text-sm font-semibold text-white-primary">John Connor</p>
            <p className="text-xs text-white-muted">Founder, Accelerate</p>
          </div>
        </div>
        <div data-cta-buttons className="flex flex-col sm:flex-row gap-3 sm:gap-5 justify-center">
          <MagneticButton>
            <Link
              href={resolvedPrimary.href}
              onClick={() =>
                trackConversion("CTA Click", {
                  section: "Final CTA",
                  cta_text: resolvedPrimary.label,
                  href: resolvedPrimary.href,
                })
              }
            >
              <Button variant="primary" size="lg" pulse className="w-full sm:w-auto">
                {resolvedPrimary.label}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </MagneticButton>
          {resolvedSecondary && (
            <Link
              href={resolvedSecondary.href}
              onClick={() =>
                trackConversion("CTA Click", {
                  section: "Final CTA",
                  cta_text: resolvedSecondary.label,
                  href: resolvedSecondary.href,
                })
              }
            >
              <Button
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto border-gradient-animated"
              >
                {resolvedSecondary.label}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
