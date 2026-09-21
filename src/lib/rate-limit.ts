import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPlatformServiceRoleClient } from "@/lib/supabase/server";
import { getTenantRequestContext } from "@/lib/tenancy/context";
import { isSupabasePublicConfigured, isSetupPlaceholder } from "@/lib/supabase/configuration.mjs";

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  status: 200 | 429 | 503;
  retryAfter: number;
};
const unavailable: RateLimitResult = { success: false, remaining: 0, status: 503, retryAfter: 30 };
export const RATE_LIMIT_UNAVAILABLE =
  "This action is temporarily unavailable. Please try again shortly.";

/** Platform abuse metadata only: hashed namespaced keys, no business records.
 * The database serializes the sliding window across every application instance. */
export async function consumeRateLimit(
  database: Pick<SupabaseClient, "rpc">,
  key: string,
  limit: number,
  windowMs: number,
  scope: string,
): Promise<RateLimitResult> {
  if (
    !key.includes(":") ||
    key.length > 4096 ||
    !scope ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 10000 ||
    !Number.isSafeInteger(windowMs) ||
    windowMs < 1 ||
    windowMs > 86400000
  )
    throw new Error("Invalid rate-limit policy");
  const digest = createHash("sha256")
    .update(JSON.stringify([scope, key, limit, windowMs]))
    .digest("hex");
  try {
    const { data, error } = await database
      .rpc("consume_rate_limit", {
        p_key: digest,
        p_limit: limit,
        p_window_ms: windowMs,
      })
      .abortSignal(AbortSignal.timeout(5000));
    if (
      error ||
      !data ||
      typeof data.allowed !== "boolean" ||
      !Number.isInteger(data.remaining) ||
      data.remaining < 0 ||
      data.remaining >= limit ||
      !Number.isInteger(data.retry_after) ||
      data.retry_after < 0 ||
      (!data.allowed && (data.remaining !== 0 || data.retry_after < 1))
    )
      return { ...unavailable };
    return {
      success: data.allowed,
      remaining: data.remaining,
      status: data.allowed ? 200 : 429,
      retryAfter: data.retry_after,
    };
  } catch {
    // No local fallback: a provider outage must not open sends or expensive work.
    return { ...unavailable };
  }
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  if (
    !isSupabasePublicConfigured(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ) ||
    isSetupPlaceholder(process.env.SUPABASE_SERVICE_ROLE_KEY)
  )
    return { ...unavailable };
  const context = getTenantRequestContext();
  const scope = context?.kind === "actor" ? context.tenant.id : context?.tenantId || "platform";
  try {
    return await consumeRateLimit(
      createPlatformServiceRoleClient("platform-rate-limit"),
      key,
      limit,
      windowMs,
      scope,
    );
  } catch {
    return { ...unavailable };
  }
}

export function rateLimitResponse(
  result: RateLimitResult,
  body: Record<string, unknown> | string,
  extraHeaders: Record<string, string> = {},
) {
  const headers = {
    ...extraHeaders,
    "Cache-Control": "no-store",
    "Retry-After": String(result.retryAfter),
  };
  if (typeof body === "string")
    return new NextResponse(result.status === 503 ? RATE_LIMIT_UNAVAILABLE : body, {
      status: result.status,
      headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
    });
  return NextResponse.json(
    result.status === 503 ? { ...body, error: RATE_LIMIT_UNAVAILABLE } : body,
    { status: result.status, headers },
  );
}
