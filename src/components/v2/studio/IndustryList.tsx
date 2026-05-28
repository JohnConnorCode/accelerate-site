"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, Wrench, Scale, KeyRound, Briefcase, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { prefersReducedMotion } from "@/lib/utils";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { MaskReveal } from "./MaskReveal";
import { Eyebrow } from "./primitives";

type Item = { slug: string; name: string; outcome: string; icon: LucideIcon; img: string };

// `img` documents the real photo to AI-generate later for each industry; the card
// shows an on-brand placeholder (dark glass + accent) until those assets land.
const ITEMS: Item[] = [
  { slug: "home-services", name: "Home Services", outcome: "More booked jobs. Less downtime.", icon: Wrench, img: "On-site pro greeting a homeowner — branded van, warm daylight" },
  { slug: "law-firms", name: "Law Firms", outcome: "More signed cases. Faster intake.", icon: Scale, img: "Attorney at a clean modern desk, soft window light" },
  { slug: "real-estate", name: "Real Estate", outcome: "More closings. Less chasing.", icon: KeyRound, img: "Agent handing keys to a couple outside a sold home" },
  { slug: "professional-services", name: "Professional Services", outcome: "More clients. Predictable pipeline.", icon: Briefcase, img: "Consultant in a bright office meeting — laptop, notes" },
];

