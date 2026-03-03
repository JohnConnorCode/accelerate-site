"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-init";
import { prefersReducedMotion } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { MagneticButton } from "@/components/ui/MagneticButton";

export function FinalCTA() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(() => {
    if (!sectionRef.current) return;
    if (prefersReducedMotion()) return;

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
      className="py-24 sm:py-32 md:py-40 relative overflow-hidden bg-[var(--bg-base)]"
    >
      {/* Atmospheric background layers */}
      <div className="absolute inset-0 pointer-events-none">
        <div data-parallax-mesh className="absolute inset-0 gradient-mesh opacity-25" />
        <div data-parallax-grid className="absolute inset-0 grid-overlay opacity-15" />
        <div
          data-parallax-glow
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(700px,95vw)] h-[400px] rounded-full"
          style={{
            background: "radial-gradient(ellipse, rgba(var(--accent-rgb),0.08) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <h2
          data-cta-heading
          className="page-heading mb-6"
        >
          Let&apos;s Talk About{" "}
          <span className="text-gold-gradient">Your Business</span>
        </h2>
        <p data-cta-desc className="text-lg sm:text-xl text-[var(--white-muted)] max-w-xl mx-auto mb-10">
          Free discovery call. 30 minutes. You walk away with a clear plan — whether you work with us or not.
        </p>
        <div data-cta-buttons className="flex flex-col sm:flex-row gap-3 sm:gap-5 justify-center">
          <MagneticButton>
            <Link href="/contact">
              <Button variant="primary" size="lg" pulse className="w-full sm:w-auto">
                Book a Free Discovery Call
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </MagneticButton>
          <Link href="/resources">
            <Button variant="secondary" size="lg" className="w-full sm:w-auto border-gradient-animated">
              Get the AI Playbook
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
