import "server-only";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createPlatformServiceRoleClient, createServiceRoleClient } from "@/lib/supabase/server";
import { runWithTenantRequestContext } from "@/lib/tenancy/context";
import { ACCELERATE_TENANT_ID } from "@/lib/tenancy/constants";
import { getModelRegistration } from "@/lib/ai/model-registry";
import { getOpenRouterQuote } from "@/lib/ai/model-pricing";
import { openRouterChat, type OpenRouterMessage, type OpenRouterTool } from "@/lib/ai/openrouter";
export const DEMO_SESSION_COOKIE = "accelerate-demo-agent";
export function demoSession(cookie?: string) {
  const secret = process.env.DEMO_AI_SESSION_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("The live demo agent is unavailable: session protection is not configured");
  let session = "";
  if (cookie) {
    const parts = cookie.split(".");
    const [payload, signature] = parts;
    if (parts.length === 2 && payload && signature) {
      const expected = createHmac("sha256", secret).update(payload).digest("hex");
      const age = Date.now() - Number(payload.split(":")[1]);
      if (
        signature.length === expected.length &&
        /^[a-f0-9]+$/.test(signature) &&
        timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) &&
        age >= 0 &&
        age < 4 * 3600000
      )
        session = payload;
    }
  }
  if (!session) session = `${randomUUID()}:${Date.now()}`;
  return {
    key: createHash("sha256").update(session).digest("hex"),
    cookie: `${session}.${createHmac("sha256", secret).update(session).digest("hex")}`,
  };
}
/** No database client is passed to the sandbox tool adapter. This closure can
 * resolve only a separately funded demo tenant's provider and usage receipts. */
export async function withDemoInference<T>(
  session: string,
  requestId: string,
  run: (
    infer: (
      messages: OpenRouterMessage[],
      tools: OpenRouterTool[],
    ) => Promise<Awaited<ReturnType<typeof openRouterChat>>>,
  ) => Promise<T>,
  signal?: AbortSignal,
) {
  const tenantId = process.env.DEMO_AI_TENANT_ID;
  const modelId = process.env.DEMO_AI_MODEL;
  if (
    process.env.DEMO_AI_ENABLED !== "true" ||
    !tenantId ||
    !/^[0-9a-f-]{36}$/i.test(tenantId) ||
    tenantId === ACCELERATE_TENANT_ID ||
    !modelId
  )
    throw new Error(
      "The live demo agent is unavailable: its dedicated provider workspace is not configured. You can still explore the fictional workspace.",
    );
  const telemetry = createPlatformServiceRoleClient("public-demo-inference-budget");
  const admit = await telemetry.rpc("admit_demo_agent", {
    p_session: session,
    p_request: requestId,
  });
  if (admit.error || !admit.data?.allowed)
    throw new Error(admit.data?.reason || "Demo usage admission is unavailable");
  try {
    return await runWithTenantRequestContext(
      {
        kind: "system",
        tenantId,
        tenantSlug: "public-agent-demo",
        source: "public-demo-inference",
      },
      async () => {
        const database = createServiceRoleClient({
          kind: "system",
          tenantId,
          tenantSlug: "public-agent-demo",
          source: "public-demo-inference",
        });
        const registration = await getModelRegistration(database, tenantId, modelId);
        if (!registration?.evalPassed || !registration.supportsTools)
          throw new Error("The demo model is not registered and evaluated for tools");
        const quote = await getOpenRouterQuote(modelId);
        return run(async (messages, tools) => {
          signal?.throwIfAborted();
          const inputTokens = Buffer.byteLength(JSON.stringify({ messages, tools }), "utf8") + 1024;
          const maxTokens = 1200;
          if (inputTokens > 64000 || inputTokens + maxTokens > quote.context)
            throw new Error(
              "Demo context is too large. Start a new conversation or use a narrower request.",
            );
          const reserved =
            Math.ceil(
              ((inputTokens * quote.promptPerMillion) / 1e6 +
                (maxTokens * quote.completionPerMillion) / 1e6 +
                quote.request) *
                1e9,
            ) / 1e9;
          const callId = randomUUID();
          const reserve = await telemetry.rpc("reserve_demo_inference", {
            p_session: session,
            p_request: requestId,
            p_call: callId,
            p_amount: reserved,
          });
          if (reserve.error || !reserve.data?.allowed)
            throw new Error(
              reserve.data?.reason || "The shared $5 daily demo budget is unavailable",
            );
          const response = await openRouterChat({
            database,
            job: "public-demo-agent",
            model: modelId,
            messages,
            tools,
            maxTokens,
            strictPricing: {
              prompt: quote.promptPerMillion,
              completion: quote.completionPerMillion,
              request: quote.request,
            },
            timeoutMs: 25000,
            signal,
          });
          // Missing/uncertain usage retains the full reservation. Never invent a cost.
          const settle = await telemetry.rpc("settle_demo_inference", {
            p_call: callId,
            p_cost: typeof response.usage?.cost === "number" ? response.usage.cost : null,
          });
          if (settle.error)
            throw new Error(
              "Demo inference receipt could not be confirmed; its budget reservation is retained",
            );
          return response;
        });
      },
    );
  } finally {
    const release = await telemetry.rpc("finish_demo_agent", {
      p_session: session,
      p_request: requestId,
    });
    if (release.error) console.error("[demo-agent] admission release failed");
  }
}
