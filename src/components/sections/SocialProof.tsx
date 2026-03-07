"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Star, ChevronLeft, ChevronRight, MoveRight } from "lucide-react";
import { motion, useMotionValue, animate, type PanInfo } from "framer-motion";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-init";
import { prefersReducedMotion } from "@/lib/utils";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { testimonials } from "@/content/testimonials";

const CARD_GAP = 24;

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("");
}

function getCardWidth() {
  if (typeof window === "undefined") return 360;
  if (window.innerWidth < 640) return 280;
  if (window.innerWidth < 1024) return 300;
  return 360;
}

function getVisibleCount() {
  if (typeof window === "undefined") return 3;
  if (window.innerWidth < 768) return 1;
  if (window.innerWidth < 1280) return 2;
  return 3;
}

function TestimonialCard({
  quote,
  name,
  title,
  businessType,
  rating,
}: {
  quote: string;
  name: string;
  title: string;
  businessType: string;
  rating: number;
}) {
  return (
    <div className="glass rounded-xl p-6 w-[280px] sm:w-[300px] lg:w-[360px] shrink-0 flex flex-col min-h-[240px] select-none">
      {/* Stars */}
      <div className="flex gap-1 mb-4">
        {Array.from({ length: rating }).map((_, i) => (
          <Star
            key={i}
            className="w-[18px] h-[18px] fill-[var(--gold-base)] text-[var(--gold-base)] drop-shadow-[0_0_3px_rgba(212,175,55,0.4)]"
            aria-hidden="true"
          />
        ))}
      </div>

      {/* Quote */}
      <blockquote className="text-[var(--white-secondary)] leading-relaxed mb-6 flex-1 text-sm">
        &ldquo;{quote}&rdquo;
      </blockquote>

      {/* Attribution */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[rgba(var(--accent-rgb),0.1)] border border-[rgba(var(--accent-rgb),0.2)] flex items-center justify-center text-xs font-semibold text-[var(--gold-light)]">
          {getInitials(name)}
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--white-primary)]">{name}</p>
          <p className="text-xs text-[var(--white-muted)]">
            {title}, {businessType}
          </p>
        </div>
      </div>
    </div>
  );
}

const featured = testimonials[0];
const carouselItems = testimonials.slice(1);

