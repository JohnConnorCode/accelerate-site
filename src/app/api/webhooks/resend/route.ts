import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getResend } from "@/lib/email/resend";
import { recordAudit } from "@/lib/revenue-os/audit";
import { suppressContactFromCampaignEmail } from "@/lib/revenue-os/campaign-stops";
import { recordActivity } from "@/lib/revenue-os/activities";
import { createBootstrapServiceRoleClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Resend } from "resend";
import type { TenantSystemContext } from "@/lib/tenancy/context";

export const runtime = "nodejs";

type ResendEvent = {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    tags?: Record<string, string>;
    bounce?: { message?: string; type?: string; subType?: string };
    failed?: { reason?: string };
  };
};

const EVENT_STATUS: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "failed",
  "email.suppressed": "suppressed",
};

const MAX_RESEND_WEBHOOK_PAYLOAD_BYTES = 100_000;

function webhookHeaders(request: NextRequest) {
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  return id && timestamp && signature ? { id, timestamp, signature } : null;
}

export async function handleResendWebhook(
  request: NextRequest,
  input?: { webhookSecret?: string; resend?: Resend; tenantContext?: TenantSystemContext },
) {
  const webhookSecret = input?.webhookSecret || process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret)
    return NextResponse.json({ error: "Resend webhook is not configured" }, { status: 503 });
  const headers = webhookHeaders(request);
  if (!headers) return NextResponse.json({ error: "Missing webhook signature" }, { status: 401 });

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESEND_WEBHOOK_PAYLOAD_BYTES) {
    return NextResponse.json({ error: "Webhook payload too large" }, { status: 413 });
  }

  const raw = await request.text();
  const payloadBytes = Buffer.byteLength(raw, "utf8");
  if (payloadBytes > MAX_RESEND_WEBHOOK_PAYLOAD_BYTES) {
    return NextResponse.json({ error: "Webhook payload too large" }, { status: 413 });
  }

  let event: ResendEvent;
  try {
    event = (input?.resend || getResend()).webhooks.verify({
      payload: raw,
      headers,
      webhookSecret,
    }) as ResendEvent;
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }
  if (!event.type)
    return NextResponse.json({ error: "Unsupported webhook payload" }, { status: 400 });

  const supabase = input?.tenantContext
    ? createServiceRoleClient(input.tenantContext)
    : createBootstrapServiceRoleClient("legacy-resend-webhook");
  const { error: receiptError } = await supabase.from("webhook_receipts").insert({
    id: headers.id,
    provider: "resend",
    event_type: event.type,
    status: "received",
    payload_hash: createHash("sha256").update(raw).digest("hex"),
  });
  if (receiptError?.code === "23505") return NextResponse.json({ success: true, duplicate: true });
  if (receiptError)
    return NextResponse.json({ error: "Webhook receipt could not be claimed" }, { status: 500 });

  try {
    const providerId = event.data?.email_id;
    const taggedMessageId = event.data?.tags?.revenue_message_id;
    const messageQuery = supabase
      .from("messages")
      .select(
        "id,conversation_id,metadata,delivery_status,delivery_updated_at,conversations!messages_conversation_id_tenant_fkey(contact_id,campaign_id)",
      );
    const { data: message, error: messageError } = providerId
      ? await messageQuery.eq("provider_id", providerId).maybeSingle()
      : taggedMessageId
        ? await messageQuery.eq("id", taggedMessageId).maybeSingle()
        : { data: null, error: null };
    if (messageError) throw new Error(messageError.message);

    const occurredAt = event.created_at ?? new Date().toISOString();
    const deliveryStatus = EVENT_STATUS[event.type];
    const details = event.data?.bounce ?? event.data?.failed ?? null;
    const receivedAfterRecordedStatus =
      !message?.delivery_updated_at ||
      new Date(occurredAt).getTime() >= new Date(message.delivery_updated_at).getTime();
    if (message && deliveryStatus && receivedAfterRecordedStatus) {
      const update: Record<string, unknown> = {
        delivery_status: deliveryStatus,
        delivery_updated_at: occurredAt,
      };
      if (event.type === "email.bounced") update.bounced_at = occurredAt;
      if (event.type === "email.complained") update.complained_at = occurredAt;
      if (
        ["email.bounced", "email.complained", "email.failed", "email.suppressed"].includes(
          event.type,
        )
      )
        update.status = deliveryStatus;
      const { error } = await supabase.from("messages").update(update).eq("id", message.id);
      if (error) throw new Error(error.message);
    }

    const conversation = Array.isArray(message?.conversations)
      ? message?.conversations[0]
      : message?.conversations;
    const contactId = conversation?.contact_id ?? null;
    const campaignId = conversation?.campaign_id ?? event.data?.tags?.revenue_campaign_id ?? null;
    const hardFailure =
      event.type === "email.bounced" ||
      event.type === "email.complained" ||
      event.type === "email.suppressed";
    if (hardFailure && contactId) {
      const reason = event.type.replace("email.", "resend_");
      await suppressContactFromCampaignEmail(supabase, {
        contactId,
        campaignId,
        reason: reason as "resend_bounced" | "resend_complained" | "resend_suppressed",
        source: "webhook",
        sourceReceiptId: headers.id,
      });
    }

    if (message) {
      await recordActivity(supabase, {
        activityType: `resend_${event.type.replace("email.", "").replaceAll(".", "_")}`,
        title: `Email ${event.type.replace("email.", "")}`,
        summary: details ? JSON.stringify(details).slice(0, 700) : `Resend ${event.type} receipt`,
        contactId,
        conversationId: message.conversation_id,
        campaignId,
        source: "webhook",
        externalId: `resend:${headers.id}`,
        occurredAt,
        metadata: { provider_event_type: event.type, provider_id: providerId ?? null },
      });
    }
    await recordAudit(supabase, {
      action: "resend.webhook_processed",
      entityType: "webhook_receipt",
      entityId: headers.id,
      source: "webhook",
      metadata: {
        event_type: event.type,
        provider_id: providerId ?? null,
        message_id: message?.id ?? null,
        hard_failure: hardFailure,
      },
    });
    const { error: completeError } = await supabase
      .from("webhook_receipts")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("id", headers.id);
    if (completeError) throw new Error(completeError.message);
    return NextResponse.json({
      success: true,
      matched: Boolean(message),
      suppressed: hardFailure && Boolean(contactId),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    await supabase
      .from("webhook_receipts")
      .update({ status: "failed", error: message })
      .eq("id", headers.id);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return handleResendWebhook(request);
}
