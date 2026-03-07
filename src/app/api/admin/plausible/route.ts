import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const apiKey = process.env.PLAUSIBLE_API_KEY;
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || "acceleratewith.us";

  if (!apiKey) {
    return NextResponse.json(
      { error: "Plausible API key not configured" },
      { status: 503 }
    );
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  try {
    const [realtimeRes, topPagesRes, topSourcesRes, goalsRes] = await Promise.allSettled([
      // Realtime visitors
      fetch(`https://plausible.io/api/v1/stats/realtime/visitors?site_id=${domain}`, { headers }),
      // Top pages today
      fetch(
        `https://plausible.io/api/v1/stats/breakdown?site_id=${domain}&period=day&property=event:page&limit=5&metrics=visitors`,
        { headers }
      ),
      // Top sources today
      fetch(
        `https://plausible.io/api/v1/stats/breakdown?site_id=${domain}&period=day&property=visit:source&limit=5&metrics=visitors`,
        { headers }
      ),
      // Goal conversions (7 days)
      fetch(
        `https://plausible.io/api/v1/stats/breakdown?site_id=${domain}&period=7d&property=event:goal&metrics=visitors,events`,
        { headers }
      ),
    ]);

    const realtime =
      realtimeRes.status === "fulfilled" && realtimeRes.value.ok
        ? await realtimeRes.value.json()
        : 0;

    const topPages =
      topPagesRes.status === "fulfilled" && topPagesRes.value.ok
        ? (await topPagesRes.value.json()).results || []
        : [];

    const topSources =
      topSourcesRes.status === "fulfilled" && topSourcesRes.value.ok
        ? (await topSourcesRes.value.json()).results || []
        : [];

    const goals =
      goalsRes.status === "fulfilled" && goalsRes.value.ok
        ? (await goalsRes.value.json()).results || []
        : [];

    return NextResponse.json({
      realtime,
      topPages,
      topSources,
      goals,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch Plausible data" },
      { status: 500 }
    );
  }
}
