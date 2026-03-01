import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { getResend, FROM_EMAIL } from "@/lib/email/resend";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { to, subject, body, leadId } = await request.json();

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

    // Log to lead notes if leadId provided
    if (leadId) {
      const supabase = createServiceRoleClient();
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
