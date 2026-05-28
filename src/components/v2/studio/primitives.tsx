import type { ReactNode, HTMLAttributes } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { MagneticButton } from "@/components/ui/MagneticButton";

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
   <Section bleed> opts OUT of the Container (caller controls full-bleed bands). */
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
  const root = `section-y relative ${divide ? "section-divide" : ""} ${className ?? ""}`;
  return (
    <section className={root} {...rest}>
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
  return <p className={`eyebrow ${className ?? ""}`}>[ {children} ]</p>;
}

/* ─── Heading ─── display-scale headings (single source for type recipe).
   <Heading size="2">First line <Heading.Italic>accent</Heading.Italic></Heading>
*/
type HeadingSize = 1 | 2 | 3;
function sizeClass(s: HeadingSize) {
  return s === 1 ? "display-1" : s === 3 ? "display-3" : "display-2";
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
  return <Tag className={`${sizeClass(size)} ${className ?? ""}`}>{children}</Tag>;
}

/* Inline italic accent ("the gold part of a heading"). */
Heading.Italic = function HeadingItalic({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={`display-italic ${className ?? ""}`}>{children}</span>;
};

/* ─── BookCallButton ─── the standard primary CTA, identical across Hero/Model/Close.
   Variants: "primary" (gold on dark), "inverse" (dark on gold — for the lime band). */
export function BookCallButton({
  variant = "primary",
  label = "Book a Free Discovery Call",
  className,
}: {
  variant?: "primary" | "inverse";
  label?: string;
  className?: string;
}) {
  const inverse = variant === "inverse";
  return (
    <MagneticButton className={className}>
      <Link
        href="/contact"
        data-cursor="link"
        data-cursor-label="Go"
        className={
          "group inline-flex items-center gap-2.5 self-start rounded-full px-7 py-3.5 text-sm font-semibold " +
          (inverse ? "bg-btn-text text-gold" : "bg-gold text-btn-text")
        }
      >
        {label}
        <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
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
