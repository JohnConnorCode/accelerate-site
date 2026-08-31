import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeTenantIngest, TenantIngestError } from "@/lib/tenancy/ingest";

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().max(40).optional(),
  businessType: z.string().trim().max(120).optional(),
  message: z.string().trim().max(5000).optional(),
});
const analyticsSchema = z.object({
  eventId: z.string().uuid(),
  visitorId: z.string().uuid(),
  name: z.string().trim().min(1).max(80).regex(/^[a-z0-9_]+$/),
  path: z.string().trim().min(1).max(300).startsWith("/"),
  referrerHost: z.string().trim().max(253).optional(),
  attribution: z.record(z.string(), z.string().max(160)).optional(),
  properties: z.record(z.string(), z.union([z.string().max(160), z.number(), z.boolean()])).optional(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ tenantSlug: string; surface: string }> }) {
  const { tenantSlug, surface } = await context.params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tenantSlug) || !["contact", "analytics"].includes(surface)) {
    return NextResponse.json({ error: "Unknown tenant intake surface" }, { status: 404 });
  }
  try {
    const authorized = await authorizeTenantIngest(request, tenantSlug, surface);
    const body = await request.json().catch(() => null);
    if (surface === "contact") {
      const parsed = contactSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Invalid contact intake" }, { status: 400 });
      const { error } = await authorized.database.from("contact_submissions").insert({
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
        business_type: parsed.data.businessType || null,
        message: parsed.data.message || null,
      });
      if (error) throw error;
      return NextResponse.json({ accepted: true }, { status: 202 });
    }
    const parsed = analyticsSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid analytics event" }, { status: 400 });
    const { error } = await authorized.database.from("website_events").upsert({
      event_id: parsed.data.eventId,
      visitor_id: parsed.data.visitorId,
      event_name: parsed.data.name,
      path: parsed.data.path,
      referrer_host: parsed.data.referrerHost || null,
      ...parsed.data.attribution,
      properties: parsed.data.properties || {},
    }, { onConflict: "tenant_id,event_id", ignoreDuplicates: true });
    if (error) throw error;
    return NextResponse.json({ accepted: true }, { status: 202 });
  } catch (error) {
    if (error instanceof TenantIngestError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[tenant-ingest] intake failed", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "Tenant intake failed" }, { status: 500 });
  }
}

