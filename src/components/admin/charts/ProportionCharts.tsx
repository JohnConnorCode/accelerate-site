"use client";

import { useReducedMotion } from "framer-motion";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartLegend, ChartTooltip } from "@/components/admin/charts/ChartChrome";
import { CHART_SERIES, clampPercent, seriesColor } from "@/components/admin/charts/chart-tokens";

export interface DonutDatum {
  name: string;
  value: number;
  color?: string;
}

export interface AdminDonutChartProps {
  data: DonutDatum[];
  height?: number;
  centerLabel?: string;
  centerValue?: string;
  valueFormatter?: (value: number) => string;
  className?: string;
}

/** Theme-aware donut with a centre total and a value-carrying legend. */
export function AdminDonutChart({
  data,
  height = 240,
  centerLabel,
  centerValue,
  valueFormatter,
  className,
}: AdminDonutChartProps) {
  const reducedMotion = useReducedMotion();
  const total = data.reduce((sum, item) => sum + (Number.isFinite(item.value) ? item.value : 0), 0);
  const format = valueFormatter ?? ((value: number) => value.toLocaleString());
  const chartHeight = Math.max(120, height - 56);
  return (
    <div className={className} style={{ width: "100%", height }}>
      <div style={{ position: "relative", width: "100%", height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={2}
              isAnimationActive={!reducedMotion}
            >
              {data.map((item, index) => (
                <Cell key={item.name} fill={item.color ?? seriesColor(index)} stroke="none" />
              ))}
            </Pie>
            <Tooltip
              content={(props) => (
                <ChartTooltip {...props} formatter={(value) => format(Number(value))} />
              )}
            />
          </PieChart>
        </ResponsiveContainer>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <span className="text-xl font-semibold tabular-nums text-[var(--admin-ink)]">
            {centerValue ?? format(total)}
          </span>
          {centerLabel ? (
            <span className="text-xs text-[var(--admin-muted)]">{centerLabel}</span>
          ) : null}
        </div>
      </div>
      <ChartLegend
        className="mt-2 justify-center"
        items={data.map((item, index) => ({
          label: item.name,
          color: item.color ?? seriesColor(index),
          value: format(item.value),
        }))}
      />
    </div>
  );
}

export interface AdminRadialGaugeProps {
  /** 0–100. Values outside the range are clamped. */
  value: number;
  label?: string;
  caption?: string;
  size?: number;
  color?: string;
  className?: string;
}

/** Theme-aware radial gauge for a single proportion or goal. */
export function AdminRadialGauge({
  value,
  label,
  caption,
  size = 132,
  color = CHART_SERIES[0],
  className,
}: AdminRadialGaugeProps) {
  const reducedMotion = useReducedMotion();
  const percent = clampPercent(value);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dash = (circumference * percent) / 100;
  if (!Number.isFinite(value)) {
    return (
      <div role="status" className={className} style={{ minHeight: size }}>
        Not available
      </div>
    );
  }
  return (
    <div className={className} style={{ display: "grid", justifyItems: "center", gap: 4 }}>
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        role="img"
        aria-label={`${label ?? "Progress"}: ${Math.round(percent)}%${caption ? `, ${caption}` : ""}`}
      >
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="var(--admin-border)"
          strokeWidth="10"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform="rotate(-90 50 50)"
          style={
            reducedMotion
              ? undefined
              : { transition: "stroke-dasharray 400ms cubic-bezier(0.22, 1, 0.36, 1)" }
          }
        />
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="18"
          fontWeight="600"
          fill="var(--admin-ink)"
        >
          {Math.round(percent)}%
        </text>
      </svg>
      {label ? (
        <span className="text-xs font-semibold text-[var(--admin-ink)]">{label}</span>
      ) : null}
      {caption ? <span className="text-xs text-[var(--admin-muted)]">{caption}</span> : null}
    </div>
  );
}

export interface AdminMeterProps {
  /** 0–100. Values outside the range are clamped. */
  value: number;
  label: string;
  valueLabel?: string;
  color?: string;
  className?: string;
}

/**
 * Theme-aware single-proportion meter.
 *
 * Renders through SVG so a measurement is never a div-width bar, and exposes
 * native meter semantics for assistive technology.
 */
export function AdminMeter({
  value,
  label,
  valueLabel,
  color = CHART_SERIES[0],
  className,
}: AdminMeterProps) {
  const percent = clampPercent(value);
  if (!Number.isFinite(value)) {
    return (
      <div role="status" className={className}>
        {label}: Not available
      </div>
    );
  }
  return (
    <div className={className} style={{ display: "grid", gap: 4 }}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-[var(--admin-muted)]">{label}</span>
        <span className="font-semibold tabular-nums text-[var(--admin-ink)]">
          {valueLabel ?? `${Math.round(percent)}%`}
        </span>
      </div>
      <svg
        role="meter"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        viewBox="0 0 100 8"
        preserveAspectRatio="none"
        width="100%"
        height={8}
      >
        <rect x="0" y="0" width="100" height="8" rx="4" fill="var(--admin-border)" />
        <rect x="0" y="0" width={percent} height="8" rx="4" fill={color} />
      </svg>
    </div>
  );
}
