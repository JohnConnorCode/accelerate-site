import "server-only";
import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { createPlatformServiceRoleClient, createServiceRoleClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import type { TenantSystemContext } from "@/lib/tenancy/context";

export class TenantIngestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function suppliedToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  if (authorization.startsWith("Bearer ")) return authorization.slice(7).trim();
  return request.headers.get("x-tenant-ingest-key")?.trim() || "";
}

export async function authorizeTenantIngest(request: NextRequest, tenantSlug: string, surface: string) {
  const token = suppliedToken(request);
  if (!/^ati_[A-Za-z0-9_-]{8,96}$/.test(token)) throw new TenantIngestError("Invalid ingest credential", 401);
  const digest = `\\x${createHash("sha256").update(token).digest("hex")}`;
  const platform = createPlatformServiceRoleClient("public-tenant-ingest-resolver");
  const { data: tenant } = await platform.from("tenants").select("id,slug,status").eq("slug", tenantSlug).maybeSingle();
  if (!tenant || tenant.status !== "active") throw new TenantIngestError("Tenant intake unavailable", 404);
  const { data: key } = await platform.from("tenant_ingest_keys")
    .select("id,key_prefix,surfaces,allowed_origins,status,expires_at,rate_limit_per_minute")
    .eq("tenant_id", tenant.id)
    .eq("token_digest", digest)
    .eq("status", "active")
    .maybeSingle();
  if (!key || (key.expires_at && new Date(key.expires_at).getTime() <= Date.now())) {
    throw new TenantIngestError("Invalid ingest credential", 401);
  }
  if (!Array.isArray(key.surfaces) || !key.surfaces.includes(surface)) throw new TenantIngestError("Surface not allowed", 403);
  const origin = request.headers.get("origin");
  if (Array.isArray(key.allowed_origins) && key.allowed_origins.length > 0 && (!origin || !key.allowed_origins.includes(origin))) {
    throw new TenantIngestError("Origin not allowed", 403);
  }
  const limit = rateLimit(`tenant-ingest:${key.id}`, key.rate_limit_per_minute || 60, 60_000);
  if (!limit.success) throw new TenantIngestError("Rate limit exceeded", 429);
  await platform.from("tenant_ingest_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id);
  const context: TenantSystemContext = { kind: "system", tenantId: tenant.id, tenantSlug: tenant.slug, source: `public-ingest:${surface}` };
  return { context, database: createServiceRoleClient(context) };
}

