import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createBootstrapServiceRoleClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { TenantSystemContext } from "@/lib/tenancy/context";
import { suppressContactFromCampaignEmail } from "@/lib/revenue-os/campaign-stops";

const tokenSchema = z.string().uuid();

export async function unsubscribe(context: { params: Promise<{ token: string }> }, tenantContext?: TenantSystemContext) {
  const parsed = tokenSchema.safeParse((await context.params).token);
  if (!parsed.success) return NextResponse.json({ success: true });
  const supabase = tenantContext ? createServiceRoleClient(tenantContext) : createBootstrapServiceRoleClient("legacy-public-unsubscribe");
  const { data: contact } = await supabase.from("contacts").select("id,primary_email,communication_status").eq("unsubscribe_token", parsed.data).maybeSingle();
  if (!contact) return NextResponse.json({ success: true });
  if (contact.communication_status !== "unsubscribed") {
    await suppressContactFromCampaignEmail(supabase, { contactId: contact.id, reason: "public_unsubscribe", source: "webhook", sourceReceiptId: `unsubscribe:${contact.id}` });
  }
  return NextResponse.json({ success: true });
}

export async function POST(_request: NextRequest, context: { params: Promise<{ token: string }> }) { return unsubscribe(context); }
export async function GET(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  await unsubscribe(context);
  return new NextResponse("You have been unsubscribed from campaign email. You may close this page.", { headers: { "content-type": "text/plain; charset=utf-8" } });
}
