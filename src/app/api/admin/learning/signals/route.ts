import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { listLearningSignals, recordCorrectionSignal } from "@/lib/revenue-os/learning-signals";
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json({ signals: await listLearningSignals(auth.database) });
  } catch {
    return NextResponse.json({ error: "Learning evidence could not be loaded" }, { status: 503 });
  }
}
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json({
      proposal: await recordCorrectionSignal(auth.database, await request.json(), auth.user.email!),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Correction could not be saved" },
      { status: 400 },
    );
  }
}
