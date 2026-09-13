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
      })
      .strict(),
    depth: z.enum(["flat", "soft", "elevated"]),
  })
  .strict();
export type AdminThemeDefinition = z.infer<typeof adminThemeDefinitionSchema>;

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
    depth: id === "dark" ? "flat" : "soft",
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
    },
  };
}

/** All component tokens resolve centrally from seven colors and three style choices. */
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
  const border = mix(p.ink, t.depth === "flat" ? 14 : 9);
  const shadow =
    t.depth === "flat"
      ? `0 0 0 1px ${border}`
      : `0 0 0 1px ${mix(p.ink, 6)}, 0 2px 4px -2px ${mix(p.ink, 8)}, 0 ${t.depth === "elevated" ? 20 : 12}px 32px -24px ${mix(p.ink, 28)}`;
  const danger = readable(t.mode === "dark" ? "#fda4af" : "#be123c");
  const success = readable(t.mode === "dark" ? "#6ee7b7" : "#047857");
  const warning = readable(t.mode === "dark" ? "#fcd34d" : "#92400e");
  return {
    "--admin-title-font": "var(--admin-font)",
    "--admin-title-weight": "650",
    "--admin-title-tracking": "-0.035em",
    "--admin-label-font": "var(--admin-font)",
    "--admin-surface-fill": "var(--admin-surface)",
    "--admin-surface-filter": "none",
    "--admin-nav-filter": "none",
    "--admin-nav-shadow": "inset -1px 0 0 var(--admin-nav-rule)",
    "--admin-nav-radius": "var(--admin-control-radius)",
    "--admin-nav-active-shadow": "none",
    "--admin-field-fill": "var(--admin-surface-subtle)",
    "--admin-control-shadow": "0 1px 2px color-mix(in srgb, var(--admin-ink) 14%, transparent)",
    "--admin-dock-fill": "var(--admin-sidebar)",
    "--admin-skin-motion-fast": "150ms",
    "--admin-skin-motion-enter": "280ms",
    "--admin-skin-motion-ease": "cubic-bezier(0.2, 0, 0, 1)",
    "--admin-canvas": p.canvas,
    "--admin-surface": p.surface,
    "--admin-surface-subtle": mix(p.ink, 3, p.surface),
    "--admin-soft": "var(--admin-surface-subtle)",
    "--admin-line": border,
    "--admin-ink": p.ink,
    "--admin-muted": readable(p.muted),
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
    "--admin-nav-hover": mix(p.sidebarInk, 8),
    "--admin-nav-rule": mix(p.sidebarInk, 12),
    "--admin-nav-active-bg": p.accent,
    "--admin-nav-active-ink": actionInk,
    "--admin-nav-brand-color": p.sidebarInk,
    "--admin-nav-accent": p.sidebarInk,
    "--admin-nav-badge-ring": p.sidebar,
    "--admin-canvas-art":
      t.depth === "elevated"
        ? `radial-gradient(circle at 85% 0%, ${mix(p.accent, 8)}, transparent 34rem)`
        : "none",
    "--admin-action": p.accent,
    "--admin-action-ink": actionInk,
    "--admin-surface-radius": `${t.geometry.surfaceRadius}px`,
    "--admin-control-radius": `${t.geometry.controlRadius}px`,
    "--admin-rule": mix(p.ink, 7),
    "--admin-border": border,
    "--admin-shadow-border": `0 0 0 1px ${border}`,
    "--admin-shadow-border-hover": `0 0 0 1px ${mix(p.ink, 18)}`,
    "--admin-shadow": shadow,
    "--admin-shadow-hover": `${shadow}, 0 6px 18px -12px ${mix(p.ink, 18)}`,
    "--admin-card-flat-shadow": `0 0 0 1px ${mix(p.ink, 7)}`,
    "--admin-card-raised-shadow": shadow,
    "--admin-card-outline-shadow": `0 0 0 1px ${mix(p.ink, 14)}`,
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
