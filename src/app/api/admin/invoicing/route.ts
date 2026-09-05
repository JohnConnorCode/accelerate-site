import { readBoundedJson } from "@/lib/http/bounded-json";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import {
  stripeBillingChoices,
  readStripeInvoiceForAction,
  proposeStripeInvoiceSend,
} from "@/lib/revenue-os/stripe-invoicing";
export async function GET(request: Request) {
  const auth = await requireAdminForModule("stripe-invoicing");
  if (auth instanceof NextResponse) return auth;
  const params = new URL(request.url).searchParams;
  try {
    const actionId = params.get("actionId");
    if (actionId) {
      if (!z.uuid().safeParse(actionId).success)
        return NextResponse.json({ error: "Invalid invoice operation" }, { status: 400 });
      return NextResponse.json((await readStripeInvoiceForAction(auth.database, actionId)).receipt);
    }
    const choices = await stripeBillingChoices(
      auth.database,
      params.get("search") || "",
      params.get("contactId") || undefined,
    );
    const { data, error } = await auth.database
      .from("action_queue")
      .select("id,action_type,title,description,status,result,error,created_at,payload")
      .in("action_type", [
        "create_stripe_invoice_draft",
        "send_stripe_invoice",
        "publish_invoice_page",
      ])
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error("Invoice operation history is unavailable");
    return NextResponse.json({ ...choices, actions: data ?? [] });
  } catch (error) {
    console.error("[invoicing] Read failed");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invoices could not be read" },
      { status: 422 },
    );
  }
}
export async function POST(request: Request) {
  const auth = await requireAdminForModule("stripe-invoicing");
  if (auth instanceof NextResponse) return auth;
  let raw: unknown;
  try {
    raw = await readBoundedJson(request);
  } catch {
    console.error("[invoicing] Invalid JSON");
    return NextResponse.json({ error: "Invalid invoice request" }, { status: 400 });
  }
  const parsed = z.object({ creationActionId: z.uuid() }).strict().safeParse(raw);
  if (!parsed.success)
    return NextResponse.json({ error: "Choose an existing invoice" }, { status: 400 });
  try {
    return NextResponse.json({
      action: await proposeStripeInvoiceSend(
        auth.database,
        parsed.data.creationActionId,
        auth.user.email || "workspace-member",
      ),
    });
  } catch (error) {
    console.error("[invoicing] Send proposal refused");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invoice sending could not be proposed" },
      { status: 422 },
    );
  }
}
