"use client";

import { useRef, lazy, Suspense } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-init";
import { prefersReducedMotion } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { trackConversion } from "@/lib/analytics";

const HeroCanvas = lazy(() => import("@/components/three/HeroCanvas"));

export function LeadMagnet() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(() => {
    if (!sectionRef.current) return;
    if (prefersReducedMotion()) return;

    const content = sectionRef.current.querySelector("[data-magnet-content]");

    if (content) {
      gsap.fromTo(content,
        { opacity: 0, scale: 0.92, y: 40 },
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.8,
          ease: "power2.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 75%",
            toggleActions: "play none none none",
          },
        }
      );
    }
  }, { scope: sectionRef });

  return (
    <section ref={sectionRef} className="py-24 px-4 sm:px-6 relative overflow-hidden bg-[var(--bg-base)]">
      {/* Interactive star field background — same as hero */}
      <Suspense fallback={null}>
        <HeroCanvas />
      </Suspense>

      <div
        data-magnet-content
        className="relative z-10 max-w-2xl mx-auto text-center"
      >
        <div className="flex items-center justify-center gap-2 mb-4 text-sm font-semibold text-[var(--gold-light)]">
          <BookOpen className="w-4 h-4" />
          Free Download
        </div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-[var(--white-primary)] mb-4">
          The AI Tools{" "}
          <span className="text-gold-gradient">Playbook</span>
        </h2>
        <p className="text-[var(--white-secondary)] mb-4 max-w-lg mx-auto">
          30+ tools. Real pricing. 4 stacks by business type. A 90-day roadmap
          to get started — whether you hire us or not.
        </p>
        <p className="text-sm text-[var(--white-muted)] italic mb-8">
          No fluff. No gate. Just the guide we wish existed when we started.
        </p>
        <Link
          href="/resources"
          onClick={() => trackConversion("CTA Click", { section: "Lead Magnet", cta_text: "Get the AI Playbook", href: "/resources" })}
        >
          <Button variant="primary" size="lg" className="group/cta">
            Get the AI Playbook
            <ArrowRight className="w-5 h-5 ml-2 transition-transform duration-200 group-hover/cta:translate-x-0.5" />
          </Button>
        </Link>
      </div>
    </section>
  );
}
