import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createBootstrapServiceRoleClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { TenantSystemContext } from "@/lib/tenancy/context";
import { cancelScheduledSequences } from "@/lib/email/sequences";
import { scheduleAuditPrepEmail } from "@/lib/email/booking";
import { getResend, getTenantResend } from "@/lib/email/resend";
import { rateLimit } from "@/lib/rate-limit";
import { recordActivity } from "@/lib/revenue-os/activities";
import { recordAudit } from "@/lib/revenue-os/audit";
import { stopCampaignMemberships } from "@/lib/revenue-os/campaign-stops";
import { transitionOpportunity } from "@/lib/revenue-os/pipeline";
import { ACCELERATE_TENANT_ID } from "@/lib/tenancy/constants";

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

const MAX_CALENDLY_WEBHOOK_PAYLOAD_BYTES = 100_000;
const CALENDLY_WEBHOOK_RATE_LIMIT_PER_MIN = 120;
const CALENDLY_WEBHOOK_RATE_WINDOW_MS = 60_000;

export async function handleCalendlyWebhook(request: NextRequest, input?: { webhookSecret?: string; tenantContext?: TenantSystemContext }) {
  const secret = input?.webhookSecret || process.env.CALENDLY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 });

  const raw = await request.text();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`calendly-webhook:${ip}`, CALENDLY_WEBHOOK_RATE_LIMIT_PER_MIN, CALENDLY_WEBHOOK_RATE_WINDOW_MS).success) {
    return NextResponse.json({ error: "Webhook rate limit exceeded" }, { status: 429 });
  }

  const payloadBytes = Buffer.byteLength(raw, "utf8");
  if (payloadBytes > MAX_CALENDLY_WEBHOOK_PAYLOAD_BYTES) {
    return NextResponse.json({ error: "Webhook payload too large" }, { status: 413 });
  }

  const querySecret = new URL(request.url).searchParams.get("secret");
  // Prefer a header so credentials never appear in access logs or copied URLs.
  // Keep the query parameter temporarily for existing Calendly subscriptions;
  // Setup must migrate them before that compatibility path can be removed.
  const headerSecret = request.headers.get("x-accelerate-webhook-secret");
  const signature = request.headers.get("x-calendly-webhook-signature") || request.headers.get("calendly-webhook-signature");
  const authorized = headerSecret === secret || querySecret === secret || Boolean(signature && signatureMatches(raw, signature, secret));
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

  // The invitee URI is unique per booking and a cancel-then-rebook produces a
  // new one, so event + URI is the true idempotency key. `created_at` used to be
  // part of it, which only weakened it: any redelivery carrying a different
  // timestamp keyed to a fresh receipt and processed the same booking twice,
  // notifying the founder twice for one meeting. Receipts written under the old
  // three-part key will not match this one, so a booking already processed
  // before this change could notify once more; there were no real bookings at
  // the time it shipped.
  const receiptId = `${body.event}:${body.payload.uri}`;
  const isBootstrapTenant = !input?.tenantContext || input.tenantContext.tenantId === ACCELERATE_TENANT_ID;
  const supabase = input?.tenantContext
    ? createServiceRoleClient(input.tenantContext)
    : createBootstrapServiceRoleClient("legacy-calendly-webhook");
  const resend = input?.tenantContext ? await getTenantResend(supabase) : getResend();
  const { data: existingReceipt } = await supabase
    .from("calendly_webhook_receipts")
    .select("id")
    .eq("id", receiptId)
    .maybeSingle();
  if (existingReceipt) return NextResponse.json({ success: true, duplicate: true });

  const email = body.payload.email.trim().toLowerCase();
  const [{ data: opportunity }, { data: contact }] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id, stage, contact_id, calendly_invitee_uri")
      .eq("email", email)
      .maybeSingle(),
    supabase
      .from("contacts")
      .select("id")
      .eq("primary_email", email)
      .maybeSingle(),
  ]);

  // Stop sends as soon as Calendly confirms the booking—not after a later
  // pipeline update. Recovery contacts often have no opportunity yet, but
  // still need the same protection from a follow-up email racing the meeting.
  const contactId = opportunity?.contact_id || contact?.id || null;
  if (body.event === "invitee.created" && contactId) {
    await stopCampaignMemberships(supabase, {
      contactId,
      reason: "calendar_booking",
      source: "webhook",
      sourceReceiptId: receiptId,
      actorEmail: "calendly",
    });
    // The activity receipt remains true even after every campaign step has
    // already completed, when there is no pending membership left to stop.
    // It gives recovery attribution a signed, replay-safe booking fact.
    await recordActivity(supabase, {
      activityType: "calendar_booking",
      title: `Calendly booking: ${body.payload.name || email}`,
      summary: body.payload.scheduled_event?.start_time ? `Scheduled for ${body.payload.scheduled_event.start_time}.` : "Calendly booking confirmed.",
      contactId,
      opportunityId: opportunity?.id ?? null,
      source: "calendly_webhook",
      actorEmail: "calendly",
      externalId: `calendly:${receiptId}`,
      occurredAt: body.created_at,
      metadata: { invitee_uri: body.payload.uri, scheduled_event_uri: body.payload.scheduled_event?.uri ?? null },
    });
  }

  if (!opportunity) {
    // A booking nobody can trace to an inquiry is the case where the
    // notification IS the entire record of it, so a failed insert cannot be
    // discarded inside a Promise.all the way it used to be. The receipt is
    // written first and separately: if the notification then fails, the founder
    // gets a 500 and Calendly retries, which is the outcome that recovers a
    // booking rather than losing one.
    const { error: receiptError } = await supabase
      .from("calendly_webhook_receipts")
      .insert({ id: receiptId, event_type: body.event });
    if (receiptError) {
      console.error("[calendly] receipt insert failed for unmatched booking:", receiptError.message);
    }

    const { error: notificationError } = await supabase.from("admin_notifications").insert({
      type: "new_contact",
      title: contact ? "Calendly booking from a recovery contact" : "Calendly booking without a qualifier",
      description: `${body.payload.name || email} · ${email}`,
      link: contact ? "/admin/recovery" : "/admin/bookings",
      priority: "important",
    });
    if (notificationError) {
      console.error("[calendly] booking notification failed:", notificationError.message);
      return NextResponse.json({ error: "Booking recorded but the operator could not be notified" }, { status: 500 });
    }
    return NextResponse.json({ success: true, unmatched: true });
  }

  if (body.event === "invitee.created") {
    const scheduledAt = body.payload.scheduled_event?.start_time || null;
    try {
      await transitionOpportunity(supabase, {
        id: opportunity.id,
        to: "booked",
        actorEmail: "calendly",
        source: "calendly_webhook",
        reason: "Calendly booking created",
      });
    } catch (error) {
      return NextResponse.json({
        error: error instanceof Error ? error.message : "Calendar transition blocked by pipeline state",
      }, { status: 409 });
    }

    const { error } = await supabase.from("opportunities").update({
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

    // A booking that lands without telling anyone is the worst failure this
    // endpoint has, so the notification result is inspected rather than
    // discarded inside Promise.all. A silent insert failure here is how a real
    // meeting goes unnoticed.
    const [notification] = await Promise.all([
      supabase.from("admin_notifications").insert({
        type: "new_lead",
        title: isBootstrapTenant ? "Roofing revenue audit booked" : "New Calendly booking",
        description: `${body.payload.name || email}${scheduledAt ? ` · ${new Date(scheduledAt).toLocaleString("en-US", { timeZone: "America/Chicago" })}` : ""}`,
        link: "/admin/bookings",
        priority: "urgent",
      }),
      supabase.from("tasks").insert({
        title: isBootstrapTenant ? `Prepare roofing audit for ${body.payload.name || email}` : `Prepare for meeting with ${body.payload.name || email}`,
        description: isBootstrapTenant ? "Review the company website, response path, and estimate follow-up before the call." : "Review the contact history, open work, and agreed meeting context before the call.",
        due_date: scheduledAt ? new Date(new Date(scheduledAt).getTime() - 86400000).toISOString().split("T")[0] : null,
        priority: "high",
        related_type: "lead",
        related_id: opportunity.id,
        related_name: body.payload.name || email,
      }),
      cancelScheduledSequences(email, "booking_nurture", { database: supabase, resend }),
      scheduledAt && isBootstrapTenant
        ? scheduleAuditPrepEmail({ email, scheduledAt, eventKey: body.payload.uri }, resend)
        : Promise.resolve(),
    ]);
    if (notification.error) {
      console.error("[calendly] booking notification FAILED (booking stored):", notification.error.message);
      await recordAudit(supabase, {
        actorEmail: "calendly", action: "notification.failed", entityType: "opportunity",
        entityId: opportunity.id, source: "webhook",
        metadata: { surface: "calendly_booking", error: notification.error.message },
      });
    }
  } else {
    // A reschedule produces a canceled event plus a new created event. Only
    // clear the current booking if this cancellation still points at it.
    const isCurrentInvitee = !opportunity.calendly_invitee_uri || opportunity.calendly_invitee_uri === body.payload.uri;
    if (isCurrentInvitee) {
      try {
        await transitionOpportunity(supabase, {
          id: opportunity.id,
          to: "qualified",
          actorEmail: "calendly",
          source: "calendly_webhook",
          reason: "Calendly invitee canceled",
        });
      } catch (error) {
        return NextResponse.json({
          error: error instanceof Error ? error.message : "Calendar transition blocked by pipeline state",
        }, { status: 409 });
      }

      const { error } = await supabase.from("opportunities").update({
        canceled_at: body.created_at || new Date().toISOString(),
        scheduled_at: null,
      }).eq("id", opportunity.id).eq("calendly_invitee_uri", body.payload.uri);
      if (error) return NextResponse.json({ error: "Cancellation could not be stored" }, { status: 500 });
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

export async function POST(request: NextRequest) {
  return handleCalendlyWebhook(request);
}
