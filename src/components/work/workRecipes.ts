import type { WorkProject } from "@/content/work";

export const workAccentClasses: Record<WorkProject["accent"], string> = {
  ink: "[--case-accent:#171717] [--case-accent-ink:#fff] [--case-surface:color-mix(in_srgb,#171717_5%,var(--bg))]",
  red: "[--case-accent:#c94738] [--case-accent-ink:#fff] [--case-surface:color-mix(in_srgb,#c94738_7%,var(--bg))]",
  blue: "[--case-accent:#246ca8] [--case-accent-ink:#fff] [--case-surface:color-mix(in_srgb,#246ca8_7%,var(--bg))]",
  green:
    "[--case-accent:#347249] [--case-accent-ink:#fff] [--case-surface:color-mix(in_srgb,#347249_8%,var(--bg))]",
  violet:
    "[--case-accent:#7045b8] [--case-accent-ink:#fff] [--case-surface:color-mix(in_srgb,#7045b8_8%,var(--bg))]",
  gold: "[--case-accent:#b27a1d] [--case-accent-ink:#111] [--case-surface:color-mix(in_srgb,#b27a1d_8%,var(--bg))]",
  slate:
    "[--case-accent:#52606d] [--case-accent-ink:#fff] [--case-surface:color-mix(in_srgb,#52606d_7%,var(--bg))]",
};

export const workWorldClasses: Record<WorkProject["artDirection"]["world"], string> = {
  workshop: "[--case-grid:3rem]",
  stage: "[--case-grid:5rem]",
  clinical: "[--case-grid:2.5rem]",
  archive: "[--case-grid:4rem]",
  brief: "[--case-grid:3.5rem]",
  field: "[--case-grid:3rem]",
  enterprise: "[--case-grid:4rem]",
};

export const heroAspectByArtDirection: Record<
  WorkProject["artDirection"]["hero"],
  "wide" | "portrait" | "cinematic" | "square"
> = {
  wide: "cinematic",
  portrait: "portrait",
  system: "wide",
  window: "wide",
  document: "wide",
};
