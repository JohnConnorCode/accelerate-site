import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { isValidEmail } from "@/lib/validation";
import { createPlatformServiceRoleClient } from "@/lib/supabase/server";
import { getPublicRoadmapState, isPublicRoadmapConfigured } from "@/lib/roadmap";
import { submitPublicWorkSuggestion } from "@/lib/revenue-os/work-board";

export async function GET() {
  try {
    const state = await getPublicRoadmapState();
    return NextResponse.json(state);
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
 * the work service readiness gate keeps an untriaged submission out of agent
 * dispatch. The route validates public input; the service owns creation and
 * the best-effort operator notification.
 */
export async function POST(request: NextRequest) {
  if (!isPublicRoadmapConfigured())
    return NextResponse.json(
      { error: "Feature suggestions are available after this workspace is connected." },
      { status: 503 },
    );
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
    await submitPublicWorkSuggestion(supabase, { title, description, email: email || undefined });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Roadmap suggestion error:", error);
    return NextResponse.json({ error: "Failed to submit suggestion" }, { status: 500 });
  }
}
