import { runWithTenantRequestContext } from "@/lib/tenancy/context";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { reconcileCollectionReminder } from "@/lib/revenue-os/collection-reminders";
import { approveAndExecuteAction } from "@/lib/revenue-os/action-executor";
import {
  listActions,
  rejectAction,
  sweepExpiredActions,
  retryPluginAction,
} from "@/lib/revenue-os/actions";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const supabase = auth.database;
  // Retire anything past its expiry before listing. Nothing else wrote the
  // `expired` status, so dead proposals stayed `pending` and kept their dedupe
  // key, permanently blocking the same action from ever being staged again.
  await sweepExpiredActions(supabase);
  const requestedId = request.nextUrl.searchParams.get("id");
  if (requestedId && !/^[0-9a-f-]{36}$/i.test(requestedId))
    return NextResponse.json({ error: "Invalid action id" }, { status: 400 });
  try {
    const listed = await listActions(supabase, requestedId ? { id: requestedId } : { limit: 100 });
    if (!listed.schemaReady) return NextResponse.json({ schemaReady: false, actions: [] });
    return NextResponse.json({ schemaReady: true, actions: listed.actions });
  } catch (error) {
    console.error(
      "[actions] read failed",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json({ error: "Could not load actions" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json()) as {
    id?: string;
    decision?: "approve" | "reject" | "retry" | "reconcile";
    reason?: string;
  };
  if (!body.id || !["approve", "reject", "retry", "reconcile"].includes(body.decision || ""))
    return NextResponse.json({ error: "Action id and decision are required" }, { status: 400 });
  const supabase = auth.database;
  try {
    if (body.decision === "reconcile")
      return NextResponse.json({
        success: true,
        result: await reconcileCollectionReminder(supabase, body.id),
      });
    if (body.decision === "retry")
      return NextResponse.json({
        success: true,
        result: await retryPluginAction(supabase, body.id, auth.user.email || "founder"),
      });
    if (body.decision === "reject") {
      await rejectAction(supabase, body.id, auth.user.email || "founder", body.reason);
      return NextResponse.json({ success: true });
    }
    const result = await runWithTenantRequestContext(auth, () =>
      approveAndExecuteAction(supabase, body.id!, auth.user.email || "founder"),
    );
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not handle action" },
      { status: 400 },
    );
  }
}
