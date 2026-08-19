import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { sendRecordedEmail } from "@/lib/revenue-os/communications";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

const SEND_LIMIT = 60;
const SEND_WINDOW_MS = 60 * 60 * 1000;

interface AuditResult {
  error: { message: string } | null;
}

async function tryAuditLog(
  fn: () => Promise<AuditResult>,
  label: string,
): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fn();
    if (!res.error) return true;
    console.error(`[send-email] ${label} attempt ${attempt + 1} failed:`, res.error.message);
    if (attempt === 0) await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const adminKey = auth.user.email ?? auth.user.id;
  const { success } = rateLimit(`admin-send-email:${adminKey}`, SEND_LIMIT, SEND_WINDOW_MS);
  if (!success) {
    return NextResponse.json(
      { error: "Rate limit reached (60/hour). Wait a moment and try again." },
      { status: 429 },
    );
  }

  const { to, subject, body, leadId, template } = await request.json();

  if (!to || !subject || !body) {
    return NextResponse.json({ error: "Missing to, subject, or body" }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const warnings: string[] = [];

  // Every founder send uses the canonical Resend receipt path. Legacy lead
  // notes below remain a compatibility projection, never the source of truth.
  try {
    await sendRecordedEmail(supabase, {
      to,
      subject,
      text: body,
      actorEmail: auth.user.email ?? undefined,
      template: template || undefined,
      source: "admin",
      idempotencyKey: request.headers.get("idempotency-key") || undefined,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send email" },
      { status: 500 },
    );
  }

  if (leadId) {
    try {
      const { data: lead, error: leadErr } = await supabase
        .from("solution_requests")
        .select("notes")
        .eq("id", leadId)
        .single();
      if (leadErr) throw leadErr;
      const timestamp = new Date().toLocaleString();
      const noteEntry = `\n[${timestamp}] Email sent: "${subject}"`;
      const updatedNotes = (lead?.notes || "") + noteEntry;
      const noteOk = await tryAuditLog(async () => {
        const { error } = await supabase
          .from("solution_requests")
          .update({ notes: updatedNotes })
          .eq("id", leadId);
        return { error: error ? { message: error.message } : null };
      }, "lead notes update");
      if (!noteOk) warnings.push("Email was sent but couldn't be appended to lead notes.");
    } catch (err) {
      console.error("[send-email] lead notes lookup failed:", err);
      warnings.push("Email was sent but couldn't be appended to lead notes.");
    }
  }

  if (warnings.length > 0) {
    return NextResponse.json({ success: true, warning: warnings.join(" ") });
  }
  return NextResponse.json({ success: true });
}