export function IndustryList() {
  const [active, setActive] = useState<number | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion() || !window.matchMedia("(pointer: fine)").matches) return;
    const pos = { x: -300, y: -300 };
    const cur = { ...pos };
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
    };
    const loop = () => {
      cur.x += (pos.x - cur.x) * 0.16;
      cur.y += (pos.y - cur.y) * 0.16;
      const el = previewRef.current;
      if (el) el.style.transform = `translate3d(${cur.x}px, ${cur.y}px, 0) translate(-50%, -50%)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    window.addEventListener("pointermove", onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  const ActiveIcon = active !== null ? ITEMS[active]!.icon : null;

  return (
    <section className="section-y section-divide relative">
      <div className="page-shell">
      <Eyebrow className="mb-6">industries</Eyebrow>
      <h2 className="display-2 max-w-4xl">
        <MaskReveal>
          Built for your industry —{" "}
          <span className="display-italic">not a template.</span>
        </MaskReveal>
      </h2>
      <p className="mt-5 max-w-xl text-lg text-white-muted">
        We work with small businesses of every kind. A few we know cold:
      </p>

      <div className="mt-12 border-t border-border-glass">
        {ITEMS.map((it, i) => {
          const isActive = active === i;
          const isDimmed = active !== null && !isActive;
          return (
          <AnimateOnScroll as="div" key={it.slug} delay={i * 0.06}>
            <Link
              href={`/industries/${it.slug}`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive((a) => (a === i ? null : a))}
              className={`group relative flex items-center justify-between gap-6 border-b border-border-glass py-6 transition-[opacity,transform,filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] sm:py-8 ${
                isDimmed ? "opacity-30 blur-[1px]" : "opacity-100 blur-0"
              } ${isActive ? "translate-x-2" : ""}`}
            >
              {/* left-edge accent stripe — scales in on hover */}
              <span
                aria-hidden
                className="pointer-events-none absolute left-0 top-1/2 h-12 w-[3px] origin-center -translate-y-1/2 scale-y-0 rounded-full bg-gold transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-y-100"
              />
              {/* subtle accent wash on hover */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{ background: "linear-gradient(90deg, rgba(var(--accent-rgb),0.07), transparent 45%)" }}
              />
              <span className="flex items-center gap-4 sm:gap-6">
                {/* mobile-only icon badge — mirrors the desktop hover preview's
                    glass+accent visual, so each row reads as its own card */}
                <span
                  aria-hidden
                  className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_72%,transparent)] text-gold lg:hidden"
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{ background: "radial-gradient(70% 70% at 50% 30%, rgba(var(--accent-rgb),0.22), transparent 70%)" }}
                  />
                  <it.icon className="relative h-5 w-5" strokeWidth={1.75} />
                </span>
                <span className="w-7 font-mono text-base font-semibold text-gold opacity-40 transition-opacity duration-300 group-hover:opacity-100 sm:w-8 sm:text-2xl">0{i + 1}</span>
                <span className="flex flex-col gap-1.5">
                  <span className="ink-sweep font-display text-3xl font-bold tracking-[-0.03em] text-white-secondary transition-all duration-300 group-hover:translate-x-2 group-hover:text-heading sm:text-6xl">
                    {it.name}
                  </span>
                  <span className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-white-muted sm:hidden">
                    {it.outcome}
                  </span>
                </span>
              </span>
              <span className="hidden items-center gap-4 sm:flex">
                <span className="font-mono text-xs uppercase tracking-[0.15em] text-white-muted">{it.outcome}</span>
                <ArrowUpRight className="h-6 w-6 text-gold opacity-0 transition-opacity group-hover:opacity-100" />
              </span>
            </Link>
          </AnimateOnScroll>
          );
        })}
        {/* examples, not limits */}
        <AnimateOnScroll as="div" delay={ITEMS.length * 0.06}>
          <Link
            href="/contact"
            className="group flex items-center justify-between gap-6 border-b border-border-glass py-6 sm:py-8"
          >
            <span className="flex items-center gap-5">
              <Plus className="h-6 w-6 text-gold" />
              <span className="font-display text-2xl font-medium tracking-[-0.02em] text-white-muted transition-colors group-hover:text-heading sm:text-3xl">
                Don&apos;t see yours? If you have customers, we can help.
              </span>
            </span>
            <ArrowUpRight className="h-6 w-6 shrink-0 text-gold opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        </AnimateOnScroll>
      </div>
      </div>

      {/* cursor-trailing animated preview (desktop) */}
      <div
        ref={previewRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[60] hidden lg:block"
        style={{ opacity: active !== null ? 1 : 0, transition: "opacity 0.25s ease" }}
      >
        <div className="relative h-[20rem] w-[19rem]">
          <AnimatePresence mode="popLayout">
            {active !== null && (
              <motion.div
                key={active}
                initial={{ scale: 0.92, y: 14, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.94, opacity: 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 26 }}
                className="absolute inset-0 overflow-hidden rounded-2xl border border-border-gold bg-[var(--bg-elevated)] shadow-2xl shadow-black/40"
              >
                {/* media zone — on-brand placeholder for the industry photo */}
                <div className="dot-grid relative flex h-[58%] items-center justify-center overflow-hidden border-b border-border-glass">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -inset-8"
                    style={{ background: "radial-gradient(58% 58% at 50% 38%, rgba(var(--accent-rgb),0.22), transparent 70%)" }}
                  />
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-20deg]"
                    style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)" }}
                    animate={{ x: ["0%", "420%"] }}
                    transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 0.5, ease: "easeInOut" }}
                  />
                  <span className="absolute right-3 top-3 font-mono text-[0.55rem] uppercase tracking-[0.2em] text-white-muted">
                    0{active + 1} / 0{ITEMS.length}
                  </span>
                  <motion.span
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                    className="relative grid h-16 w-16 place-items-center rounded-2xl border border-border-gold bg-[var(--glass-default-bg)] text-gold"
                  >
                    {ActiveIcon && <ActiveIcon className="h-8 w-8" strokeWidth={1.75} />}
                  </motion.span>
                  <span className="absolute inset-x-3 bottom-2 font-mono text-[0.52rem] uppercase leading-snug tracking-[0.12em] text-white-muted">
                    [ image: {ITEMS[active]!.img} ]
                  </span>
                </div>
                {/* footer */}
                <div className="flex h-[42%] flex-col justify-center gap-1.5 px-5">
                  <h3 className="font-display text-2xl font-extrabold leading-none tracking-[-0.02em] text-heading">
                    {ITEMS[active]!.name}
                  </h3>
                  <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-gold">{ITEMS[active]!.outcome}</p>
                  <p className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-heading">
                    See how it works <ArrowUpRight className="h-4 w-4 text-gold" />
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
