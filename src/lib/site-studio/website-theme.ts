import type { CSSProperties } from "react";
import type { WebsiteDocument } from "./website-document";

/** Public and private previews share the exact same token mapping. */
export function websiteThemeStyle(theme: WebsiteDocument["theme"]): CSSProperties {
  return {
    "--bg": theme.background,
    "--fg": theme.foreground,
    "--paper": theme.background,
    "--ink": theme.foreground,
    "--accent": theme.accent,
    "--site-surface": theme.background,
    "--site-paper": theme.background,
    "--site-ink": theme.foreground,
    "--site-surface-dark": theme.foreground,
    "--site-accent": theme.accent,
    "--site-on-accent": theme.foreground,
    "--site-radius": { square: "0", soft: "0.75rem", round: "2rem" }[theme.radius],
    background: theme.background,
    color: theme.foreground,
    ...(theme.font === "installation"
      ? {}
      : {
          fontFamily: { sans: "Arial, sans-serif", serif: "Georgia, serif", mono: "monospace" }[
            theme.font
          ],
        }),
  } as CSSProperties;
}
