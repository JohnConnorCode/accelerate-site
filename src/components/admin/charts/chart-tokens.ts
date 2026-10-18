/**
 * Chart tokens.
 *
 * Every value resolves from the active admin appearance's CSS custom
 * properties, so a chart never hardcodes a color and themes correctly across
 * all appearances. Extend `CHART_SERIES` rather than adding a hex value.
 */
export const CHART_SERIES = [
  "var(--admin-accent)",
  "var(--admin-success)",
  "var(--admin-warning)",
  "var(--admin-danger)",
] as const;

export const CHART_GRID = "var(--admin-border)";
export const CHART_AXIS = "var(--admin-muted)";
export const CHART_SURFACE = "var(--admin-surface)";
export const CHART_INK = "var(--admin-ink)";

const FALLBACK_SERIES = "var(--admin-accent)";

export function seriesColor(index: number): string {
  return CHART_SERIES[index % CHART_SERIES.length] ?? FALLBACK_SERIES;
}

export function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}
