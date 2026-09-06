import { runWithTenantRequestContext } from "@/lib/tenancy/context";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { readWorkspaceBrand, saveWorkspaceBrandAsAdmin } from "@/lib/revenue-os/branding";
import { workspaceBrandSchema } from "@/lib/revenue-os/branding-contract";
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(await readWorkspaceBrand(auth.database));
  } catch {
    console.error("[branding] Read failed");
    return NextResponse.json({ error: "Branding is unavailable" }, { status: 503 });
  }
}
export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const parsed = z
      .object({ brand: workspaceBrandSchema, revision: z.string().regex(/^[a-f0-9]{64}$/) })
      .strict()
      .parse(await readBoundedJson(request));
    return NextResponse.json(
      await runWithTenantRequestContext(auth, () =>
        saveWorkspaceBrandAsAdmin(
          auth.database,
          parsed.brand,
          parsed.revision,
          auth.user.email || "workspace-member",
        ),
      ),
    );
  } catch (error) {
    console.error("[branding] Save refused");
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? "Check the branding fields and try again"
            : error instanceof Error
              ? error.message
              : "Branding could not be saved",
      },
      { status: 409 },
    );
  }
}
