import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { uploadWorkspaceMedia } from "@/lib/revenue-os/media-assets";
export async function POST(request: Request) {
  const auth = await requireAdminForModule("social-marketing");
  if (auth instanceof NextResponse) return auth;
  try {
    const input = z
      .object({
        data: z
          .string()
          .max(4000000)
          .regex(/^[A-Za-z0-9+/]*={0,2}$/),
        mime: z.enum(["image/png", "image/jpeg"]),
      })
      .strict()
      .parse(await readBoundedJson(request, 4010000));
    const file = new File([Buffer.from(input.data, "base64")], "image", { type: input.mime });
    return NextResponse.json(
      await uploadWorkspaceMedia(auth.database, file, auth.user.email ?? ""),
    );
  } catch {
    return NextResponse.json(
      { error: "Image upload failed. Choose a PNG or JPEG up to 3 MB and retry." },
      { status: 422 },
    );
  }
}
