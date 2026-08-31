import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { recordAudit } from "@/lib/revenue-os/audit";

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    label: z.string().trim().min(1).max(120),
    surfaces: z.array(z.enum(["contact", "analytics"])).min(1).max(2),
    allowedOrigins: z.array(z.string().url()).max(20).default([]),
    expiresAt: z.string().datetime().optional(),
    rateLimitPerMinute: z.number().int().min(1).max(1000).default(60),
  }),
  z.object({ action: z.literal("revoke"), keyId: z.string().uuid() }),
]);

export async function GET() {
  const authorization = await requireAdmin();
  if (authorization instanceof NextResponse) return authorization;
  const { data, error } = await authorization.database.from("tenant_ingest_keys")
    .select("id,label,key_prefix,surfaces,allowed_origins,status,expires_at,last_used_at,created_at,revoked_at,rate_limit_per_minute")
    .eq("tenant_id", authorization.tenant.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keys: data || [] });
}

export async function POST(request: NextRequest) {
  const authorization = await requireAdmin();
  if (authorization instanceof NextResponse) return authorization;
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid ingest-key action" }, { status: 400 });
  if (parsed.data.action === "revoke") {
    const { error } = await authorization.database.from("tenant_ingest_keys").update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("tenant_id", authorization.tenant.id).eq("id", parsed.data.keyId).eq("status", "active");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await recordAudit(authorization.database, { actorEmail: authorization.user.email, action: "tenant_ingest_key.revoked", entityType: "tenant_ingest_key", entityId: parsed.data.keyId });
    return NextResponse.json({ success: true });
  }
  const prefix = randomBytes(6).toString("base64url");
  const rawToken = `ati_${prefix}_${randomBytes(24).toString("base64url")}`;
  const digest = `\\x${createHash("sha256").update(rawToken).digest("hex")}`;
  const { data, error } = await authorization.database.from("tenant_ingest_keys").insert({
    tenant_id: authorization.tenant.id,
    label: parsed.data.label,
    key_prefix: `ati_${prefix}`,
    token_digest: digest,
    surfaces: parsed.data.surfaces,
    allowed_origins: parsed.data.allowedOrigins,
    expires_at: parsed.data.expiresAt || null,
    rate_limit_per_minute: parsed.data.rateLimitPerMinute,
    created_by: authorization.user.id,
  }).select("id,label,key_prefix,surfaces,allowed_origins,status,expires_at,created_at,rate_limit_per_minute").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await recordAudit(authorization.database, { actorEmail: authorization.user.email, action: "tenant_ingest_key.created", entityType: "tenant_ingest_key", entityId: data.id, after: { label: data.label, surfaces: data.surfaces, allowedOrigins: data.allowed_origins, expiresAt: data.expires_at, rateLimitPerMinute: data.rate_limit_per_minute } });
  return NextResponse.json({ key: data, token: rawToken }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
