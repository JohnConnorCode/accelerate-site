"use client";

import { CHART_SERIES } from "@/components/admin/charts/chart-tokens";

export interface AdminSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  /** Accessible description. When omitted the sparkline is decorative. */
  label?: string;
  className?: string;
}

/**
 * Theme-aware sparkline for KPI cards.
 *
 * Draws a real SVG path instead of a scaled div so the mark stays crisp at any
 * size. Single-point and flat series render without dividing by zero.
 */
export function AdminSparkline({
  data,
  width = 96,
  height = 28,
  color = CHART_SERIES[0],
  label,
  className,
}: AdminSparklineProps) {
  const clean = data.filter((value) => Number.isFinite(value));
  if (clean.length < 2) {
    if (clean.length === 1) {
      return (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          className={className}
          role={label ? "img" : undefined}
          aria-label={label}
          aria-hidden={label ? undefined : true}
        >
          <circle cx={width / 2} cy={height / 2} r={2} fill={color} />
        </svg>
      );
    }
    return null;
  }

  const pad = 2;
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const span = max - min || 1;
  const step = (width - pad * 2) / (clean.length - 1);
  const points = clean.map((value, index) => {
    const x = pad + index * step;
    const y = height - pad - ((value - min) / span) * (height - pad * 2);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
