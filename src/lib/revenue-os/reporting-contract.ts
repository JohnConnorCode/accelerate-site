import { z } from "zod";
import type { AiAdminOperation } from "./ai-tool-contract";

const filter = z.string().trim().min(1).max(160);
export const analyticsFiltersSchema = z
  .object({
    days: z.number().int().min(7).max(365).default(30),
    source: filter.optional(),
    owner: filter.optional(),
    campaign: filter.optional(),
    stage: filter.optional(),
  })
  .strict();

export const revenueReportInputSchema = z
  .object({
    section: z
      .enum(["summary", "clients", "industries", "timeline", "definitions"])
      .default("summary"),
    offset: z.number().int().min(0).max(5000).default(0),
    limit: z.number().int().min(1).max(5).default(5),
  })
  .strict();

export const analyticsReportInputSchema = analyticsFiltersSchema
  .extend({
    section: z
      .enum(["summary", "funnel", "forecast", "quality", "sources", "filters", "website"])
      .default("summary"),
    offset: z.number().int().min(0).max(2000).default(0),
    limit: z.number().int().min(1).max(5).default(5),
  })
  .strict();

export const reportExportInputSchema = z
  .object({
    format: z.enum(["json", "csv"]).default("json"),
  })
  .strict();

export const REVENUE_REPORT_OPERATION: AiAdminOperation = {
  id: "revenue.read-report",
  version: 1,
  scope: "workspace",
  entrypoints: [{ path: "/api/admin/revenue", method: "GET" }],
  verification: ["scripts/test-ai-reporting.ts", "scripts/verify-revenue-read-correctness.ts"],
};
export const ANALYTICS_REPORT_OPERATION: AiAdminOperation = {
  id: "analytics.read-report",
  version: 1,
  scope: "workspace",
  entrypoints: [{ path: "/api/admin/revenue-os/analytics", method: "GET" }],
  verification: ["scripts/test-ai-reporting.ts", "scripts/test-analytics-decision-model.ts"],
};

/** Preserve the dashboard's URL normalization; typed AI commands reject invalid filters. */
export function analyticsFiltersFromUrl(params: URLSearchParams) {
  const bounded = (key: string) => params.get(key)?.trim().slice(0, 160) || undefined;
  return analyticsFiltersSchema.parse({
    days: Math.trunc(Math.min(365, Math.max(7, Number(params.get("days")) || 30))),
    source: bounded("source"),
    owner: bounded("owner"),
    campaign: bounded("campaign"),
    stage: bounded("stage"),
  });
}
