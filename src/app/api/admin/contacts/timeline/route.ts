import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "Email parameter required" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // Query all tables in parallel
  const [
    solutionRes,
    contactRes,
    subscriberRes,
    chatRes,
    resourceRes,
    emailSeqRes,
    gradeRes,
    taskRes,
    sentEmailRes,
  ] = await Promise.all([
    supabase
      .from("solution_requests")
      .select("id, contact_name, business_name, industry, lead_status, created_at, estimated_value")
      .eq("contact_email", email),
    supabase
      .from("contact_submissions")
      .select("id, name, message, business_type, created_at")
      .eq("email", email),
    supabase
      .from("subscribers")
      .select("id, source, subscribed_at, unsubscribed_at")
      .eq("email", email),
    supabase
      .from("chat_leads")
      .select("id, name, conversation, created_at")
      .eq("email", email),
    supabase
      .from("resource_downloads")
      .select("id, resource_id, name, downloaded_at")
      .eq("email", email),
    supabase
      .from("email_sequences")
      .select("id, sequence_name, status, created_at")
      .eq("email", email),
    supabase
      .from("website_grades")
      .select("id, url, overall_score, created_at")
      .eq("email", email),
    supabase
      .from("tasks")
      .select("id, title, description, status, due_date, priority, created_at")
      .eq("related_name", email),
    supabase
      .from("sent_emails")
      .select("id, subject, body, template_used, sent_at")
      .eq("to_email", email),
  ]);

  // Build unified timeline
  interface TimelineItem {
    type: string;
    title: string;
    description: string;
    timestamp: string;
    sourceId: string;
    link: string;
  }

  const timeline: TimelineItem[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (solutionRes.data || []).forEach((r: any) => {
    timeline.push({
      type: "lead",
      title: `Plan request — ${r.industry?.replace(/_/g, " ") || "Unknown"}`,
      description: `Business: ${r.business_name || "N/A"} · Status: ${r.lead_status || "new"}${r.estimated_value ? ` · $${r.estimated_value.toLocaleString()}` : ""}`,
      timestamp: r.created_at,
      sourceId: r.id,
      link: "/admin/leads",
    });
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (contactRes.data || []).forEach((r: any) => {
    timeline.push({
      type: "contact",
      title: `Contact form — ${r.name}`,
      description: r.message?.substring(0, 120) || "No message",
      timestamp: r.created_at,
      sourceId: r.id,
      link: "/admin/contacts",
    });
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (subscriberRes.data || []).forEach((r: any) => {
    timeline.push({
      type: "subscriber",
      title: `Newsletter ${r.unsubscribed_at ? "unsubscribed" : "subscribed"}`,
      description: `Source: ${r.source || "website"}`,
      timestamp: r.subscribed_at,
      sourceId: r.id,
      link: "/admin/subscribers",
    });
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (chatRes.data || []).forEach((r: any) => {
    const msgCount = Array.isArray(r.conversation) ? r.conversation.length : 0;
    timeline.push({
      type: "chat",
      title: `Chat conversation — ${r.name}`,
      description: `${msgCount} message${msgCount !== 1 ? "s" : ""}`,
      timestamp: r.created_at,
      sourceId: r.id,
      link: "/admin/chat-leads",
    });
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (resourceRes.data || []).forEach((r: any) => {
    timeline.push({
      type: "resource",
      title: `Downloaded: ${r.resource_id?.replace(/[-_]/g, " ") || "resource"}`,
      description: `By: ${r.name || email}`,
      timestamp: r.downloaded_at,
      sourceId: r.id,
      link: "/admin/resources",
    });
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (emailSeqRes.data || []).forEach((r: any) => {
    timeline.push({
      type: "email",
      title: `Email sequence: ${r.sequence_name || "Unknown"}`,
      description: `Status: ${r.status || "unknown"}`,
      timestamp: r.created_at,
      sourceId: r.id,
      link: "/admin/email-sequences",
    });
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (gradeRes.data || []).forEach((r: any) => {
    timeline.push({
      type: "grade",
      title: `Website graded: ${r.url}`,
      description: `Score: ${r.overall_score}/100`,
      timestamp: r.created_at,
      sourceId: r.id,
      link: "/admin/website-grades",
    });
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (taskRes.data || []).forEach((r: any) => {
    timeline.push({
      type: "task",
      title: `Task: ${r.title}`,
      description: `${r.status === "completed" ? "Completed" : r.status === "snoozed" ? "Snoozed" : "Pending"}${r.due_date ? ` · Due: ${r.due_date}` : ""} · Priority: ${r.priority}`,
      timestamp: r.created_at,
      sourceId: r.id,
      link: "/admin",
    });
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (sentEmailRes.data || []).forEach((r: any) => {
    timeline.push({
      type: "email_sent",
      title: `Email sent: ${r.subject}`,
      description: r.body?.substring(0, 120) || "No content",
      timestamp: r.sent_at,
      sourceId: r.id,
      link: "/admin",
    });
  });

  // Sort chronologically (newest first)
  timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return NextResponse.json({ timeline, email });
}
