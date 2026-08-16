import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { scheduleEmailSequence } from "@/lib/email/sequences";
import {
  isValidWorkEmail,
  normalizeEmail,
  normalizeWebsite,
  qualifyRoofingOpportunity,
  safeAttribution,
  type RoofingQualifierInput,
} from "@/lib/opportunities";

const ALLOWED_ROLES = new Set([
  "owner", "founder", "president", "general_manager", "operations", "marketing", "team_member", "vendor",
]);
const ALLOWED_REVENUE = new Set(["under_1m", "1m_3m", "3m_10m", "10m_plus"]);
const ALLOWED_LEAKS = new Set(["slow_response", "estimate_followup", "after_hours", "scheduling", "visibility"]);

export async function POST(request: NextRequest) {
  let body: RoofingQualifierInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Honeypot: bots commonly fill visually hidden fields.
  if (body.website) return NextResponse.json({ accepted: true });

  const email = normalizeEmail(body.email || "");
  const companyWebsite = normalizeWebsite(body.companyWebsite || "");

  if (!isValidWorkEmail(email)) {
    return NextResponse.json({ error: "Use your company email so we can match the audit to the business." }, { status: 400 });
  }
  if (!companyWebsite) {
    return NextResponse.json({ error: "Enter a valid company website." }, { status: 400 });
  }
  if (!ALLOWED_ROLES.has(body.role) || !ALLOWED_REVENUE.has(body.revenueBand) || !ALLOWED_LEAKS.has(body.primaryLeak)) {
    return NextResponse.json({ error: "Complete every qualification field." }, { status: 400 });
  }

  const qualification = qualifyRoofingOpportunity(body.role, body.revenueBand);
  const calendlyEnabled = process.env.CALENDLY_ENABLED === "true";
  const supabase = createServiceRoleClient();
  const token = nanoid(24);
  const attribution = safeAttribution(body.utm);

  const { data: existing } = await supabase
    .from("opportunities")
    .select("id, qualifier_token, qualified, stage")
    .eq("email", email)
    .maybeSingle();

  const nextStage = qualification.qualified
    ? existing?.stage === "booked" || existing?.stage === "showed" || existing?.stage === "proposal" || existing?.stage === "won"
      ? existing.stage
      : "qualified"
    : "nurture";

  const record = {
    email,
    company_website: companyWebsite,
    role: body.role,
    revenue_band: body.revenueBand,
    primary_leak: body.primaryLeak,
    qualified: qualification.qualified,
    qualification_reason: qualification.reason,
    qualifier_token: existing?.qualifier_token || token,
    stage: nextStage,
    message_variant: body.messageVariant?.slice(0, 80) || null,
    ...attribution,
  };

  const query = existing
    ? supabase.from("opportunities").update(record).eq("id", existing.id)
    : supabase.from("opportunities").insert(record);
  const { data: opportunity, error } = await query.select("id, qualifier_token, qualified, stage").single();

  if (error || !opportunity) {
    console.error("[qualify] opportunity write failed:", error?.message);
    return NextResponse.json({ error: "We couldn't save this yet. Please try again." }, { status: 500 });
  }

  if (!existing || existing.stage !== opportunity.stage) {
    await supabase.from("opportunity_stage_events").insert({
      opportunity_id: opportunity.id,
      from_stage: existing?.stage || null,
      to_stage: opportunity.stage,
      source: "roofing_qualifier",
      metadata: { qualified: opportunity.qualified },
    });
  }

  if (!existing) {
    await supabase.from("admin_notifications").insert({
      type: "new_lead",
      title: qualification.qualified ? "Qualified roofing audit request" : "Roofing nurture signup",
      message: `${email} · ${companyWebsite}`,
      link: "/admin/bookings",
      priority: qualification.qualified ? "urgent" : "info",
    });

    // Email is useful but should never make the qualifier feel broken.
    try {
      await scheduleEmailSequence({
        email,
        sequenceType: qualification.qualified
          ? calendlyEnabled ? "booking_nurture" : "manual_audit_followup"
          : "roofing_nurture",
        metadata: {
          planLink: `https://www.acceleratewith.us/roofing?resume=${opportunity.qualifier_token}#book`,
          industry: "roofing",
        },
      });
    } catch (sequenceError) {
      console.error("[qualify] nurture scheduling failed:", sequenceError);
    }
  }

  return NextResponse.json({
    accepted: true,
    qualified: opportunity.qualified,
    token: opportunity.qualifier_token,
    email,
    bookingMode: calendlyEnabled ? "calendly" : "manual",
  });
}
