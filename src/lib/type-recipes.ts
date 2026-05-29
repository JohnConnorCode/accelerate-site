/**
 * Shared type-scale recipes for headings driven by RevealHeading (word-stagger
 * entrance). These are plain Tailwind utility strings — NOT the `.display-*`
 * classes, which are owned by the CSS section-reveal system and would
 * double-animate. Using one constant keeps every page hero identical.
 *
 * HERO_HEADING matches the homepage hero (the flagship reference): ~66px on
 * desktop, capped at 4.75rem on very wide screens.
 */
export const HERO_HEADING =
  "font-display font-extrabold leading-[1.02] tracking-[-0.035em] text-[clamp(2.4rem,4.6vw,4.75rem)] text-heading";

/** Section-level heading (h2) — smaller than the hero, for in-page sections. */
export const SECTION_HEADING =
  "font-display font-bold leading-[1.06] tracking-[-0.03em] text-[clamp(1.9rem,3.4vw,3rem)] text-heading";
