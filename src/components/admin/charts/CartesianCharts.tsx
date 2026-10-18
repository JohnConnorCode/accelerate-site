"use client";

import { useId } from "react";
import { useReducedMotion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartLegend, ChartTooltip } from "@/components/admin/charts/ChartChrome";
import { CHART_AXIS, CHART_GRID, seriesColor } from "@/components/admin/charts/chart-tokens";

export interface ChartSeries {
  key: string;
  label: string;
  color?: string;
}

export type ChartDatum = Record<string, string | number | null | undefined>;

export interface ChartProps {
  data: ChartDatum[];
  xKey: string;
  series: ChartSeries[];
  height?: number;
  valueFormatter?: (value: number, name: string) => string;
  showLegend?: boolean;
  className?: string;
}

function colorFor(series: ChartSeries, index: number): string {
  return series.color ?? seriesColor(index);
}

function tooltipFormatter(valueFormatter?: (value: number, name: string) => string) {
  return (value: unknown, name: string) => {
    if (value === null || value === undefined) return "—";
    if (!valueFormatter) {
      return typeof value === "number" ? value.toLocaleString() : String(value);
    }
    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numeric) ? valueFormatter(numeric, name) : String(value);
  };
}

function axisProps() {
  return {
    tick: { fill: CHART_AXIS, fontSize: 11 },
    axisLine: { stroke: CHART_GRID },
    tickLine: false,
  } as const;
}

function ChartLegendRow({ series }: { series: ChartSeries[] }) {
  return (
    <ChartLegend
      className="mb-2"
      items={series.map((item, index) => ({
        label: item.label,
        color: colorFor(item, index),
      }))}
    />
  );
}

/** Theme-aware line chart with shared axis, tooltip and legend. */
export function AdminLineChart({
  data,
  xKey,
  series,
  height = 240,
  valueFormatter,
  showLegend = series.length > 1,
  className,
}: ChartProps) {
  const reducedMotion = useReducedMotion();
  return (
    <div className={className} style={{ width: "100%", height }}>
      {showLegend ? <ChartLegendRow series={series} /> : null}
      <div style={{ width: "100%", height: showLegend ? height - 26 : height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
            <XAxis dataKey={xKey} {...axisProps()} />
            <YAxis {...axisProps()} width={48} />
            <Tooltip
              cursor={{ stroke: CHART_GRID, strokeDasharray: "3 3" }}
              content={(props) => (
                <ChartTooltip {...props} formatter={tooltipFormatter(valueFormatter)} />
              )}
            />
            {series.map((item, index) => (
              <Line
                key={item.key}
                type="monotone"
                dataKey={item.key}
                name={item.label}
                stroke={colorFor(item, index)}
                strokeWidth={2}
                dot={{ r: 2.5, fill: colorFor(item, index), strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                isAnimationActive={!reducedMotion}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Theme-aware area chart with a token-derived gradient fill. */
export function AdminAreaChart({
  data,
  xKey,
  series,
  height = 240,
  valueFormatter,
  showLegend = series.length > 1,
  className,
}: ChartProps) {
  const reducedMotion = useReducedMotion();
  const gradientId = useId().replace(/:/g, "");
  return (
    <div className={className} style={{ width: "100%", height }}>
      {showLegend ? <ChartLegendRow series={series} /> : null}
      <div style={{ width: "100%", height: showLegend ? height - 26 : height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              {series.map((item, index) => (
                <linearGradient
                  key={item.key}
                  id={`${gradientId}-${index}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={colorFor(item, index)} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={colorFor(item, index)} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
            <XAxis dataKey={xKey} {...axisProps()} />
            <YAxis {...axisProps()} width={48} />
            <Tooltip
              cursor={{ stroke: CHART_GRID, strokeDasharray: "3 3" }}
              content={(props) => (
                <ChartTooltip {...props} formatter={tooltipFormatter(valueFormatter)} />
              )}
            />
            {series.map((item, index) => (
              <Area
                key={item.key}
                type="monotone"
                dataKey={item.key}
                name={item.label}
                stroke={colorFor(item, index)}
                strokeWidth={2}
                fill={`url(#${gradientId}-${index})`}
                isAnimationActive={!reducedMotion}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export interface BarChartProps extends ChartProps {
  /** `vertical` draws upright bars; `horizontal` draws left-to-right bars. */
  orientation?: "vertical" | "horizontal";
  stacked?: boolean;
}

/** Theme-aware bar chart supporting upright and horizontal layouts. */
export function AdminBarChart({
  data,
  xKey,
  series,
  height = 240,
  valueFormatter,
  showLegend = series.length > 1,
  orientation = "vertical",
  stacked = false,
  className,
}: BarChartProps) {
  const reducedMotion = useReducedMotion();
  const horizontal = orientation === "horizontal";
  return (
    <div className={className} style={{ width: "100%", height }}>
      {showLegend ? <ChartLegendRow series={series} /> : null}
      <div style={{ width: "100%", height: showLegend ? height - 26 : height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout={horizontal ? "vertical" : "horizontal"}
            margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={CHART_GRID}
              vertical={horizontal}
              horizontal={!horizontal}
            />
            {horizontal ? (
              <>
                <XAxis type="number" {...axisProps()} />
                <YAxis type="category" dataKey={xKey} width={110} {...axisProps()} />
              </>
            ) : (
              <>
                <XAxis dataKey={xKey} {...axisProps()} />
                <YAxis {...axisProps()} width={48} />
              </>
            )}
            <Tooltip
              cursor={{ fill: "var(--admin-accent-soft)" }}
              content={(props) => (
                <ChartTooltip {...props} formatter={tooltipFormatter(valueFormatter)} />
              )}
            />
            {series.map((item, index) => (
              <Bar
                key={item.key}
                dataKey={item.key}
                name={item.label}
                stackId={stacked ? "stack" : undefined}
                fill={colorFor(item, index)}
                radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
                isAnimationActive={!reducedMotion}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
