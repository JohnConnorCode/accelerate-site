"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ChartFrame } from "@/components/admin/charts/ChartFrame";
import { AdminLineChart } from "@/components/admin/charts/CartesianCharts";
import { formatMoney } from "@/lib/admin/format";

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
        emptyMessage="No active contracts to display."
        height={256}
      >
        <AdminLineChart
          data={data}
          xKey="date"
          curve="stepAfter"
          height={256}
          series={[{ key: "mrr", label: "Active monthly value" }]}
          valueFormatter={(value) => formatMoney(value)}
        />
      </ChartFrame>
    </motion.div>
  );
}
