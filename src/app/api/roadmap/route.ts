import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { isValidEmail } from "@/lib/validation";
import { createPlatformServiceRoleClient } from "@/lib/supabase/server";
import { getPublicRoadmapCards } from "@/lib/roadmap";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function GET() {
  try {
    const cards = await getPublicRoadmapCards();
    return NextResponse.json({ cards });
  } catch (error) {
    console.error("Roadmap fetch error:", error);
    return NextResponse.json({ error: "Could not load the roadmap" }, { status: 500 });
  }
}

/**
 * Public "suggest a feature" submissions. Lands as a real feature_requests
 * row (status backlog, no labels) so it's visible to a founder in
 * /admin/features immediately, but src/lib/roadmap.ts's public read requires
 * a `category:` label before anything is shown publicly — an unreviewed
 * submission is invisible on the page itself until a human triages it, and
 * the milestone:now|next gate in migrations/20260903*-feature-request-claims
 * .sql means a labelless row is never auto-dispatchable to a coding agent
 * either. Matches src/app/api/partner-apply/route.ts's pattern: rate limit,
 * server-side validation, insert, fire-and-forget admin notification.
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success } = rateLimit(ip, 5, 60 * 60 * 1000);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { title, description, email, company } = body;

    // Honeypot: a real visitor never fills a field named "company" hidden
    // off-screen. A non-empty value here is a bot; report success so it
    // doesn't learn to skip the field, but write nothing.
    if (typeof company === "string" && company.trim().length > 0) {
      return NextResponse.json({ success: true });
    }

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "A short title is required" }, { status: 400 });
    }
    if (!description || typeof description !== "string" || !description.trim()) {
      return NextResponse.json({ error: "A description is required" }, { status: 400 });
    }
    if (title.length > 120) {
      return NextResponse.json({ error: "Title must be under 120 characters" }, { status: 400 });
    }
    if (description.length > 2000) {
      return NextResponse.json(
        { error: "Description must be under 2000 characters" },
        { status: 400 },
      );
    }
    if (email && (typeof email !== "string" || email.length > 254 || !isValidEmail(email))) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const supabase = createPlatformServiceRoleClient("public-roadmap-submission");
    const slugBase = slugify(title) || "suggestion";
    const seedKey = `community-${slugBase}-${Math.random().toString(36).slice(2, 8)}`;

    const { error: dbError } = await supabase.from("feature_requests").insert({
      seed_key: seedKey,
      title: title.trim().slice(0, 120),
      description: description.trim().slice(0, 2000),
      status: "backlog",
      priority: "low",
      labels: [],
      source: "public-roadmap-submission",
      notes: `Submitted ${new Date().toISOString()} via the public roadmap suggestion form.${
        email ? ` Contact: ${email.trim()}` : " No contact provided."
      }`,
    });

    if (dbError) {
      console.error("Roadmap suggestion insert FAILED:", dbError.message);
      return NextResponse.json(
        { error: "We could not save your suggestion. Please try again." },
        { status: 500 },
      );
    }

    Promise.resolve(
      supabase.from("admin_notifications").insert({
        type: "roadmap_suggestion",
        title: `New roadmap suggestion: ${title.trim().slice(0, 120)}`,
        description: description.trim().slice(0, 200),
        link: "/admin/features",
      }),
    ).catch((err) => {
      // Best-effort: the suggestion itself is already saved above, so a
      // failed notification never loses the submission — just log it so a
      // silent notification outage doesn't go unnoticed.
      console.error("roadmap_suggestion admin_notifications insert failed:", err);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Roadmap suggestion error:", error);
    return NextResponse.json({ error: "Failed to submit suggestion" }, { status: 500 });
  }
}
