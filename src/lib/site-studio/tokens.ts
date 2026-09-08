import type { CSSProperties } from "react";
import type { SiteStyles } from "./document";

/** Token tables translate stored style tokens into presentation. Stored pages
 * never carry raw CSS or build-time class strings. */

const PADDING: Record<NonNullable<SiteStyles["paddingTop"]>, string> = {
  none: "0",
  sm: "1rem",
  md: "2.5rem",
  lg: "4rem",
  xl: "6rem",
};

const MAX_WIDTH: Record<NonNullable<SiteStyles["maxWidth"]>, string> = {
  narrow: "44rem",
  content: "72rem",
  wide: "88rem",
  full: "100%",
};

const GAP: Record<NonNullable<SiteStyles["gap"]>, string> = {
  sm: "0.75rem",
  md: "1.5rem",
  lg: "2.5rem",
};

const BACKGROUNDS: Record<
  NonNullable<SiteStyles["background"]>,
  { background: string; color: string }
> = {
  surface: { background: "var(--site-surface, #faf8f4)", color: "var(--site-ink, #1a1714)" },
  surfaceDark: {
    background: "var(--site-surface-dark, #1a1714)",
    color: "var(--site-paper, #faf8f4)",
  },
  accent: { background: "var(--site-accent, #b98a2f)", color: "var(--site-on-accent, #1a1714)" },
  transparent: { background: "transparent", color: "inherit" },
};

const TONES: Record<NonNullable<SiteStyles["tone"]>, string> = {
  default: "inherit",
  muted: "var(--site-muted, #6b6259)",
  inverse: "var(--site-paper, #faf8f4)",
};

export function resolveSectionStyle(styles?: SiteStyles): CSSProperties {
  const result: CSSProperties = {};
  if (!styles) return result;
  if (styles.background) {
    const background = BACKGROUNDS[styles.background];
    result.background = background.background;
    if (styles.tone === undefined) result.color = background.color;
  }
  if (styles.paddingTop) result.paddingTop = PADDING[styles.paddingTop];
  if (styles.paddingBottom) result.paddingBottom = PADDING[styles.paddingBottom];
  if (styles.tone) result.color = TONES[styles.tone];
  return result;
}

export function resolveContainerStyle(styles?: SiteStyles): CSSProperties {
  const result: CSSProperties = { width: "100%" };
  if (!styles) {
    result.maxWidth = MAX_WIDTH.content;
    result.margin = "0 auto";
    result.paddingLeft = "1.25rem";
    result.paddingRight = "1.25rem";
    return result;
  }
  result.maxWidth = styles.maxWidth ? MAX_WIDTH[styles.maxWidth] : MAX_WIDTH.content;
  result.margin = styles.maxWidth === "full" ? "0" : "0 auto";
  result.paddingLeft = "1.25rem";
  result.paddingRight = "1.25rem";
  if (styles.gap) result.display = "flex";
  if (styles.gap) result.flexDirection = "column";
  if (styles.gap) result.gap = GAP[styles.gap];
  return result;
}
