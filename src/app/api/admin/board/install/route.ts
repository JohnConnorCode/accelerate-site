import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { installCommandBoardMode } from "@/lib/revenue-os/command-board";
import { runWithTenantRequestContext } from "@/lib/tenancy/context";

export async function POST(request: Request) {
  const auth = await requireAdminForModule("command-board");
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json();
    return NextResponse.json(
      await runWithTenantRequestContext(auth, () => installCommandBoardMode(auth.database, body)),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ZodError
            ? "Choose a mode and a business name."
            : error instanceof Error
              ? error.message
              : "The mode could not be installed",
      },
      { status: error instanceof ZodError ? 400 : 409 },
    );
  }
}
