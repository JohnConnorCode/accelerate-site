import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { readBoundedJson } from "@/lib/http/bounded-json";
import {
  previewCollectionReminder,
  proposeCollectionReminder,
} from "@/lib/revenue-os/collection-reminders";
const response = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  const auth = await requireAdminForModule("receivables-collections");
  if (auth instanceof NextResponse) return auth;
  try {
    const input = z
      .object({
        caseId: z.uuid(),
        digest: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .optional(),
      })
      .strict()
      .parse(await readBoundedJson(request));
    if (input.digest)
      return response({
        action: await proposeCollectionReminder(
          auth.database,
          input.caseId,
          input.digest,
          auth.user.email!,
        ),
      });
    return response({ preview: await previewCollectionReminder(auth.database, input.caseId) });
  } catch {
    console.warn("[collections] Reminder preview or proposal refused");
    return response(
      {
        error:
          "Reminder unavailable or changed. Refresh the case; check holds, payment, recipient and integration settings.",
      },
      409,
    );
  }
}
