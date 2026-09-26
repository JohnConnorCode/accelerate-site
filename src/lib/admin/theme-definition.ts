import { z } from "zod";
import presets from "./themes.json";

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex color");
/** Portable, bounded theme data. No CSS, HTML, URLs, selectors or executable code. */
export const adminThemeDefinitionSchema = z
  .object({
    version: z.literal(1),
    name: z.string().trim().min(1).max(60),
    description: z.string().trim().max(160),
    mode: z.enum(["light", "dark"]),
    font: z.enum(["sans", "editorial", "mono"]),
    palette: z
      .object({
        canvas: color,
        surface: color,
        ink: color,
        muted: color,
        accent: color,
        sidebar: color,
        sidebarInk: color,
      })
      .strict(),
    geometry: z
      .object({
        surfaceRadius: z.number().int().min(0).max(24),
        controlRadius: z.number().int().min(0).max(16),
        /** Large containers (dialogs, hero panels). Derived from the surface
         *  radius when omitted, so older themes keep their shape. */
        containerRadius: z.number().int().min(0).max(40).optional(),
      })
      .strict(),
    depth: z.enum(["flat", "soft", "elevated"]),
    /** Display type is separate from body type, so a heading can carry a
     *  distinct voice (for example serif titles over sans body). */
    displayFont: z.enum(["sans", "editorial", "mono"]).default("sans"),
    /** Buttons can be squared to the control radius or fully rounded. */
    buttonShape: z.enum(["rounded", "pill"]).default("rounded"),
    // Effects are enumerated on purpose: a theme stays portable data, never
    // raw CSS. Each option maps to bounded tokens in compileAdminTheme.
    density: z.enum(["comfortable", "compact"]).default("comfortable"),
    borders: z.enum(["none", "hairline", "solid"]).default("hairline"),
    shadow: z.enum(["none", "subtle", "bold"]).default("subtle"),
    motion: z.enum(["none", "calm", "smooth", "snappy", "expressive"]).default("smooth"),
    hover: z.enum(["none", "tint", "lift", "glow"]).default("tint"),
    labels: z.enum(["sentence", "uppercase"]).default("sentence"),
    navigation: z.enum(["plain", "pill", "outline"]).default("plain"),
    surface: z.enum(["solid", "tonal", "glass"]).default("solid"),
  })
  .strict();
export type AdminThemeDefinition = z.infer<typeof adminThemeDefinitionSchema>;

const DENSITY_TOKENS = {
  comfortable: { control: "44px", row: "16px", panel: "24px", gap: "24px" },
  compact: { control: "40px", row: "12px", panel: "20px", gap: "18px" },
} as const;
const BORDER_ALPHA = { none: 0, hairline: 9, solid: 18 } as const;
const MOTION_TOKENS = {
  none: { fast: "0ms", enter: "0ms", ease: "linear" },
  calm: { fast: "240ms", enter: "320ms", ease: "ease-in-out" },
  smooth: { fast: "180ms", enter: "280ms", ease: "cubic-bezier(0.2, 0, 0, 1)" },
  snappy: { fast: "120ms", enter: "200ms", ease: "cubic-bezier(0.2, 0, 0, 1)" },
  expressive: { fast: "260ms", enter: "420ms", ease: "cubic-bezier(0.2, 0, 0, 1)" },
} as const;

