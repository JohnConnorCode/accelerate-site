import { readBoundedJson } from "@/lib/http/bounded-json";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import {
  generateInvoiceDesign,
  previewInvoicePage,
  proposeInvoicePage,
  listInvoicePages,
  revokeInvoicePage,
} from "@/lib/revenue-os/invoice-pages";
import { invoiceDesignSchema, defaultInvoiceDesign } from "@/lib/revenue-os/invoice-page-contract";
const schema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("generate"),
      creationActionId: z.uuid(),
      brief: z.string().trim().min(1).max(1000),
      currentDesign: invoiceDesignSchema.optional(),
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
    const url = new URL(request.url);
    const creationActionId = z.uuid().parse(url.searchParams.get("creationActionId"));
    const pages = await listInvoicePages(auth.database, creationActionId);
    const currentDesign =
      pages.find((page) => !page.revokedAt && Date.parse(page.expiresAt) > Date.now())?.design ||
      defaultInvoiceDesign;
    return NextResponse.json({
      pages,
      tenantSlug: auth.tenant.slug,
      ...(url.searchParams.get("view") === "designer"
        ? { preview: await previewInvoicePage(auth.database, creationActionId, currentDesign) }
        : {}),
    });
  } catch {
    console.error("[invoice-pages] Read failed");
    return NextResponse.json(
      { error: "Invoice page could not be loaded. Try again." },
      { status: 422 },
    );
  }
}
export async function POST(request: Request) {
  const auth = await requireAdminForModule("stripe-invoicing");
  if (auth instanceof NextResponse) return auth;
  try {
    const input = schema.parse(await readBoundedJson(request));
    const actor = auth.user.email || "workspace-member";
    if (input.mode === "generate") {
      const rateLimitResult = await rateLimit(`invoice-design:${auth.tenant.id}`, 20, 3600000);
      if (!rateLimitResult.success)
        return rateLimitResponse(rateLimitResult, {
          error: "Invoice design limit reached. Try again later.",
        });
      return NextResponse.json(
        await generateInvoiceDesign(
          auth.database,
          input.creationActionId,
          input.brief,
          actor,
          input.currentDesign,
        ),
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
