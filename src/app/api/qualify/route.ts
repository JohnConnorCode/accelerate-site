import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { scheduleEmailSequence } from "@/lib/email/sequences";
import { isValidWorkEmail, normalizeEmail, normalizeWebsite, qualifyRoofingOpportunity, type RoofingQualifierInput } from "@/lib/opportunities";
import { ingestRoofingQualification } from "@/lib/revenue-os/inbound";

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
  // Public self-booking is the active campaign path. Set CALENDLY_ENABLED=false
  // only for an intentional emergency pause; the free Calendly event needs no API token to embed.
  const calendlyEnabled = process.env.CALENDLY_ENABLED !== "false";
  const supabase = createServiceRoleClient();
  let ingestion;
  try {
    ingestion = await ingestRoofingQualification(supabase, { email, companyWebsite, role: body.role, revenueBand: body.revenueBand, primaryLeak: body.primaryLeak, messageVariant: body.messageVariant, qualifierToken: nanoid(24), utm: body.utm, qualification });
  } catch (error) {
    console.error("[qualify] canonical inbound ingestion failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "We couldn't save this yet. Please try again." }, { status: 500 });
  }
  const opportunity = ingestion.opportunity;

  if (!ingestion.existing) {
    const { error: notificationError } = await supabase.from("admin_notifications").insert({
      type: "new_lead",
      title: qualification.qualified ? "Qualified roofing audit request" : "Roofing nurture signup",
      message: `${email} · ${companyWebsite}`,
      link: "/admin/bookings",
      priority: qualification.qualified ? "urgent" : "info",
    });
    if (notificationError) {
      console.error("[qualify] failed to create admin notification:", notificationError.message);
    }

    // Email is useful but should never make the qualifier feel broken.
    try {
      await scheduleEmailSequence({
        email,
        sequenceType: qualification.qualified
          ? calendlyEnabled ? "booking_nurture" : "manual_audit_followup"
          : "roofing_nurture",
        metadata: {
          planLink: `https://www.acceleratewith.us/roofing?resume=${opportunity.qualifier_token || ""}#book`,
          industry: "roofing",
        },
      });
    } catch (sequenceError) {
      console.error("[qualify] nurture scheduling failed:", sequenceError);
    }
  }

  return NextResponse.json({
    accepted: true,
    qualified: qualification.qualified,
    token: opportunity.qualifier_token,
    email,
    bookingMode: calendlyEnabled ? "calendly" : "manual",
  });
}
