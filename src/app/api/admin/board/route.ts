import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { readCommandBoard, saveCommandBoard } from "@/lib/revenue-os/command-board";

export async function GET() {
  const auth = await requireAdminForModule("command-board");
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(await readCommandBoard(auth.database), {
      headers: { "Cache-Control": "no-store" },
    });
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
    return NextResponse.json(await saveCommandBoard(auth.database, await request.json()));
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
