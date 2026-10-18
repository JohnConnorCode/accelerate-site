import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { runWithTenantRequestContext } from "@/lib/tenancy/context";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { billingCommandSchema } from "@/lib/revenue-os/billing-command-contract";
import {
  previewBillingCommand,
  proposeBillingCommand,
  readBillingActionReceipt,
} from "@/lib/revenue-os/billing-workspace";

const input = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("preview"), command: billingCommandSchema }).strict(),
  z
    .object({
      mode: z.literal("propose"),
      command: billingCommandSchema,
      digest: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict(),
]);
export async function POST(request: Request) {
  const auth = await requireAdminForModule("stripe-invoicing");
  if (auth instanceof NextResponse) return auth;
  const parsed = input.safeParse(
    await readBoundedJson(request).catch(() => {
      console.warn("[billing] Invalid command JSON refused");
      return null;
    }),
  );
  if (!parsed.success)
    return NextResponse.json({ error: "Choose a valid billing operation." }, { status: 400 });
  try {
    const command = parsed.data;
    return NextResponse.json(
      await runWithTenantRequestContext(auth, () =>
        command.mode === "preview"
          ? previewBillingCommand(auth.database, command.command)
          : proposeBillingCommand(auth.database, command.command, command.digest, auth.user.email!),
      ),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Billing operation could not be prepared.",
      },
      { status: 422 },
    );
  }
}

export async function GET(request: Request) {
  const auth = await requireAdminForModule("stripe-invoicing");
  if (auth instanceof NextResponse) return auth;
  const actionId = new URL(request.url).searchParams.get("actionId");
  if (!z.uuid().safeParse(actionId).success)
    return NextResponse.json({ error: "Choose an existing billing action." }, { status: 400 });
  try {
    return NextResponse.json(await readBillingActionReceipt(auth.database, actionId!));
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "The provider result could not be checked.",
      },
      { status: 422 },
    );
  }
}
