import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { runWithTenantRequestContext } from "@/lib/tenancy/context";
import {
  archiveSubscriptionPlan,
  createSubscriptionPlan,
  listSubscriptionWorkspace,
} from "@/lib/revenue-os/subscriptions";
import { planInputSchema } from "@/lib/revenue-os/subscriptions-contract";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create_plan"), requestId: z.uuid(), plan: planInputSchema }),
  z.object({ action: z.literal("archive_plan"), requestId: z.uuid(), planId: z.uuid() }),
]);

export async function GET() {
  const authorization = await requireAdminForModule("stripe-invoicing");
  if (authorization instanceof NextResponse) return authorization;
  try {
    return NextResponse.json(
      await runWithTenantRequestContext(authorization, () =>
        listSubscriptionWorkspace(authorization.database),
      ),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Subscriptions could not be read" },
      { status: 422 },
    );
  }
}

export async function POST(request: NextRequest) {
  const authorization = await requireAdminForModule("stripe-invoicing");
  if (authorization instanceof NextResponse) return authorization;
  const body = await readBoundedJson(request).catch((error) => {
    console.warn(
      "[admin/subscriptions] invalid request body:",
      error instanceof Error ? error.message : error,
    );
    return null;
  });
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid subscription action" }, { status: 400 });
  const action = parsed.data;
  try {
    if (action.action === "create_plan") {
      return NextResponse.json(
        await runWithTenantRequestContext(authorization, () =>
          createSubscriptionPlan(
            authorization.database,
            action.plan,
            action.requestId,
            authorization.user.email || "admin",
            authorization.user.id,
          ),
        ),
      );
    }
    return NextResponse.json(
      await runWithTenantRequestContext(authorization, () =>
        archiveSubscriptionPlan(
          authorization.database,
          action.planId,
          action.requestId,
          authorization.user.email || "admin",
          authorization.user.id,
        ),
      ),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Subscription action failed" },
      { status: 422 },
    );
  }
}
