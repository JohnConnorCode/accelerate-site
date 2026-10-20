/**
 * Shared type-scale recipes for headings driven by RevealHeading (word-stagger
 * entrance). These are plain Tailwind utility strings — NOT the `.display-*`
 * classes, which are owned by the CSS section-reveal system and would
 * double-animate. Using one constant keeps every page hero identical.
 *
 * Both map onto the shared --type-* heading scale in globals.css.
 */
export const HERO_HEADING =
  "font-display font-semibold leading-[1.04] tracking-[-0.035em] text-[length:var(--type-display)] text-heading";

/** Section-level heading (h2) — smaller than the hero, for in-page sections. */
export const SECTION_HEADING =
  "font-display font-semibold leading-[1.08] tracking-[-0.03em] text-[length:var(--type-section)] text-heading";
