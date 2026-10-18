import { z } from "zod";

export const aiSpendPolicySchema = z
  .object({
    enabled: z.boolean(),
    recurringEnabled: z.boolean(),
    dailyUsd: z.number().finite().min(0).max(10000),
    monthlyUsd: z.number().finite().min(0).max(100000),
    requestUsd: z.number().finite().min(0).max(100),
    dailyCalls: z.number().int().min(0).max(10000),
  })
  .strict();
export type AiSpendPolicy = z.infer<typeof aiSpendPolicySchema>;
export const DEFAULT_AI_SPEND_POLICY: AiSpendPolicy = {
  enabled: false,
  recurringEnabled: false,
  dailyUsd: 0,
  monthlyUsd: 0,
  requestUsd: 0,
  dailyCalls: 0,
};
export function aiPolicyFromRow(row: Record<string, unknown> | null): AiSpendPolicy {
  return row
    ? aiSpendPolicySchema.parse({
        enabled: row.enabled,
        recurringEnabled: row.recurring_enabled,
        dailyUsd: Number(row.daily_usd),
        monthlyUsd: Number(row.monthly_usd),
        requestUsd: Number(row.request_usd),
        dailyCalls: row.daily_calls,
      })
    : { ...DEFAULT_AI_SPEND_POLICY };
}
