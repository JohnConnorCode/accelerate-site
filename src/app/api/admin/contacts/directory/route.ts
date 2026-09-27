import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { recordAudit } from "@/lib/revenue-os/audit";

const newContact = z
  .object({
    name: z.string().trim().min(1).max(200),
    email: z.string().trim().toLowerCase().email().max(254),
    phone: z.string().trim().max(80).optional(),
  })
  .strict();

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Math.min(10000, Number(params.get("page")) || 1));
  const search = params.get("search")?.trim().slice(0, 100) ?? "";
  const offset = (page - 1) * 50;
  let query = auth.database
    .from("contacts")
    .select(
      "id,full_name,primary_email,phone,title,lifecycle_stage,communication_status,next_action,next_action_at,company_id,created_at,updated_at",
      { count: "exact" },
    )
    .eq("tenant_id", auth.tenant.id)
    .order("updated_at", { ascending: false })
    .range(offset, offset + 49);
  if (search) {
    const escaped = search.replace(/[%,()]/g, "");
    query = query.or(`full_name.ilike.%${escaped}%,primary_email.ilike.%${escaped}%`);
  }
  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: "Contacts could not be loaded" }, { status: 500 });
  return NextResponse.json({ contacts: data ?? [], total: count ?? 0, page, pageSize: 50 });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const body = newContact.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return NextResponse.json({ error: "Enter a name and valid email address" }, { status: 400 });

  const { data, error } = await auth.database
    .from("contacts")
    .insert({
      tenant_id: auth.tenant.id,
      full_name: body.data.name,
      primary_email: body.data.email,
      phone: body.data.phone || null,
      source: "manual",
    })
    .select("id,full_name,primary_email")
    .single();
  if (error?.code === "23505")
    return NextResponse.json(
      { error: "A contact with this email already exists" },
      { status: 409 },
    );
  if (error || !data)
    return NextResponse.json({ error: "Contact could not be added" }, { status: 500 });
  await recordAudit(auth.database, {
    actorEmail: auth.user.email,
    action: "contact.created",
    entityType: "contact",
    entityId: data.id,
    after: data,
  });
  return NextResponse.json({ contact: data }, { status: 201 });
}
