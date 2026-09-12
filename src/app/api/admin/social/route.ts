import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { readBoundedJson } from "@/lib/http/bounded-json";
import {
  readSocialWorkspace,
  previewSocialChange,
  proposeSocialChange,
  executeSocialChange,
  prepareSocialWeek,
} from "@/lib/revenue-os/social-marketing";
export async function GET() {
  const auth = await requireAdminForModule("social-marketing");
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(await readSocialWorkspace(auth.database), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Social workspace could not be loaded. Verify setup and retry." },
      { status: 503 },
    );
  }
}
export async function POST(request: Request) {
  const auth = await requireAdminForModule("social-marketing");
  if (auth instanceof NextResponse) return auth;
  try {
    const body = z
      .object({ kind: z.enum(["preview", "propose", "save", "week"]), input: z.unknown() })
      .strict()
      .parse(await readBoundedJson(request, 50000));
    const actor = auth.user.email ?? "";
    const result =
      body.kind === "preview"
        ? await previewSocialChange(auth.database, body.input)
        : body.kind === "propose"
          ? await proposeSocialChange(auth.database, body.input, actor)
          : body.kind === "week"
            ? await prepareSocialWeek(auth.database, body.input)
            : await executeSocialChange(auth.database, body.input, actor);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Social change failed" },
      { status: 422 },
    );
  }
}
