import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { cancelScheduledSequences } from "@/lib/email/sequences";
import { scheduleAuditPrepEmail } from "@/lib/email/booking";

interface CalendlyWebhookPayload {
  event?: "invitee.created" | "invitee.canceled";
  created_at?: string;
  payload?: {
    uri?: string;
    email?: string;
    name?: string;
    event?: string;
    status?: string;
    rescheduled?: boolean;
    old_invitee?: string;
    new_invitee?: string;
    tracking?: {
      utm_source?: string | null;
      utm_medium?: string | null;
      utm_campaign?: string | null;
      utm_content?: string | null;
      utm_term?: string | null;
    };
    scheduled_event?: {
      uri?: string;
      name?: string;
      start_time?: string;
      end_time?: string;
      status?: string;
    };
    cancellation?: { canceled_by?: string; reason?: string };
  };
}

function signatureMatches(raw: string, supplied: string, secret: string): boolean {
  const digest = createHmac("sha256", secret).update(raw).digest();
  const values = [
    Buffer.from(supplied.replace(/^sha256=/, ""), "hex"),
    Buffer.from(supplied, "base64"),
  ];
  return values.some((candidate) => candidate.length === digest.length && timingSafeEqual(candidate, digest));
}

export async function POST(request: NextRequest) {
  const secret = process.env.CALENDLY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 });

  const raw = await request.text();
  const querySecret = new URL(request.url).searchParams.get("secret");
  const signature = request.headers.get("x-calendly-webhook-signature") || request.headers.get("calendly-webhook-signature");
  const authorized = querySecret === secret || Boolean(signature && signatureMatches(raw, signature, secret));
  if (!authorized) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  let body: CalendlyWebhookPayload;
  try {
    body = JSON.parse(raw) as CalendlyWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!body.event || !body.payload?.uri || !body.payload.email) {
    return NextResponse.json({ error: "Unsupported payload" }, { status: 400 });
  }

  const receiptId = `${body.event}:${body.payload.uri}:${body.created_at || "unknown"}`;
  const supabase = createServiceRoleClient();
  const { data: existingReceipt } = await supabase
    .from("calendly_webhook_receipts")
    .select("id")
    .eq("id", receiptId)
    .maybeSingle();
  if (existingReceipt) return NextResponse.json({ success: true, duplicate: true });

  const email = body.payload.email.trim().toLowerCase();
  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("id, stage, calendly_invitee_uri")
    .eq("email", email)
    .maybeSingle();

  if (!opportunity) {
    await Promise.all([
      supabase.from("admin_notifications").insert({
        type: "new_contact",
        title: "Calendly booking without a qualifier",
        message: `${body.payload.name || email} · ${email}`,
        link: "/admin/bookings",
        priority: "important",
      }),
      supabase.from("calendly_webhook_receipts").insert({ id: receiptId, event_type: body.event }),
    ]);
    return NextResponse.json({ success: true, unmatched: true });
  }

  if (body.event === "invitee.created") {
    const scheduledAt = body.payload.scheduled_event?.start_time || null;
    const { error } = await supabase.from("opportunities").update({
      stage: "booked",
      calendly_invitee_uri: body.payload.uri,
      calendly_event_uri: body.payload.scheduled_event?.uri || body.payload.event || null,
      scheduled_at: scheduledAt,
      booked_at: body.created_at || new Date().toISOString(),
      canceled_at: null,
      utm_source: body.payload.tracking?.utm_source || undefined,
      utm_medium: body.payload.tracking?.utm_medium || undefined,
      utm_campaign: body.payload.tracking?.utm_campaign || undefined,
      utm_content: body.payload.tracking?.utm_content || undefined,
      utm_term: body.payload.tracking?.utm_term || undefined,
    }).eq("id", opportunity.id);
    if (error) return NextResponse.json({ error: "Booking could not be stored" }, { status: 500 });

    await Promise.all([
      supabase.from("opportunity_stage_events").insert({
        opportunity_id: opportunity.id,
        from_stage: opportunity.stage,
        to_stage: "booked",
        source: "calendly_webhook",
        metadata: { invitee_uri: body.payload.uri, scheduled_at: scheduledAt },
      }),
      supabase.from("admin_notifications").insert({
        type: "new_lead",
        title: "Roofing revenue audit booked",
        message: `${body.payload.name || email}${scheduledAt ? ` · ${new Date(scheduledAt).toLocaleString("en-US", { timeZone: "America/Chicago" })}` : ""}`,
        link: "/admin/bookings",
        priority: "urgent",
      }),
      supabase.from("tasks").insert({
        title: `Prepare roofing audit for ${body.payload.name || email}`,
        description: "Review the company website, response path, and estimate follow-up before the call.",
        due_date: scheduledAt ? new Date(new Date(scheduledAt).getTime() - 86400000).toISOString().split("T")[0] : null,
        priority: "high",
        related_type: "lead",
        related_id: opportunity.id,
        related_name: body.payload.name || email,
      }),
      cancelScheduledSequences(email, "booking_nurture"),
      scheduledAt
        ? scheduleAuditPrepEmail({ email, scheduledAt, eventKey: body.payload.uri })
        : Promise.resolve(),
    ]);
  } else {
    // A reschedule produces a canceled event plus a new created event. Only
    // clear the current booking if this cancellation still points at it.
    const isCurrentInvitee = !opportunity.calendly_invitee_uri || opportunity.calendly_invitee_uri === body.payload.uri;
    if (isCurrentInvitee) {
      const { error } = await supabase.from("opportunities").update({
        stage: "qualified",
        canceled_at: body.created_at || new Date().toISOString(),
        scheduled_at: null,
      }).eq("id", opportunity.id).eq("calendly_invitee_uri", body.payload.uri);
      if (error) return NextResponse.json({ error: "Cancellation could not be stored" }, { status: 500 });

      await supabase.from("opportunity_stage_events").insert({
        opportunity_id: opportunity.id,
        from_stage: opportunity.stage,
        to_stage: "qualified",
        source: "calendly_webhook",
        metadata: {
          rescheduled: Boolean(body.payload.rescheduled),
          canceled_by: body.payload.cancellation?.canceled_by || null,
          reason: body.payload.cancellation?.reason || null,
        },
      });
    }
  }

  const { error: receiptError } = await supabase.from("calendly_webhook_receipts").insert({
    id: receiptId,
    event_type: body.event,
  });
  if (receiptError && receiptError.code !== "23505") {
    console.error("[calendly-webhook] receipt write failed:", receiptError.message);
  }
  return NextResponse.json({ success: true });
}
