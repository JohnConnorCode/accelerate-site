import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { recordAudit } from "@/lib/revenue-os/audit";
import { workViewConfigSchema } from "@/lib/admin/work-view-contract";

async function readRequestBody(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    console.error("[work-views] Invalid JSON request");
    return null;
  }
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { data, error } = await auth.database
    .from("work_saved_views")
    .select("id,name,config,visibility,owner_id,updated_at")
    .eq("tenant_id", auth.tenant.id)
    .or(`owner_id.eq.${auth.user.id},visibility.eq.workspace`)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: "Saved views are unavailable" }, { status: 500 });
  return NextResponse.json({
    views: (data ?? []).flatMap((view) => {
      const parsed = workViewConfigSchema.safeParse(view.config);
      return parsed.success
        ? [
            {
              id: view.id,
              name: view.name,
              config: parsed.data,
              visibility: view.visibility,
              ownerId: view.owner_id,
              updatedAt: view.updated_at,
            },
          ]
        : [];
    }),
    viewerId: auth.user.id,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const input = z
    .object({
      name: z.string().trim().min(1).max(80),
      config: workViewConfigSchema,
      visibility: z.enum(["private", "workspace"]),
    })
    .strict()
    .safeParse(await readRequestBody(request));
  if (!input.success)
    return NextResponse.json({ error: "Check the view name and filters" }, { status: 400 });
  const { data, error } = await auth.database
    .from("work_saved_views")
    .insert({ tenant_id: auth.tenant.id, owner_id: auth.user.id, ...input.data })
    .select("id,name,config,visibility,owner_id,updated_at")
    .single();
  if (error)
    return NextResponse.json(
      {
        error:
          error.code === "23505"
            ? "A view with that name already exists"
            : "View could not be saved",
      },
      { status: error.code === "23505" ? 409 : 500 },
    );
  await recordAudit(auth.database, {
    actorEmail: auth.user.email,
    action: "work.view_created",
    entityType: "work_saved_view",
    entityId: data.id,
    after: data,
  });
  return NextResponse.json({ view: data });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const input = z
    .object({
      id: z.uuid(),
      name: z.string().trim().min(1).max(80),
      config: workViewConfigSchema,
      visibility: z.enum(["private", "workspace"]),
    })
    .strict()
    .safeParse(await readRequestBody(request));
  if (!input.success)
    return NextResponse.json({ error: "Check the view name and filters" }, { status: 400 });
  const { data: before, error: readError } = await auth.database
    .from("work_saved_views")
    .select("id,name,config,visibility,owner_id,updated_at")
    .eq("tenant_id", auth.tenant.id)
    .eq("owner_id", auth.user.id)
    .eq("id", input.data.id)
    .maybeSingle();
  if (readError || !before)
    return NextResponse.json({ error: "Saved view not found" }, { status: 404 });
  const { data, error } = await auth.database
    .from("work_saved_views")
    .update({
      name: input.data.name,
      config: input.data.config,
      visibility: input.data.visibility,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", auth.tenant.id)
    .eq("owner_id", auth.user.id)
    .eq("id", input.data.id)
    .select("id,name,config,visibility,owner_id,updated_at")
    .maybeSingle();
  if (error || !data)
    return NextResponse.json(
      {
        error:
          error?.code === "23505"
            ? "A view with that name already exists"
            : "View could not be saved",
      },
      { status: error?.code === "23505" ? 409 : 500 },
    );
  await recordAudit(auth.database, {
    actorEmail: auth.user.email,
    action: "work.view_updated",
    entityType: "work_saved_view",
    entityId: data.id,
    before,
    after: data,
  });
  return NextResponse.json({ view: data });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const id = z.uuid().safeParse(request.nextUrl.searchParams.get("id"));
  if (!id.success) return NextResponse.json({ error: "Choose a saved view" }, { status: 400 });
  const { data, error } = await auth.database
    .from("work_saved_views")
    .delete()
    .eq("tenant_id", auth.tenant.id)
    .eq("owner_id", auth.user.id)
    .eq("id", id.data)
    .select("id,name,config")
    .maybeSingle();
  if (error || !data)
    return NextResponse.json({ error: "View could not be removed" }, { status: 404 });
  await recordAudit(auth.database, {
    actorEmail: auth.user.email,
    action: "work.view_removed",
    entityType: "work_saved_view",
    entityId: data.id,
    before: data,
  });
  return NextResponse.json({ success: true });
}
