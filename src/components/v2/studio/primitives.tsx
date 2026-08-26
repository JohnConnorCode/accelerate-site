"use client";

import type { ReactNode, HTMLAttributes } from "react";
import Link from "next/link";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { WordMask, childrenToTokens } from "./RevealHeading";
import { trackConversion } from "@/lib/analytics";
import { useRv } from "@/components/home/reveal";

/* ──────────────────────────────────────────────────────────────────────────────
   Design-system primitives for /v2 sections.
   Single source of truth so every section is COMPOSED, not hand-rolled.
   Tokens (width tiers, vertical padding, motion, type scale) live in globals.css.
   ────────────────────────────────────────────────────────────────────────────── */

type Width = "wide" | "narrow" | "text";

function widthClass(w?: Width) {
  if (w === "narrow") return "page-shell page-shell--narrow";
  if (w === "text") return "page-shell page-shell--text";
  return "page-shell"; // default = wide
}

/* ─── useReveal ─── shared fail-open IntersectionObserver hook. The root
   motion bootstrap arms every reveal before paint; this hook owns the single
   visible-state transition after hydration. */
export function useReveal<T extends HTMLElement = HTMLElement>() {
  return useRv<T>();
}

/* ─── Container ─── shared content frame; same gutters everywhere, three caps */
export function Container({
  width = "wide",
  className,
  children,
  ...rest
}: { width?: Width; className?: string; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`${widthClass(width)} ${className ?? ""}`} {...rest}>
      {children}
    </div>
  );
}

/* ─── Section ─── full-bleed wrapper that owns vertical rhythm + (optionally)
   wraps its children in a Container.
   <Section> by default just provides section-y + a default Container around children.
   <Section bleed> opts OUT of the Container (caller controls full-bleed bands).

   Every Section is also a UNIVERSAL ENTRANCE: the shared observer flips its
   `in` class when the section enters the viewport, and a CSS
   rule in globals.css fades + lifts the eyebrow, heading, and direct content
   blocks in with a staggered cadence. Zero per-page animation code. */
export function Section({
  width = "wide",
  bleed = false,
  divide = false,
  className,
  children,
  ...rest
}: {
  width?: Width;
  /** If true, do NOT wrap children in a Container — caller controls layout
   *  (use for sections with full-bleed bands like Proof). */
  bleed?: boolean;
  /** If true, draw a subtle gradient hairline at the top of the section. */
  divide?: boolean;
  className?: string;
  children: ReactNode;
} & HTMLAttributes<HTMLElement>) {
  const ref = useReveal<HTMLElement>();
  const root = `section-y section-reveal relative ${divide ? "section-divide" : ""} ${className ?? ""}`;
  return (
    <section ref={ref} className={root} data-motion-role="section" {...rest}>
      {bleed ? children : <Container width={width}>{children}</Container>}
    </section>
  );
}

/* ─── Eyebrow ─── the "[ label ]" bracket marker. Single rendering path —
   numbered/rule variant was removed (added noise, signified nothing). */
export function Eyebrow({
  children,
  className,
}: { children: ReactNode; className?: string }) {
  return <p className={`eyebrow ${className ?? ""}`}>{children}</p>;
}

/* ─── Heading ─── display-scale headings (single source for type recipe).
   <Heading size="2">First line <span className="display-italic">accent</span></Heading>
*/
type HeadingSize = 1 | 2 | 3;
function sizeClass(s: HeadingSize) {
  // size 1 = page-hero scale (`.display-hero`), NOT the cinematic 10rem
  // `.display-1` (reserved for the homepage ClosingCTA used raw). This is the
  // single source of truth — never override a heading size with inline text-[…]
  // (a `.display-*` plain rule beats Tailwind utilities in v4 and the override
  // is silently ignored).
  return s === 1 ? "display-hero" : s === 3 ? "display-3" : "display-2";
}

export function Heading({
  size = 2,
  as,
  className,
  children,
}: {
  size?: HeadingSize;
  as?: "h1" | "h2" | "h3";
  className?: string;
  children: ReactNode;
}) {
  const Tag = (as ?? (size === 1 ? "h1" : "h2")) as "h1" | "h2" | "h3";
  const cls = `${sizeClass(size)} ${className ?? ""}`;
  // Hero headings (size 1) animate WORD BY WORD via the shared WordMask; section
  // headings (2/3) keep the lighter CSS section-reveal. Falls back to a plain
  // tag when children can't be tokenized (e.g. arbitrary nested markup).
  if (size === 1) {
    const tokens = childrenToTokens(children);
    if (tokens) return <WordMask tokens={tokens} as={Tag} className={cls} />;
  }
  return <Tag className={cls}>{children}</Tag>;
}

/* Inline italic accent: use `<span className="display-italic">…</span>` directly
   inside a Heading. (Compound subcomponents attached to a function — e.g.
   `Heading.Italic = …` — don't survive Next 16 / Turbopack prod builds, so the
   pattern was dropped. The `.display-italic` utility is the source of truth.) */

/* ─── BookCallButton ─── the standard primary CTA, identical everywhere on the
   site (shares the flat/square editorial `.btn` system with the homepage).
   Variants: "primary" (ink fill), "inverse" (paper fill — for ink-panel bands). */
export function BookCallButton({
  variant = "primary",
  label = "Book a free strategy session",
  className,
  location = "unknown",
}: {
  variant?: "primary" | "inverse";
  label?: string;
  className?: string;
  /** where this CTA lives (hero, closing, packages…) — attached to the
      conversion event so John can see which placement drives calls. */
  location?: string;
}) {
  const inverse = variant === "inverse";
  return (
    <MagneticButton className={className}>
      <Link
        href="/contact"
        data-cursor="link"
        data-cursor-label="Go"
        onClick={() => trackConversion("Strategy Call CTA Clicked", { location })}
        className={`btn ${inverse ? "btn-inv" : ""}`}
      >
        {label}
        <span className="arw" aria-hidden="true">→</span>
      </Link>
    </MagneticButton>
  );
}

/* ─── Stack ─── consistent vertical rhythm helper for "heading group + content".
   Replaces ad-hoc `mt-7 mb-12` chains with a token-driven gap. */
export function Stack({
  gap = "cozy",
  className,
  children,
}: {
  gap?: "tight" | "cozy" | "roomy";
  className?: string;
  children: ReactNode;
}) {
  const g = gap === "tight" ? "var(--stack-tight)" : gap === "roomy" ? "var(--stack-roomy)" : "var(--stack-cozy)";
  return (
    <div className={`flex flex-col ${className ?? ""}`} style={{ gap: g }}>
      {children}
    </div>
  );
}

/* ─── CallTerms ─── the four things true of every first call.

   This block was copy-pasted into eight files and rendered on eleven URLs plus
   every article page, so changing a term meant eight edits and there was no
   way to be sure they still agreed. One string now.

   "Direct to the founder" became "You talk to John": the first is a vibe, the
   second is checkable against the calendar you land on. */
export function CallTerms({ className }: { className?: string }) {
  const terms = ["Free", "30 min", "You keep the written plan", "You talk to John"];
  return (
    <div
      className={`flex flex-wrap gap-x-8 gap-y-3 border-t border-border-glass pt-6 font-mono text-xs uppercase tracking-[0.15em] text-white-muted ${className ?? ""}`}
    >
      {terms.map((t, i) => (
        <span key={t} className="contents">
          <span>{t}</span>
          {i < terms.length - 1 && <span aria-hidden="true">·</span>}
        </span>
      ))}
    </div>
  );
}
