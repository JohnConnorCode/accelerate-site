import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { callAiSpendRpc, tenantIdForDatabase, tenantScopeForDatabase } from "@/lib/supabase/server";
import { getTenantRequestContext } from "@/lib/tenancy/context";
import { assertCurrentTenantAdmin } from "@/lib/revenue-os/tenant-admin-authority";
import { getOpenRouterQuote } from "./model-pricing";
import { aiPolicyFromRow, aiSpendPolicySchema } from "./spend-controls-contract";

function workspace(db: SupabaseClient) {
  const id = tenantIdForDatabase(db);
  if (!id) throw new Error("AI controls require a tenant-bound database");
  return id;
}
export async function readAiSpendPolicy(db: SupabaseClient) {
  const { data, error } = await db
    .from("workspace_ai_controls")
    .select("*")
    .eq("tenant_id", workspace(db))
    .maybeSingle();
  if (error) throw new Error("AI cost controls are unavailable. No model request was made");
  return { policy: aiPolicyFromRow(data), revision: Number(data?.revision ?? 0) };
}
export async function readAiSpendControls(db: SupabaseClient) {
  const current = await readAiSpendPolicy(db);
  const coworkers = await db
    .from("coworkers")
    .select("id,name,status,work_kinds")
    .eq("tenant_id", workspace(db))
    .order("name")
    .limit(101);
  if (coworkers.error || (coworkers.data?.length ?? 0) > 100)
    throw new Error("Coworker controls could not be read completely");
  const { data, error } = await callAiSpendRpc(db, "read_workspace_ai_usage", {
    p_tenant_id: workspace(db),
  });
  if (error) throw new Error("AI usage could not be read");
  const slug = tenantScopeForDatabase(db)?.slug;
  return {
    ...current,
    humanHandoff: slug
      ? `/t/${encodeURIComponent(slug)}/admin/ai?view=costs`
      : "/admin/ai?view=costs",
    changesRequireHuman: true,
    coworkers: coworkers.data ?? [],
    ...(data as {
      usage: {
        dailyCalls: number;
        dailyReservedUsd: number;
        monthlyReservedUsd: number;
        reportedUsd: number;
        uncertainCalls: number;
      };
      recent: Array<{
        id: string;
        job: string;
        model: string;
        reserved_usd: number;
        actual_usd: number | null;
        created_at: string;
      }>;
    }),
  };
}
export async function saveAiSpendControls(
  db: SupabaseClient,
  input: { revision: number; policy: unknown },
  actorEmail: string,
) {
  const tenantId = await assertCurrentTenantAdmin(db, actorEmail);
  const context = getTenantRequestContext();
  if (context?.kind !== "actor") throw new Error("Workspace administrator required");
  const policy = aiSpendPolicySchema.parse(input.policy);
  const result = await callAiSpendRpc(db, "save_workspace_ai_controls", {
    p_tenant_id: tenantId,
    p_actor_id: context.user.id,
    p_actor_email: actorEmail,
    p_revision: input.revision,
    p_policy: policy,
  });
  if (result.error) throw new Error(result.error.message);
  return readAiSpendControls(db);
}

/** Every provider request, including retries and streams, reserves its full
 * bounded cost before dispatch. Unknown outcomes keep their reservation.
 * Free calls need verified zero pricing and still consume the request cap. */
export async function reserveAiSpend(
  db: SupabaseClient,
  job: string,
  model: string,
  body: Record<string, unknown>,
) {
  const { policy } = await readAiSpendPolicy(db);
  const context = getTenantRequestContext();
  const recurring =
    job === "coworker-task" ||
    (context?.kind === "system" && /(?:^|-)(?:cron|scheduler)(?:-|$)/.test(context.source));
  if (!policy.enabled) throw new Error("AI calls are paused. Open AI > Cost controls");
  if (recurring && !policy.recurringEnabled) throw new Error("Recurring AI work is paused");
  const quote = await getOpenRouterQuote(model);
  const output = Number(body.max_tokens);
  const input =
    Buffer.byteLength(
      JSON.stringify({
        messages: body.messages,
        tools: body.tools,
        response_format: body.response_format,
      }),
      "utf8",
    ) + 1024;
  if (!Number.isInteger(output) || output < 1 || input + output > quote.context)
    throw new Error("AI request exceeds its verified token bound");
  const amount =
    Math.ceil(
      ((input * quote.promptPerMillion) / 1e6 +
        (output * quote.completionPerMillion) / 1e6 +
        quote.request) *
        1e9,
    ) / 1e9;
  const id = randomUUID();
  const result = await callAiSpendRpc(db, "reserve_workspace_ai_call", {
    p_tenant_id: workspace(db),
    p_id: id,
    p_job: job,
    p_model: model,
    p_reserved_usd: amount,
    p_recurring: recurring,
  });
  if (result.error) throw new Error(result.error.message);
  // Pin one serving model and its observed prices. No unpriced fallback or
  // additional fee can slip through the admitted request.
  delete body.models;
  delete body.route;
  const provider = (body.provider ?? {}) as Record<string, unknown>;
  const existing = provider.max_price as Record<string, number> | undefined;
  body.provider = {
    ...provider,
    require_parameters: true,
    allow_fallbacks: false,
    max_price: {
      prompt: Math.min(existing?.prompt ?? Infinity, quote.promptPerMillion),
      completion: Math.min(existing?.completion ?? Infinity, quote.completionPerMillion),
      request: Math.min(existing?.request ?? Infinity, quote.request),
    },
  };
  return id;
}
export async function finishAiSpend(
  db: SupabaseClient,
  id: string,
  requestId: string,
  cost: number | undefined,
) {
  if (cost === undefined || !/^gen-[a-zA-Z0-9_-]{1,196}$/.test(requestId)) return;
  if (!Number.isFinite(cost) || cost < 0) throw new Error("Provider returned invalid AI usage");
  const result = await callAiSpendRpc(db, "finish_workspace_ai_call", {
    p_tenant_id: workspace(db),
    p_id: id,
    p_actual_usd: cost,
    p_provider_request_id: requestId,
  });
  if (result.error)
    throw new Error("AI usage could not be saved. The budget reservation remains held");
}
