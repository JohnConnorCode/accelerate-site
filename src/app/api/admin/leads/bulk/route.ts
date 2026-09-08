import { NextRequest, NextResponse } from "next/server";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import {
  bulkEnrollContacts,
  bulkSuppressContacts,
  bulkTagContacts,
} from "@/lib/revenue-os/contact-bulk";

const ACTIONS = new Set(["tag", "suppress", "enroll"]);

export async function POST(request: NextRequest) {
  const auth = await requireAdminForModule("leads-capture");
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json()) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "";
  if (!ACTIONS.has(action))
    return NextResponse.json({ error: "Action must be tag, suppress, or enroll" }, { status: 400 });
  const supabase = auth.database;
  const actorEmail = auth.user.email || "founder";
  try {
    if (action === "tag")
      return NextResponse.json(
        await bulkTagContacts(supabase, {
          contactIds: body.contactIds,
          add: body.add,
          remove: body.remove,
          actorEmail,
        }),
      );
    if (action === "suppress")
      return NextResponse.json(
        await bulkSuppressContacts(supabase, { contactIds: body.contactIds, actorEmail }),
      );
    const campaignId = typeof body.campaignId === "string" ? body.campaignId : "";
    if (!campaignId)
      return NextResponse.json({ error: "Enroll needs a campaignId" }, { status: 400 });
    return NextResponse.json(
      await bulkEnrollContacts(supabase, { campaignId, contactIds: body.contactIds, actorEmail }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bulk operation failed" },
      { status: 400 },
    );
  }
}
