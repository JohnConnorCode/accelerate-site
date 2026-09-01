import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { proposalAuditSummary, recordAudit } from "@/lib/revenue-os/audit";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = auth.database;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const id = searchParams.get("id");

  if (id) {
    const { data, error } = await supabase.from("proposals").select("*").eq("id", id).single();

    if (error) {
      console.error("Database error:", error.message);
      return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
    }
    return NextResponse.json({ proposal: data });
  }

  let query = supabase.from("proposals").select("*").order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  const totalOneTime = (data || []).reduce(
    (s: number, p: { total_one_time?: number; status: string }) =>
      p.status !== "declined" ? s + (p.total_one_time || 0) : s,
    0,
  );
  const totalMonthly = (data || []).reduce(
    (s: number, p: { total_monthly?: number; status: string }) =>
      p.status !== "declined" ? s + (p.total_monthly || 0) : s,
    0,
  );

  return NextResponse.json({
    proposals: data || [],
    totalOneTime,
    totalMonthly,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = auth.database;
  const body = await request.json();

  const { nanoid } = await import("nanoid");
  const shareToken = nanoid(16);

  const { lead_id, client_name, title, content, total_one_time, total_monthly } = body;

  if (!client_name || !title) {
    return NextResponse.json({ error: "Client name and title are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("proposals")
    .insert({
      lead_id: lead_id || null,
      client_name,
      share_token: shareToken,
      title,
      content: content || { sections: [] },
      total_one_time: total_one_time || 0,
      total_monthly: total_monthly || 0,
      status: "draft",
    })
    .select()
    .single();

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  await recordAudit(supabase, {
    actorEmail: auth.user.email,
    action: "proposal.created",
    entityType: "proposal",
    entityId: data.id,
    after: proposalAuditSummary(data),
  });

  return NextResponse.json({ proposal: data });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = auth.database;
  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "Proposal id is required" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

  const allowedFields = [
    "title",
    "content",
    "total_one_time",
    "total_monthly",
    "status",
    "client_name",
  ];
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      updateData[field] = updates[field];
    }
  }

  if (updates.status === "sent") {
    updateData.sent_at = new Date().toISOString();
  }

  const { data: before } = await supabase
    .from("proposals")
    .select("id,title,status,client_name,total_one_time,total_monthly,lead_id,opportunity_id")
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("proposals")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  await recordAudit(supabase, {
    actorEmail: auth.user.email,
    action: updates.status === "sent" ? "proposal.sent" : "proposal.updated",
    entityType: "proposal",
    entityId: data.id,
    before: proposalAuditSummary(before),
    after: proposalAuditSummary(data),
  });

  return NextResponse.json({ proposal: data });
}
