import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { recordAudit } from "@/lib/revenue-os/audit";

const contactFields = z
  .object({
    fullName: z.string().trim().min(1).max(200),
    email: z.email().trim().toLowerCase().nullable(),
    phone: z.string().trim().max(60).nullable(),
    title: z.string().trim().max(120).nullable(),
    lifecycleStage: z.string().trim().min(1).max(80),
    nextAction: z.string().trim().max(500).nullable(),
    nextActionAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .superRefine((contact, context) => {
    if (!contact.email && !contact.phone)
      context.addIssue({
        code: "custom",
        path: ["email"],
        message: "Add an email or phone number",
      });
  });
const writeSchema = contactFields.extend({
  id: z.uuid().optional(),
  updatedAt: z.iso.datetime({ offset: true }).optional(),
});

async function readRequestBody(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    console.error("[contacts-directory] Invalid JSON request");
    return null;
  }
}

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
  const parsed = writeSchema.safeParse(await readRequestBody(request));
  if (!parsed.success)
    return NextResponse.json({ error: "Check the contact fields" }, { status: 400 });
  const { id, updatedAt, fullName, email, phone, title, lifecycleStage, nextAction, nextActionAt } =
    parsed.data;
  if (id && !updatedAt)
    return NextResponse.json({ error: "Reload the contact before editing" }, { status: 400 });
  const row = {
    full_name: fullName,
    first_name: fullName.split(/\s+/)[0] ?? "",
    last_name: fullName.split(/\s+/).slice(1).join(" "),
    primary_email: email,
    phone,
    title,
    lifecycle_stage: lifecycleStage,
    next_action: nextAction,
    next_action_at: nextActionAt,
    updated_at: new Date().toISOString(),
  };
  const db = auth.database;
  const current = id
    ? await db
        .from("contacts")
        .select("*")
        .eq("tenant_id", auth.tenant.id)
        .eq("id", id)
        .maybeSingle()
    : null;
  if (current?.error)
    return NextResponse.json({ error: "Contact could not be loaded" }, { status: 500 });
  if (id && !current?.data)
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  if (
    !["lead", "prospect", "customer", "former_customer"].includes(lifecycleStage) &&
    current?.data?.lifecycle_stage !== lifecycleStage
  )
    return NextResponse.json({ error: "Choose a supported lifecycle stage" }, { status: 400 });
  if (id && current?.data?.updated_at !== updatedAt)
    return NextResponse.json(
      { error: "This contact changed. Reload before saving." },
      { status: 409 },
    );
  const result = id
    ? await db
        .from("contacts")
        .update(row)
        .eq("tenant_id", auth.tenant.id)
        .eq("id", id)
        .eq("updated_at", updatedAt!)
        .select()
        .maybeSingle()
    : await db
        .from("contacts")
        .insert({ ...row, tenant_id: auth.tenant.id, source: "admin" })
        .select()
        .single();
  if (id && !result.data && !result.error)
    return NextResponse.json(
      { error: "This contact changed. Reload before saving." },
      { status: 409 },
    );
  if (result.error) {
    const duplicate = result.error.code === "23505";
    return NextResponse.json(
      {
        error: duplicate
          ? "A contact with this email already exists"
          : "Contact could not be saved",
      },
      { status: duplicate ? 409 : 500 },
    );
  }
  await recordAudit(db, {
    actorEmail: auth.user.email,
    action: id ? "update_contact" : "create_contact",
    entityType: "contact",
    entityId: result.data!.id,
    before: current?.data ?? null,
    after: result.data,
  });
  return NextResponse.json({ contact: result.data });
}
