import { NextRequest, NextResponse } from "next/server";
import { requireAdminForModule } from "@/lib/admin/module-guard";

export async function GET(request: NextRequest) {
  const auth = await requireAdminForModule("email-studio");
  if (auth instanceof NextResponse) return auth;
  const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 50));
  const supabase = auth.database;
  const [legacy, canonical] = await Promise.all([
    supabase
      .from("sent_emails")
      .select(
        "id, to_email, to_name, subject, body, template_used, created_at, related_type, related_id",
      )
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("messages")
      .select(
        "id, recipient_emails, subject, body_text, status, provider_message_id, sent_at, created_at, metadata",
      )
      .eq("direction", "outbound")
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);
  const rows = [
    ...(legacy.data || []).map((item) => ({
      id: `legacy:${item.id}`,
      to: item.to_email,
      toName: item.to_name,
      subject: item.subject,
      body: item.body,
      status: "sent",
      providerId: null,
      template: item.template_used,
      sentAt: item.created_at,
      relatedType: item.related_type,
      relatedId: item.related_id,
      source: "operator",
    })),
    ...(canonical.data || []).map((item) => ({
      id: `message:${item.id}`,
      to: item.recipient_emails?.join(", ") || "Unknown",
      toName: null,
      subject: item.subject,
      body: item.body_text,
      status: item.status,
      providerId: item.provider_message_id,
      template: item.metadata?.template_key || null,
      sentAt: item.sent_at || item.created_at,
      relatedType: "conversation",
      relatedId: null,
      source: "canonical",
    })),
  ]
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
    .slice(0, limit);
  return NextResponse.json({ history: rows, partial: Boolean(legacy.error || canonical.error) });
}
