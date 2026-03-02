import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { getResend, FROM_EMAIL } from "@/lib/email/resend";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { to, subject, body, leadId, recipientName, template } = await request.json();

  if (!to || !subject || !body) {
    return NextResponse.json({ error: "Missing to, subject, or body" }, { status: 400 });
  }

  try {
    const resend = getResend();
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      text: body,
    });

    // Log to sent_emails table
    const supabase = createServiceRoleClient();
    await supabase.from("sent_emails").insert({
      to_email: to,
      to_name: recipientName || null,
      subject,
      body,
      related_type: leadId ? "lead" : null,
      related_id: leadId || null,
      template_used: template || null,
    });

    // Also log to lead notes if leadId provided (backwards compat)
    if (leadId) {
      const { data: lead } = await supabase
        .from("solution_requests")
        .select("notes")
        .eq("id", leadId)
        .single();

      const timestamp = new Date().toLocaleString();
      const noteEntry = `\n[${timestamp}] Email sent: "${subject}"`;
      const updatedNotes = (lead?.notes || "") + noteEntry;

      await supabase
        .from("solution_requests")
        .update({ notes: updatedNotes })
        .eq("id", leadId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send email" },
      { status: 500 }
    );
  }
}
