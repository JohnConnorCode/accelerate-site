import { NextRequest, NextResponse } from "next/server";
import { requireAdminForModule } from "@/lib/admin/module-guard";

type AssessmentRow = {
  id: string;
  name: string | null;
  email: string | null;
  business_name: string | null;
  score: number | null;
  status: string;
  created_at: string;
  unlocked_at: string | null;
  previewed_at: string | null;
  profile: { bottleneck?: string } | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
};

const missingSchemaCodes = new Set(["42P01", "PGRST205"]);

export async function GET(request: NextRequest) {
  const auth = await requireAdminForModule("resources");
  if (auth instanceof NextResponse) return auth;

  const params = request.nextUrl.searchParams;
  const requestedDays = Number.parseInt(params.get("days") || "30", 10);
  const days = Math.min(365, Math.max(1, Number.isFinite(requestedDays) ? requestedDays : 30));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const result = await auth.database
    .from("ai_readiness_assessments")
    .select(
      "id,name,email,business_name,score,status,created_at,unlocked_at,previewed_at,profile,utm_source,utm_medium,utm_campaign",
    )
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(10000);

  if (result.error) {
    if (missingSchemaCodes.has(result.error.code || ""))
      return NextResponse.json({ schemaReady: false, windowDays: days });
    console.error("AI readiness analytics query failed:", result.error.message);
    return NextResponse.json({ error: "Analytics query failed" }, { status: 500 });
  }

  const rows = (result.data || []) as AssessmentRow[];
  const unlocked = rows.filter(
    (row) => Boolean(row.unlocked_at) || ["unlocked", "completed"].includes(row.status),
  );
  const previewed = rows.filter(
    (row) =>
      Boolean(row.previewed_at) ||
      Boolean(row.unlocked_at) ||
      ["previewed", "unlocked", "completed"].includes(row.status),
  );
  const scores = unlocked
    .map((row) => row.score)
    .filter((score): score is number => typeof score === "number");
  const averageScore = scores.length
    ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10
    : null;
  const countValues = (values: string[]) =>
    Object.entries(
      values.reduce<Record<string, number>>((counts, value) => {
        counts[value] = (counts[value] || 0) + 1;
        return counts;
      }, {}),
    )
      .sort(([, a], [, b]) => b - a)
      .map(([label, value]) => ({ label, value }));
  const bottlenecks = countValues(rows.map((row) => row.profile?.bottleneck || "unknown"));
  const sources = countValues(rows.map((row) => row.utm_source || "direct"));
  const scoreBands = countValues(
    scores.map((score) =>
      score < 40 ? "0–39" : score < 65 ? "40–64" : score < 85 ? "65–84" : "85–100",
    ),
  );

  return NextResponse.json({
    schemaReady: true,
    windowDays: days,
    funnel: { starts: rows.length, previews: previewed.length, unlocked: unlocked.length },
    averageScore,
    completionRate: rows.length ? Math.round((unlocked.length / rows.length) * 1000) / 10 : null,
    bottlenecks,
    sources,
    scoreBands,
    leads: unlocked.slice(0, 25).map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      business_name: row.business_name,
      score: row.score,
      created_at: row.unlocked_at || row.created_at,
    })),
  });
}
