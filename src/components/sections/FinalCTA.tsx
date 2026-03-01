"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-init";
import { Button } from "@/components/ui/Button";

export function FinalCTA() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(() => {
    if (!sectionRef.current) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    // Parallax: background layers move at different speeds
    const meshBg = sectionRef.current.querySelector("[data-parallax-mesh]");
    const gridBg = sectionRef.current.querySelector("[data-parallax-grid]");
    const glowBg = sectionRef.current.querySelector("[data-parallax-glow]");

    if (meshBg) {
      gsap.fromTo(meshBg, { y: 60 }, {
        y: -60,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top bottom",
          end: "bottom top",
          scrub: 1,
        },
      });
    }

    if (gridBg) {
      gsap.fromTo(gridBg, { y: 30 }, {
        y: -30,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top bottom",
          end: "bottom top",
          scrub: 1,
        },
      });
    }

    if (glowBg) {
      gsap.fromTo(glowBg, { scale: 0.8, opacity: 0.3 }, {
        scale: 1.2,
        opacity: 0.7,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top bottom",
          end: "bottom top",
          scrub: 1,
        },
      });
    }

    // Content reveal
    const heading = sectionRef.current.querySelector("[data-cta-heading]");
    const desc = sectionRef.current.querySelector("[data-cta-desc]");
    const buttons = sectionRef.current.querySelector("[data-cta-buttons]");

    [heading, desc, buttons].forEach((el, i) => {
      if (!el) return;
      gsap.fromTo(el,
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
        }
      );
    });
  }, { scope: sectionRef });

  return (
    <section
      ref={sectionRef}
      className="py-36 relative overflow-hidden"
      style={{ backgroundColor: "var(--bg-base)" }}
    >
      {/* Top fade from Stats bg */}
      <div
        className="absolute top-0 left-0 right-0 h-24 pointer-events-none z-[1]"
        style={{ background: "linear-gradient(to bottom, var(--bg-base), transparent)" }}
      />

      {/* Atmospheric background layers */}
      <div className="absolute inset-0 pointer-events-none">
        <div data-parallax-mesh className="absolute inset-0 gradient-mesh opacity-25" />
        <div data-parallax-grid className="absolute inset-0 grid-overlay opacity-15" />
        <div
          data-parallax-glow
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full"
          style={{
            background: "radial-gradient(ellipse, rgba(212,175,55,0.08) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <h2
          data-cta-heading
          className="font-display text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight mb-6"
        >
          Ready to stop doing<br className="hidden sm:inline" /> it all yourself?
        </h2>
        <p data-cta-desc className="text-lg sm:text-xl text-[var(--white-muted)] max-w-xl mx-auto mb-10">
          30-minute strategy call. We&apos;ll show you exactly which systems would have the biggest impact on your revenue — and what they&apos;d cost.
        </p>
        <div data-cta-buttons className="flex flex-col sm:flex-row gap-5 justify-center">
          <Link href="/contact">
            <Button variant="primary" size="lg" className="w-full sm:w-auto">
              Book Your Free Consultation
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
          <Link href="/plan-builder">
            <Button variant="secondary" size="lg" className="w-full sm:w-auto border-gradient-animated">
              Get Your Growth Plan
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
