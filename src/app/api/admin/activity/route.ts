import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  timestamp: string;
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  const activities: ActivityItem[] = [];

  // Fetch recent items from multiple tables in parallel
  const [leads, contacts, subscribers, partners, grades, sequences] = await Promise.all([
    supabase
      .from("solution_requests")
      .select("id, contact_name, contact_email, created_at")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("contact_submissions")
      .select("id, name, email, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("subscribers")
      .select("id, email, subscribed_at")
      .order("subscribed_at", { ascending: false })
      .limit(10),
    supabase
      .from("partner_applications")
      .select("id, name, company, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("website_grades")
      .select("id, url, email, overall_score, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("email_sequences")
      .select("id, email, sequence_type, status, started_at")
      .order("started_at", { ascending: false })
      .limit(10),
  ]);

  // Map to activity items
  if (leads.data) {
    for (const l of leads.data) {
      activities.push({
        id: `lead-${l.id}`,
        type: "lead",
        description: `New lead: ${l.contact_name} (${l.contact_email})`,
        timestamp: l.created_at,
      });
    }
  }

  if (contacts.data) {
    for (const c of contacts.data) {
      activities.push({
        id: `contact-${c.id}`,
        type: "contact",
        description: `Contact form: ${c.name} (${c.email})`,
        timestamp: c.created_at,
      });
    }
  }

  if (subscribers.data) {
    for (const s of subscribers.data) {
      activities.push({
        id: `sub-${s.id}`,
        type: "subscriber",
        description: `New subscriber: ${s.email}`,
        timestamp: s.subscribed_at,
      });
    }
  }

  if (partners.data) {
    for (const p of partners.data) {
      activities.push({
        id: `partner-${p.id}`,
        type: "partner",
        description: `Partner application: ${p.name} from ${p.company}`,
        timestamp: p.created_at,
      });
    }
  }

  if (grades.data) {
    for (const g of grades.data) {
      activities.push({
        id: `grade-${g.id}`,
        type: "grade",
        description: `Website graded: ${g.url} (Score: ${g.overall_score}/100)`,
        timestamp: g.created_at,
      });
    }
  }

  if (sequences.data) {
    for (const s of sequences.data) {
      activities.push({
        id: `seq-${s.id}`,
        type: "email",
        description: `Email sequence ${s.status}: ${s.sequence_type.replace(/_/g, " ")} for ${s.email}`,
        timestamp: s.started_at,
      });
    }
  }

  // Sort by timestamp desc and limit to 50
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return NextResponse.json({
    activities: activities.slice(0, 50),
  });
}
