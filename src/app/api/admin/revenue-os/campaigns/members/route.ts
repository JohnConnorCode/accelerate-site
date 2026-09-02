import { NextRequest, NextResponse } from "next/server";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { normalizeEmail } from "@/lib/revenue-os/db";
import { findCanonicalContactByEmail } from "@/lib/revenue-os/identity";

export async function POST(request: NextRequest) {
  const auth = await requireAdminForModule("campaigns");
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json()) as {
    campaignId?: string;
    members?: Array<{ email?: string; contactId?: string; opportunityId?: string }>;
  };
  if (
    !body.campaignId ||
    !Array.isArray(body.members) ||
    !body.members.length ||
    body.members.length > 500
  ) {
    return NextResponse.json({ error: "Supply a campaign and 1–500 members" }, { status: 400 });
  }

  const supabase = auth.database;
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id,status")
    .eq("id", body.campaignId)
    .maybeSingle();
  if (campaignError) return NextResponse.json({ error: campaignError.message }, { status: 400 });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  // A member without a canonical contact can never be sent to: the claim
  // function resolves the contact to check suppression and returns without
  // claiming when there is none. Previously the admin posted bare emails, so
  // every member added here was silently unsendable forever. Resolve the
  // contact now and refuse the ones we cannot, rather than storing dead rows.
  const resolved = await Promise.all(
    body.members.map(async (member) => {
      const email = normalizeEmail(member.email);
      if (!email)
        return {
          email: "",
          contactId: null as string | null,
          opportunityId: member.opportunityId || null,
        };
      if (member.contactId)
        return { email, contactId: member.contactId, opportunityId: member.opportunityId || null };
      const match = await findCanonicalContactByEmail(supabase, email);
      return { email, contactId: match?.id ?? null, opportunityId: member.opportunityId || null };
    }),
  );

  const invalid = resolved.filter((row) => !row.email).length;
  if (invalid)
    return NextResponse.json({ error: "Every member needs a valid email" }, { status: 400 });

  const unknown = resolved.filter((row) => !row.contactId).map((row) => row.email);
  if (unknown.length) {
    return NextResponse.json(
      {
        error: `${unknown.length} recipient${unknown.length === 1 ? " has" : "s have"} no contact record yet, so they could never be sent to. Import them first, then add them to the campaign.`,
        unknownEmails: unknown.slice(0, 20),
      },
      { status: 400 },
    );
  }

  // Members added to an already-active campaign must be due immediately.
  // activateCampaign backfills next_send_at once at activation, so anything
  // added afterwards stayed NULL and was skipped by both the executor filter
  // and the claim function.
  const dueAt = campaign.status === "active" ? new Date().toISOString() : null;

  const rows = resolved.map((row) => ({
    campaign_id: body.campaignId,
    email: row.email,
    contact_id: row.contactId,
    opportunity_id: row.opportunityId,
    status: "queued",
    next_send_at: dueAt,
  }));

  const { data, error } = await supabase
    .from("campaign_members")
    .upsert(rows, { onConflict: "campaign_id,email", ignoreDuplicates: true })
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ added: data?.length ?? 0, scheduled: Boolean(dueAt) });
}
