import { NextRequest, NextResponse } from "next/server";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { readBillingPayments } from "@/lib/revenue-os/billing-workspace";
export async function GET(request: NextRequest) {
  const auth = await requireAdminForModule("stripe-invoicing");
  if (auth instanceof NextResponse) return auth;
  const cursor = request.nextUrl.searchParams.get("starting_after") || undefined;
  if (cursor && !/^ch_[A-Za-z0-9]{1,120}$/.test(cursor))
    return NextResponse.json({ error: "Invalid payment cursor." }, { status: 400 });
  try {
    return NextResponse.json(
      await readBillingPayments(auth.database, {
        cursor,
        connection: request.nextUrl.searchParams.get("connection") || undefined,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Payments could not be read." },
      { status: 422 },
    );
  }
}
