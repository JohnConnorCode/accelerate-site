import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { readCommandBoard, saveCommandBoard } from "@/lib/revenue-os/command-board";
import { runWithTenantRequestContext } from "@/lib/tenancy/context";

export async function GET() {
  const auth = await requireAdminForModule("command-board");
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(
      await runWithTenantRequestContext(auth, () => readCommandBoard(auth.database)),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.warn("[command-board] Board read unavailable");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The board could not be loaded" },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminForModule("command-board");
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json();
    return NextResponse.json(
      await runWithTenantRequestContext(auth, () => saveCommandBoard(auth.database, body)),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ZodError
            ? "Check the board definition and try again."
            : error instanceof Error
              ? error.message
              : "The board could not be saved",
      },
      { status: error instanceof ZodError ? 400 : 409 },
    );
  }
}
