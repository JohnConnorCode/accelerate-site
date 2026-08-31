import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createBootstrapServiceRoleClient } from "@/lib/supabase/server";

const eventSchema = z.object({
  eventId: z.string().uuid(),
  visitorId: z.string().uuid(),
  name: z.string().trim().min(1).max(80).regex(/^[a-z0-9_]+$/),
  path: z.string().trim().min(1).max(300).startsWith("/"),
  referrerHost: z.string().trim().max(253).optional(),
  attribution: z.object({
    utm_source: z.string().trim().max(120).optional(),
    utm_medium: z.string().trim().max(120).optional(),
    utm_campaign: z.string().trim().max(160).optional(),
    utm_term: z.string().trim().max(160).optional(),
    utm_content: z.string().trim().max(160).optional(),
  }).optional(),
  properties: z.record(z.string(), z.union([z.string().max(160), z.number(), z.boolean()])).optional(),
});

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === request.nextUrl.host; } catch { return false; }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid analytics event" }, { status: 400 });
  const event = parsed.data;
  const { error } = await createBootstrapServiceRoleClient("legacy-public-analytics").from("website_events").upsert({
    event_id: event.eventId, visitor_id: event.visitorId, event_name: event.name, path: event.path,
    referrer_host: event.referrerHost || null, ...event.attribution, properties: event.properties || {},
  }, { onConflict: "event_id", ignoreDuplicates: true });
  if (error) {
    // Tracking must never interrupt a site conversion. Setup Center will surface a missing schema.
    console.error("First-party analytics event failed", error.message);
    return NextResponse.json({ accepted: false }, { status: 202 });
  }
  return NextResponse.json({ accepted: true }, { status: 202 });
}
