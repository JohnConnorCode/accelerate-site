import { NextResponse } from "next/server";
import { z } from "zod";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { listInvoices, runInvoiceCommand } from "@/lib/revenue-os/invoices";

export async function GET(request: Request) {
  const auth = await requireAdminForModule("invoicing");
  if (auth instanceof NextResponse) return auth;
  try {
    const contactId = new URL(request.url).searchParams.get("contactId") || undefined;
    return NextResponse.json(await listInvoices(auth.database, { contactId }));
  } catch (error) {
    console.error("[invoicing] Read failed");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invoices could not be read" },
      { status: 422 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminForModule("invoicing");
  if (auth instanceof NextResponse) return auth;
  let raw: unknown;
  try {
    raw = await readBoundedJson(request, 64000);
  } catch (error) {
    console.warn(
      "[invoicing] Unreadable invoice request",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json({ error: "Invalid invoice request" }, { status: 400 });
  }
  try {
    return NextResponse.json(
      await runInvoiceCommand(auth.database, raw, auth.user.email || "workspace-member"),
    );
  } catch (error) {
    console.error("[invoicing] Command refused");
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? (error.issues[0]?.message ?? "Check the invoice details")
            : error instanceof Error
              ? error.message
              : "The invoice could not be saved",
      },
      { status: 422 },
    );
  }
}