export function themeContrast(first: string, second: string) {
  const luminance = (hex: string) => {
    const rgb = [1, 3, 5]
      .map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
      .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
    return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
  };
  const a = luminance(first),
    b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
function blend(foreground: string, background: string, weight: number) {
  return (
    "#" +
    [1, 3, 5]
      .map((start) =>
        Math.round(
          parseInt(foreground.slice(start, start + 2), 16) * weight +
            parseInt(background.slice(start, start + 2), 16) * (1 - weight),
        )
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
function readableColor(preferred: string, ink: string, backgrounds: string[]) {
  for (let step = 0; step <= 20; step++) {
    const candidate = blend(ink, preferred, step / 20);
    if (backgrounds.every((background) => themeContrast(candidate, background) >= 4.5))
      return candidate;
  }
  return ink;
}
export function validateAdminTheme(raw: unknown): AdminThemeDefinition {
  const theme = adminThemeDefinitionSchema.parse(raw);
  const p = theme.palette;
  for (const [text, background] of [
    ["ink", "canvas"],
    ["ink", "surface"],
    ["muted", "canvas"],
    ["muted", "surface"],
    ["sidebarInk", "sidebar"],
  ] as const) {
    if (themeContrast(p[text], p[background]) < 4.5)
      throw new Error(`${text} needs at least 4.5:1 contrast against ${background}.`);
  }
  const darkCanvas = themeContrast(p.canvas, "#ffffff") > themeContrast(p.canvas, "#000000");
  if (darkCanvas !== (theme.mode === "dark"))
    throw new Error("Choose a mode that matches the canvas brightness.");
  if (theme.geometry.controlRadius > theme.geometry.surfaceRadius)
    throw new Error("Control corners must fit within surface corners.");
  return theme;
}
/** Decorative select chevron tinted with the theme's muted ink, so native
 *  dropdowns keep one coordinated affordance in every preset and in custom
 *  themes compiled through this module. */
function selectChevron(color: string) {
  const stroke = color.startsWith("#") ? `%23${color.slice(1)}` : encodeURIComponent(color);
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='${stroke}' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`;
}
function opaquePresetColor(value: string, canvas: string) {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  const parts = value
    .match(/^rgba?\(([\d.,\s]+)\)$/)?.[1]
    ?.split(",")
    .map(Number);
  if (!parts || parts.length < 3 || parts.some((v) => !Number.isFinite(v)))
    throw new Error("Preset palette colors must be hex or RGB colors.");
  const hex =
    "#" +
    parts
      .slice(0, 3)
      .map((v) => Math.round(v).toString(16).padStart(2, "0"))
      .join("");
  return blend(hex, canvas, parts[3] ?? 1);
}
export function themeFromPreset(id: string): AdminThemeDefinition {
  const preset = presets.find((t) => t.id === id) ?? presets[0]!;
  const tokens = preset.tokens as Record<string, string>;
  return {
    version: 1,
    name: `${preset.label} custom`,
    description: preset.description,
    mode: preset.mode as "light" | "dark",
    font: tokens["--admin-font"]?.includes("font-editorial")
      ? "editorial"
      : tokens["--admin-font"]?.includes("font-mono-face")
        ? "mono"
        : "sans",
    // Portable typography stays coherent: a "start from" theme keeps title
    // and body on the same family; a user can separate them in the editor.
    displayFont: tokens["--admin-font"]?.includes("font-editorial")
      ? "editorial"
      : tokens["--admin-font"]?.includes("font-mono-face")
        ? "mono"
        : "sans",
    buttonShape: tokens["--admin-radius-button"]?.includes("999") ? "pill" : "rounded",
    depth: id === "dark" ? "flat" : "soft",
    shadow: "subtle",
    hover: "tint",
    surface: "solid",
    // Carry the preset's own structural choices so "start from" keeps the
    // character the user picked. Surface material stays portable (solid):
    // a stored custom theme must not inherit a preset's glass or tint.
    density: parseInt(tokens["--admin-control-height"]!) <= 40 ? "compact" : "comfortable",
    borders: tokens["--admin-border-width"] === "0px" ? "none" : "hairline",
    labels: tokens["--admin-label-transform"] === "uppercase" ? "uppercase" : "sentence",
    navigation: tokens["--admin-nav-radius"]?.includes("999") ? "pill" : "plain",
    motion:
      parseInt(tokens["--admin-skin-motion-enter"]!) <= 0
        ? "none"
        : tokens["--admin-skin-motion-ease"]?.includes("ease-in-out")
          ? "calm"
          : parseInt(tokens["--admin-skin-motion-enter"]!) >= 400
            ? "expressive"
            : parseInt(tokens["--admin-skin-motion-enter"]!) <= 220
              ? "snappy"
              : "smooth",
    palette: {
      canvas: tokens["--admin-canvas"]!,
      surface: tokens["--admin-surface"]!,
      ink: tokens["--admin-ink"]!,
      muted: tokens["--admin-muted"]!,
      accent: tokens["--admin-accent"]!,
      sidebar: opaquePresetColor(tokens["--admin-sidebar"]!, tokens["--admin-canvas"]!),
      sidebarInk: tokens["--admin-nav-ink"]!,
    },
    geometry: {
      surfaceRadius: parseInt(tokens["--admin-surface-radius"]!),
      controlRadius: parseInt(tokens["--admin-control-radius"]!),
      containerRadius: parseInt(tokens["--admin-radius-container"]!),
    },
  };
}

/** All component tokens resolve centrally from seven colors and a bounded
 *  set of structural choices (geometry, depth, borders, shadow strength,
 *  density, motion, hover, labels, navigation, surface material). */
export function compileAdminTheme(raw: unknown): Record<string, string> {
  const t = validateAdminTheme(raw),
    p = t.palette;
  const mix = (color: string, percent: number, background = "transparent") =>
    `color-mix(in srgb, ${color} ${percent}%, ${background})`;
  const actionInk = themeContrast(p.accent, "#ffffff") >= 4.5 ? "#ffffff" : "#000000";
  const backgrounds = [
    p.canvas,
    p.surface,
    blend(p.ink, p.surface, 0.03),
    blend(p.accent, p.surface, 0.1),
  ];
  const readable = (color: string) => readableColor(color, p.ink, backgrounds);

  const borderless = t.borders === "none";
  const border = borderless ? "transparent" : mix(p.ink, BORDER_ALPHA[t.borders]);

  const strength = t.shadow === "bold" ? 1.8 : 1;
  const raised = t.depth !== "flat" && t.shadow !== "none";
  const shadow = raised
    ? `0 0 0 1px ${borderless ? "transparent" : mix(p.ink, 6)}, 0 2px 4px -2px ${mix(p.ink, Math.round(8 * strength))}, 0 ${Math.round((t.depth === "elevated" ? 20 : 12) * strength)}px ${Math.round(32 * strength)}px -${Math.round(24 * strength)}px ${mix(p.ink, Math.min(60, Math.round(28 * strength)))}`
    : "none";
  const cardFlatShadow = raised && !borderless ? `0 0 0 1px ${mix(p.ink, 7)}` : "none";
  const cardOutlineShadow = borderless ? "none" : `0 0 0 1px ${mix(p.ink, 14)}`;
  const shadowBorder = borderless ? "none" : `0 0 0 1px ${border}`;
  const shadowBorderHover = borderless ? "none" : `0 0 0 1px ${mix(p.ink, 18)}`;
  const shadowHover = raised ? `${shadow}, 0 6px 18px -12px ${mix(p.ink, 18)}` : "none";

  const surfaceFill =
    t.surface === "solid"
      ? "var(--admin-surface)"
      : t.surface === "tonal"
        ? mix(p.accent, 12, p.surface)
        : mix(p.surface, 78, "transparent");
  const surfaceFilter = t.surface === "glass" ? "blur(18px) saturate(1.12)" : "none";
  const fieldFill =
    t.surface === "solid"
      ? "var(--admin-surface-subtle)"
      : t.surface === "tonal"
        ? mix(p.accent, 8, p.surface)
        : mix(p.surface, 70, "transparent");

  const nav =
    t.navigation === "pill"
      ? {
          radius: "999px",
          activeBg: mix(p.accent, 16),
          activeInk: readable(p.accent),
          activeShadow: "none",
          hover: mix(p.accent, 8),
        }
      : t.navigation === "outline"
        ? {
            radius: "var(--admin-control-radius)",
            activeBg: "transparent",
            activeInk: readable(p.accent),
            activeShadow: `inset 0 0 0 1px ${mix(p.accent, 45)}`,
            hover: mix(p.ink, 5),
          }
        : {
            radius: "var(--admin-control-radius)",
            activeBg: p.accent,
            activeInk: actionInk,
            activeShadow: "none",
            hover: mix(p.sidebarInk, 8),
          };

  const hover =
    t.hover === "none"
      ? { lift: "none", tint: "transparent", glow: "0 0 0 0 transparent" }
      : t.hover === "lift"
        ? { lift: "translateY(-2px)", tint: mix(p.ink, 3), glow: "0 0 0 0 transparent" }
        : t.hover === "glow"
          ? { lift: "none", tint: mix(p.accent, 8), glow: `0 0 0 3px ${mix(p.accent, 25)}` }
          : { lift: "none", tint: mix(p.ink, 4), glow: "none" };

  const density = DENSITY_TOKENS[t.density];
  const motion = MOTION_TOKENS[t.motion];
  const uppercaseLabels = t.labels === "uppercase";
  const titleFont =
    t.displayFont === t.font
      ? "var(--admin-font)"
      : t.displayFont === "editorial"
        ? "var(--font-editorial), Georgia, serif"
        : t.displayFont === "mono"
          ? "var(--font-mono-face), ui-monospace, monospace"
          : "var(--font-inter), system-ui, sans-serif";
  const containerRadius =
    t.geometry.containerRadius ?? Math.min(32, Math.round(t.geometry.surfaceRadius * 1.5));
  const buttonRadius = t.buttonShape === "pill" ? "999px" : "var(--admin-control-radius)";

  const danger = readable(t.mode === "dark" ? "#fda4af" : "#be123c");
  const success = readable(t.mode === "dark" ? "#6ee7b7" : "#047857");
  const warning = readable(t.mode === "dark" ? "#fcd34d" : "#92400e");
  return {
    "--admin-title-font": titleFont,
    "--admin-title-weight": "650",
    "--admin-title-tracking": "-0.035em",
    "--admin-label-font": "var(--admin-font)",
    "--admin-surface-fill": surfaceFill,
    "--admin-surface-filter": surfaceFilter,
    "--admin-nav-filter": "none",
    "--admin-nav-shadow": "inset -1px 0 0 var(--admin-nav-rule)",
    "--admin-nav-radius": nav.radius,
    "--admin-nav-active-shadow": nav.activeShadow,
    "--admin-field-fill": fieldFill,
    "--admin-control-shadow": "0 1px 2px color-mix(in srgb, var(--admin-ink) 14%, transparent)",
    "--admin-dock-fill": "var(--admin-sidebar)",
    "--admin-hover-lift": hover.lift,
    "--admin-hover-tint": hover.tint,
    "--admin-hover-glow": hover.glow,
    "--admin-skin-motion-fast": motion.fast,
    "--admin-skin-motion-enter": motion.enter,
    "--admin-skin-motion-ease": motion.ease,
    "--admin-canvas": p.canvas,
    "--admin-surface": p.surface,
    "--admin-surface-subtle": mix(p.ink, 3, p.surface),
    "--admin-soft": "var(--admin-surface-subtle)",
    "--admin-line": border,
    "--admin-ink": p.ink,
    "--admin-muted": readable(p.muted),
    "--admin-select-chevron": selectChevron(readable(p.muted)),
    "--admin-accent": readable(p.accent),
    "--admin-accent-soft": mix(p.accent, 10),
    "--admin-sidebar": p.sidebar,
    "--admin-nav-ink": p.sidebarInk,
    "--admin-nav-muted": readableColor(blend(p.sidebarInk, p.sidebar, 0.76), p.sidebarInk, [
      p.sidebar,
    ]),
    "--admin-nav-faint": readableColor(blend(p.sidebarInk, p.sidebar, 0.66), p.sidebarInk, [
      p.sidebar,
    ]),
    "--admin-nav-hover": nav.hover,
    "--admin-nav-rule": mix(p.sidebarInk, 12),
    "--admin-nav-active-bg": nav.activeBg,
    "--admin-nav-active-ink": nav.activeInk,
    "--admin-nav-brand-color": p.sidebarInk,
    "--admin-nav-accent": p.sidebarInk,
    "--admin-nav-badge-ring": p.sidebar,
    "--admin-canvas-art":
      t.surface === "tonal" || t.depth === "elevated"
        ? `radial-gradient(circle at 85% 0%, ${mix(p.accent, 8)}, transparent 34rem)`
        : "none",
    "--admin-action": p.accent,
    "--admin-action-ink": actionInk,
    "--admin-surface-radius": `${t.geometry.surfaceRadius}px`,
    "--admin-control-radius": `${t.geometry.controlRadius}px`,
    "--admin-radius-surface": `${t.geometry.surfaceRadius}px`,
    "--admin-radius-control": `${t.geometry.controlRadius}px`,
    "--admin-radius-container": `${containerRadius}px`,
    "--admin-radius-button": buttonRadius,
    "--admin-radius-pill": "999px",
    "--admin-border-width": borderless ? "0px" : "1px",
    "--admin-hairline-width": "1px",
    "--admin-hairline": mix(p.ink, borderless ? 12 : 10),
    "--admin-label-transform": uppercaseLabels ? "uppercase" : "none",
    "--admin-label-tracking": uppercaseLabels ? "0.06em" : "0em",
    "--admin-control-height": density.control,
    "--admin-row-padding": density.row,
    "--admin-panel-padding": density.panel,
    "--admin-section-gap": density.gap,
    "--admin-rule": mix(p.ink, 7),
    "--admin-border": border,
    "--admin-shadow-border": shadowBorder,
    "--admin-shadow-border-hover": shadowBorderHover,
    "--admin-shadow": shadow,
    "--admin-shadow-hover": shadowHover,
    "--admin-card-flat-shadow": cardFlatShadow,
    "--admin-card-raised-shadow": shadow,
    "--admin-card-outline-shadow": cardOutlineShadow,
    "--admin-danger": danger,
    "--admin-danger-soft": mix(danger, 10),
    "--admin-success": success,
    "--admin-success-soft": mix(success, 10),
    "--admin-warning": warning,
    "--admin-warning-soft": mix(warning, 10),
    "--admin-font":
      t.font === "editorial"
        ? "var(--font-editorial), Georgia, serif"
        : t.font === "mono"
          ? "var(--font-mono-face), ui-monospace, monospace"
          : "var(--font-inter), system-ui, sans-serif",
    "color-scheme": t.mode,
  };
}
export function themeDeclarations(theme: AdminThemeDefinition) {
  return Object.entries(compileAdminTheme(theme))
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
}
