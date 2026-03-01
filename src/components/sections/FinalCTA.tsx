"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";

export function FinalCTA() {
  return (
    <section className="py-24 bg-[var(--bg-base)] relative overflow-hidden">
      {/* Background orb */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-radial from-[rgba(212,175,55,0.06)] to-transparent" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <AnimateOnScroll>
          <GlassCard variant="gold" padding="none" className="text-center">
            <div className="p-10 sm:p-14">
              <h2
                className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4"
                style={{ fontFamily: "var(--font-space-grotesk), var(--font-inter), sans-serif" }}
              >
                Ready to Stop Losing Leads?
              </h2>
              <p className="text-lg text-white/65 max-w-xl mx-auto mb-8">
                Book a free consultation and see exactly how Accelerate can grow
                your business. No commitment, no pressure, just a clear plan.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/contact">
                  <Button variant="primary" size="lg" className="w-full sm:w-auto">
                    Book Your Free Consultation
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Link href="/#solution-generator">
                  <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                    Get Your Growth Plan
                  </Button>
                </Link>
              </div>
            </div>
          </GlassCard>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
