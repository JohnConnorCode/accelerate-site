import { NextRequest, NextResponse } from "next/server";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import {
  previewContentCalendarCommand,
  proposeContentCalendarCommand,
} from "@/lib/revenue-os/content-calendar";
import { z } from "zod";

export async function POST(request: NextRequest) {
  const auth = await requireAdminForModule("content");
  if (auth instanceof NextResponse) return auth;
  if (!auth.user.email)
    return NextResponse.json({ error: "Administrator email is required" }, { status: 403 });
  try {
    const { action, ...input } = z.record(z.string(), z.unknown()).parse(await request.json());
    const operation = z.enum(["preview", "propose"]).parse(action);
    return NextResponse.json(
      operation === "preview"
        ? await previewContentCalendarCommand(auth.database, input)
        : { action: await proposeContentCalendarCommand(auth.database, input, auth.user.email) },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Calendar proposal failed";
    const status =
      error instanceof z.ZodError || error instanceof SyntaxError
        ? 400
        : /changed|already exists|no content positions/i.test(message)
          ? 409
          : /administrator|unavailable|revoked/.test(message)
            ? 403
            : /not found/.test(message)
              ? 404
              : 500;
    return NextResponse.json(
      { error: status === 500 ? "Calendar proposal failed. Reload and retry." : message },
      { status },
    );
  }
}
