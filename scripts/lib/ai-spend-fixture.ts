import { MemorySupabase } from "./memory-supabase";

/** Transport tests explicitly opt in to model calls. Production and policy
 * tests retain the real default-off behavior; SQL tests prove admission. */
export const AI_SPEND_POLICY_FIXTURE = {
  revision: 1,
  enabled: true,
  recurring_enabled: true,
  daily_usd: 100,
  monthly_usd: 1000,
  request_usd: 100,
  daily_calls: 10000,
};
export function enableAiSpendFixture(memory: MemorySupabase, tenantId: string) {
  memory.tables.workspace_ai_controls ??= [];
  if (!memory.tables.workspace_ai_controls.some((row) => row.tenant_id === tenantId))
    memory.tables.workspace_ai_controls.push({ tenant_id: tenantId, ...AI_SPEND_POLICY_FIXTURE });
  memory.rpc("reserve_workspace_ai_call", (args) => ({ id: args.p_id }));
  memory.rpc("finish_workspace_ai_call", () => null);
  return memory;
}
/** Fictional zero-priced catalog response for mocked transport tests only.
 * Jobs testing pricing itself supply their own metadata and do not use this. */
export function fixtureAiPricing(input: string | URL | Request) {
  const url = new URL(input instanceof Request ? input.url : String(input));
  const model = url.searchParams.get("q");
  if (url.pathname !== "/api/v1/models" || !model) return undefined;
  return Response.json({
    data: [
      {
        id: model,
        context_length: 2000000,
        supported_parameters: ["structured_outputs", "response_format", "tools", "reasoning"],
        pricing: { prompt: "0", completion: "0", request: "0" },
      },
    ],
  });
}
