import { readBoundedJson } from "@/lib/http/bounded-json";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { rateLimit } from "@/lib/rate-limit";
import {
  generateInvoiceDesign,
  previewInvoicePage,
  proposeInvoicePage,
  listInvoicePages,
  revokeInvoicePage,
} from "@/lib/revenue-os/invoice-pages";
import { invoiceDesignSchema } from "@/lib/revenue-os/invoice-page-contract";
const schema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("generate"),
      creationActionId: z.uuid(),
      brief: z.string().trim().min(1).max(1000),
    })
    .strict(),
  z
    .object({ mode: z.literal("preview"), creationActionId: z.uuid(), design: invoiceDesignSchema })
    .strict(),
  z
    .object({
      mode: z.literal("propose"),
      creationActionId: z.uuid(),
      design: invoiceDesignSchema,
      digest: z.string().regex(/^[a-f0-9]{64}$/),
      requestId: z.uuid(),
    })
    .strict(),
  z.object({ mode: z.literal("revoke"), pageId: z.uuid() }).strict(),
]);
export async function GET(request: Request) {
  const auth = await requireAdminForModule("stripe-invoicing");
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json({
      pages: await listInvoicePages(
        auth.database,
        z.uuid().parse(new URL(request.url).searchParams.get("creationActionId")),
      ),
      tenantSlug: auth.tenant.slug,
    });
  } catch {
    console.error("[invoice-pages] Read failed");
    return NextResponse.json({ error: "Published pages could not be read" }, { status: 422 });
  }
}
export async function POST(request: Request) {
  const auth = await requireAdminForModule("stripe-invoicing");
  if (auth instanceof NextResponse) return auth;
  try {
    const input = schema.parse(await readBoundedJson(request));
    const actor = auth.user.email || "workspace-member";
    if (input.mode === "generate") {
      if (!rateLimit(`invoice-design:${auth.tenant.id}`, 20, 3600000).success)
        return NextResponse.json(
          { error: "Invoice design limit reached. Try again later." },
          { status: 429 },
        );
      return NextResponse.json(
        await generateInvoiceDesign(auth.database, input.creationActionId, input.brief, actor),
      );
    }
    if (input.mode === "preview")
      return NextResponse.json(
        await previewInvoicePage(auth.database, input.creationActionId, input.design),
      );
    if (input.mode === "revoke")
      return NextResponse.json(await revokeInvoicePage(auth.database, input.pageId, actor));
    return NextResponse.json({ action: await proposeInvoicePage(auth.database, input, actor) });
  } catch (error) {
    console.error("[invoice-pages] Request refused");
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? "Check the page design inputs"
            : error instanceof Error
              ? error.message
              : "Invoice page request failed",
      },
      { status: 422 },
    );
  }
}
