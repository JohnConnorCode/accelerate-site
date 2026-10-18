import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { runWithTenantRequestContext } from "@/lib/tenancy/context";
import { readAiSpendControls, saveAiSpendControls } from "@/lib/ai/spend-controls";
import { assertCurrentTenantAdmin } from "@/lib/revenue-os/tenant-admin-authority";
import { updateCoworkerStatus } from "@/lib/revenue-os/coworkers";
import { aiSpendPolicySchema } from "@/lib/ai/spend-controls-contract";

export async function GET() {
  const auth = await requireAdminForModule("core-intelligence");
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(
      await runWithTenantRequestContext(auth, () => readAiSpendControls(auth.database)),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error(
      "AI cost controls read failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json(
      { error: "AI cost controls are unavailable. Try refreshing." },
      { status: 503 },
    );
  }
}
export async function PUT(request: Request) {
  const auth = await requireAdminForModule("core-intelligence");
  if (auth instanceof NextResponse) return auth;
  const input = z
    .object({ revision: z.number().int().min(0), policy: aiSpendPolicySchema })
    .strict()
    .safeParse(
      await readBoundedJson(request).catch(() => {
        console.warn("Invalid AI controls request body");
        return null;
      }),
    );
  if (!input.success)
    return NextResponse.json(
      { error: "Enter valid AI controls and finite limits" },
      { status: 400 },
    );
  try {
    return NextResponse.json(
      await runWithTenantRequestContext(auth, () =>
        saveAiSpendControls(auth.database, input.data, auth.user.email!),
      ),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI controls could not be saved" },
      { status: 409 },
    );
  }
}
export async function PATCH(request: Request) {
  const auth = await requireAdminForModule("core-intelligence");
  if (auth instanceof NextResponse) return auth;
  const input = z
    .object({
      id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,99}$/),
      status: z.enum(["active", "paused"]),
    })
    .strict()
    .safeParse(
      await readBoundedJson(request).catch(() => {
        console.warn("Invalid AI controls request body");
        return null;
      }),
    );
  if (!input.success)
    return NextResponse.json({ error: "Choose an existing coworker and status" }, { status: 400 });
  try {
    return NextResponse.json(
      await runWithTenantRequestContext(auth, async () => {
        await assertCurrentTenantAdmin(auth.database, auth.user.email!);
        await updateCoworkerStatus(
          auth.database,
          input.data.id,
          input.data.status,
          auth.user.email!,
        );
        return readAiSpendControls(auth.database);
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Coworker control failed" },
      { status: 409 },
    );
  }
}
