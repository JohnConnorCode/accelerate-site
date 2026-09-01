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
}

export function MRRChart({ data }: MRRChartProps) {
  const reducedMotion = useReducedMotion();
  if (data.length === 0) return null;

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : { delay: 0.08, duration: 0.24 }}
    >
      <AdminSurface>
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="size-4 text-[var(--admin-accent)]" />
          <h3 className="font-display text-sm font-semibold text-[var(--admin-ink)]">
            MRR Over Time
          </h3>
        </div>
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
                formatter={(value: number | undefined) => [
                  `$${(value ?? 0).toLocaleString()}`,
                  "MRR",
                ]}
              />
              <Line
                type="monotone"
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