export function SocialProof() {
  const pullQuoteRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [maxSnap, setMaxSnap] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);
  const x = useMotionValue(0);

  useEffect(() => {
    const update = () => {
      const visible = getVisibleCount();
      setMaxSnap(Math.max(0, carouselItems.length - visible));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const snapTo = useCallback(
    (index: number) => {
      setHasInteracted(true);
      const step = getCardWidth() + CARD_GAP;
      const visible = getVisibleCount();
      const limit = Math.max(0, testimonials.length - 1 - visible);
      const clamped = Math.max(0, Math.min(index, limit));
      setActiveIndex(clamped);
      animate(x, -clamped * step, {
        type: "spring",
        stiffness: 300,
        damping: 30,
      });
    },
    [x]
  );

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const step = getCardWidth() + CARD_GAP;
      const offset = info.offset.x;
      const velocity = info.velocity.x;

      let newIndex = activeIndex;
      if (offset < -step / 4 || velocity < -500) newIndex++;
      else if (offset > step / 4 || velocity > 500) newIndex--;

      snapTo(newIndex);
    },
    [activeIndex, snapTo]
  );

  useGSAP(() => {
    if (prefersReducedMotion()) return;

    if (pullQuoteRef.current) {
      gsap.fromTo(
        pullQuoteRef.current,
        { clipPath: "inset(100% 0 0 0)", opacity: 0 },
        {
          clipPath: "inset(0% 0 0 0)",
          opacity: 1,
          delay: 0.2,
          duration: 0.8,
          ease: "power2.out",
          scrollTrigger: {
            trigger: pullQuoteRef.current,
            start: "top 80%",
            toggleActions: "play none none none",
          },
        }
      );
    }
  });

  const dragConstraintLeft = (() => {
    const step = getCardWidth() + CARD_GAP;
    const visible = getVisibleCount();
    const limit = Math.max(0, carouselItems.length - visible);
    return -limit * step;
  })();

  const pageCount = maxSnap + 1;

  return (
    <section className="relative py-24 bg-[var(--bg-elevated)] overflow-hidden">
      <div className="absolute inset-0 grid-overlay-fine pointer-events-none opacity-50" />
      <div className="ambient-glow-center" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal animation="blur-up">
          <SectionHeader
            heading={<>Don&apos;t Take <span className="text-gold-gradient font-editorial">Our Word</span> for It</>}
            size="large"
            className="mb-12"
          />
        </ScrollReveal>

        {/* Featured pull-quote */}
        {featured && (
          <div ref={pullQuoteRef} className="mb-16">
            <div className="glass-gold rounded-2xl p-6 sm:p-8 md:p-12 max-w-4xl mx-auto relative">
              <span
                className="absolute top-4 left-6 sm:top-6 sm:left-8 font-display text-[8rem] leading-none text-[rgba(var(--accent-rgb),0.08)] select-none pointer-events-none"
                aria-hidden="true"
              >
                &ldquo;
              </span>
              <blockquote className="relative z-10 font-display text-xl sm:text-2xl md:text-3xl font-light italic text-[var(--white-primary)] leading-snug mb-6 sm:mb-8">
                {featured.quote}
              </blockquote>
              <div className="relative z-10 flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[rgba(var(--accent-rgb),0.1)] border border-[rgba(var(--accent-rgb),0.2)] flex items-center justify-center text-sm font-semibold text-[var(--gold-light)]">
                  {getInitials(featured.name)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--white-primary)]">
                    {featured.name}
                  </p>
                  <p className="text-xs text-[var(--white-muted)]">
                    {featured.title}, {featured.businessType}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Accessible summary for screen readers */}
      <div className="sr-only" role="region" aria-label="Client testimonials">
        <h3>What our clients say</h3>
        <ul>
          {testimonials.map((t) => (
            <li key={t.id}>
              &ldquo;{t.quote}&rdquo; — {t.name}, {t.title} at {t.businessType}
            </li>
          ))}
        </ul>
      </div>

      {/* Swipeable carousel */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Edge fades */}
        <div className="absolute left-0 top-0 bottom-0 w-8 sm:w-16 md:w-24 bg-gradient-to-r from-[var(--bg-elevated)] to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-8 sm:w-16 md:w-24 bg-gradient-to-l from-[var(--bg-elevated)] to-transparent z-10 pointer-events-none" />

        <div className="overflow-hidden" ref={trackRef}>
          <motion.div
            className="flex gap-6 cursor-grab active:cursor-grabbing"
            style={{ x }}
            drag="x"
            dragConstraints={{ left: dragConstraintLeft, right: 0 }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
          >
            {testimonials.slice(1).map((t) => (
              <TestimonialCard
                key={t.id}
                quote={t.quote}
                name={t.name}
                title={t.title}
                businessType={t.businessType}
                rating={t.rating}
              />
            ))}
          </motion.div>
        </div>

        {/* Mobile swipe hint */}
        {!hasInteracted && (
          <div className="flex md:hidden items-center justify-center gap-2 mt-4 text-xs text-[var(--white-muted)] motion-safe:animate-pulse">
            <span>Swipe for more</span>
            <MoveRight className="w-3.5 h-3.5" />
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            onClick={() => snapTo(activeIndex - 1)}
            disabled={activeIndex === 0}
            className="hidden md:flex items-center justify-center w-9 h-9 rounded-full border border-[var(--border-glass)] bg-[var(--glass-default-bg)] text-[var(--white-muted)] hover:text-[var(--white-primary)] hover:border-[var(--border-glass-hover)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            aria-label="Previous testimonials"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex gap-2">
            {Array.from({ length: pageCount }).map((_, i) => (
              <button
                key={i}
                onClick={() => snapTo(i)}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                  i === activeIndex
                    ? "bg-[var(--gold-base)] scale-110"
                    : "bg-[var(--white-muted)] opacity-40 hover:opacity-70"
                }`}
                aria-label={`Go to testimonial group ${i + 1}`}
              />
            ))}
          </div>

          <button
            onClick={() => snapTo(activeIndex + 1)}
            disabled={activeIndex >= maxSnap}
            className="hidden md:flex items-center justify-center w-9 h-9 rounded-full border border-[var(--border-glass)] bg-[var(--glass-default-bg)] text-[var(--white-muted)] hover:text-[var(--white-primary)] hover:border-[var(--border-glass-hover)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            aria-label="Next testimonials"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
