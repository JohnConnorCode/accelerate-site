import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { runWithTenantRequestContext } from "@/lib/tenancy/context";
import { readBoundedJson } from "@/lib/http/bounded-json";
import {
  blueprintPatchSchema,
  blueprintProposalSchema,
} from "@/lib/revenue-os/architect-review-contract";
import { previewArchitectPatch, proposeArchitectPatch } from "@/lib/revenue-os/architect-review";
const inputSchema = z.discriminatedUnion("mode", [
  blueprintPatchSchema
    .omit({ blueprintId: true })
    .extend({ mode: z.literal("preview") })
    .strict(),
  blueprintProposalSchema
    .omit({ blueprintId: true })
    .extend({ mode: z.literal("propose") })
    .strict(),
]);
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminForModule("core-intelligence");
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;
  const parsed = inputSchema.safeParse(
    await readBoundedJson(request).catch(() => {
      console.warn("Invalid Blueprint command JSON refused");
      return null;
    }),
  );
  if (!z.uuid().safeParse(id).success || !parsed.success)
    return NextResponse.json({ error: "Choose a valid Blueprint operation." }, { status: 400 });
  try {
    const { mode, ...input } = parsed.data;
    return NextResponse.json(
      await runWithTenantRequestContext(auth, () =>
        mode === "preview"
          ? previewArchitectPatch(auth.database, { ...input, blueprintId: id })
          : proposeArchitectPatch(auth.database, { ...input, blueprintId: id }, auth.user.email!),
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Blueprint operation unavailable";
    return NextResponse.json(
      { error: message },
      { status: /conflict|changed/i.test(message) ? 409 : 422 },
    );
  }
}
