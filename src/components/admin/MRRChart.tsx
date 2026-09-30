"use client";

import { motion, useReducedMotion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { AdminSurface } from "@/components/admin/AdminSurface";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface MRRChartProps {
  data: { date: string; mrr: number }[];
  dates?: { creationDateFallbackCount: number; unknownDateCount: number };
}

export function MRRChart({ data, dates }: MRRChartProps) {
  const reducedMotion = useReducedMotion();
  const fallbackCount = dates?.creationDateFallbackCount ?? 0;
  const unknownCount = dates?.unknownDateCount ?? 0;
  if (data.length === 0) return null;

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : { delay: 0.08, duration: 0.24 }}
    >
      <AdminSurface>
        <div className="mb-2 flex items-center gap-2">
          <TrendingUp className="size-4 text-[var(--admin-accent)]" />
          <h3 className="font-display text-sm font-semibold text-[var(--admin-ink)]">
            Active Contracts by Start Month
          </h3>
        </div>
        <p className="admin-copy mb-4 text-xs">
          Cumulative monthly value of contracts active now, grouped by start month in UTC. This
          shows today’s active agreements rather than revenue earned in each month.
          {fallbackCount > 0 &&
            ` ${fallbackCount} active ${fallbackCount === 1 ? "contract uses its" : "contracts use their"} creation date because a valid start date is missing.`}
          {unknownCount > 0 &&
            ` ${unknownCount} active ${unknownCount === 1 ? "contract is" : "contracts are"} included under Date unavailable.`}
        </p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" />
              <XAxis
                dataKey="date"
                tick={{ fill: "var(--admin-muted)", fontSize: 11 }}
                axisLine={{ stroke: "var(--admin-border)" }}
              />
              <YAxis
                tick={{ fill: "var(--admin-muted)", fontSize: 11 }}
                axisLine={{ stroke: "var(--admin-border)" }}
                tickFormatter={(v) => `$${v.toLocaleString()}`}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--admin-surface)",
                  border: "1px solid var(--admin-border)",
                  borderRadius: 8,
                  color: "var(--admin-ink)",
                  fontSize: 12,
                }}
                formatter={(value) => [
                  `$${(Number(value) || 0).toLocaleString()}`,
                  "Active monthly value",
                ]}
              />
              <Line
                type="stepAfter"
                isAnimationActive={!reducedMotion}
                dataKey="mrr"
                stroke="var(--admin-accent)"
                strokeWidth={2}
                dot={{ fill: "var(--admin-accent)", r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </AdminSurface>
    </motion.div>
  );
}
