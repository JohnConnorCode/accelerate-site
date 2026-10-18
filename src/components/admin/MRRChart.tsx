"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ChartFrame, AdminLineChart } from "@/components/admin/charts";

interface MRRChartProps {
  data: { date: string; mrr: number }[];
  dates?: { creationDateFallbackCount: number; unknownDateCount: number };
}

export function MRRChart({ data, dates }: MRRChartProps) {
  const reducedMotion = useReducedMotion();
  const fallbackCount = dates?.creationDateFallbackCount ?? 0;
  const unknownCount = dates?.unknownDateCount ?? 0;

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : { delay: 0.08, duration: 0.24 }}
    >
      <ChartFrame
        eyebrow="Revenue"
        title="Active Contracts by Start Month"
        caption={
          "Cumulative monthly value of contracts active now, grouped by start month in UTC. " +
          "This shows today’s active agreements rather than revenue earned in each month." +
          (fallbackCount > 0
            ? ` ${fallbackCount} active ${fallbackCount === 1 ? "contract uses its" : "contracts use their"} creation date because a valid start date is missing.`
            : "") +
          (unknownCount > 0
            ? ` ${unknownCount} active ${unknownCount === 1 ? "contract is" : "contracts are"} included under Date unavailable.`
            : "")
        }
        state={data.length === 0 ? "empty" : "ready"}
        emptyMessage="No active contracts have a start month yet."
        height={256}
      >
        <AdminLineChart
          data={data}
          xKey="date"
          height={256}
          series={[{ key: "mrr", label: "Active monthly value" }]}
          valueFormatter={(value) => `$${value.toLocaleString()}`}
        />
      </ChartFrame>
    </motion.div>
  );
}
