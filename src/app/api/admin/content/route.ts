import { NextRequest, NextResponse } from "next/server";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { runWithTenantRequestContext } from "@/lib/tenancy/context";
import {
  listContentCalendarItems,
  updateContentCalendarItem,
  writeContentCalendarCommand,
} from "@/lib/revenue-os/content-calendar";
import { ZodError } from "zod";
import { z } from "zod";

function failure(error: unknown) {
  if (error instanceof ZodError || error instanceof SyntaxError)
    return NextResponse.json({ error: "Invalid content calendar input" }, { status: 400 });
  const message = error instanceof Error ? error.message : "Content calendar failed";
  const status = /not found/.test(message)
    ? 404
    : /changed|already exists|preview|request key/i.test(message)
      ? 409
      : /administrator|unavailable|revoked/i.test(message)
        ? 403
        : 500;
  return NextResponse.json(
    {
      error:
        status === 500
          ? "Calendar result could not be confirmed. Keep this form open to retry the same change, or check the calendar before starting again."
          : message,
    },
    { status },
  );
}

export async function GET() {
  const auth = await requireAdminForModule("content");
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(await listContentCalendarItems(auth.database));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminForModule("content");
  if (auth instanceof NextResponse) return auth;
  const actorEmail = auth.user.email;
  if (!actorEmail)
    return NextResponse.json({ error: "Administrator email is required" }, { status: 403 });
  return runWithTenantRequestContext(auth, async () => {
    try {
      const { id, requestKey, ...values } = z
        .record(z.string(), z.unknown())
        .parse(await request.json());
      const receipt = await writeContentCalendarCommand(
        auth.database,
        {
          requestKey: z.uuid().parse(requestKey),
          command: { operation: "create", id: z.uuid().parse(id), values },
        },
        actorEmail,
      );
      return NextResponse.json({ receipt }, { status: 201 });
    } catch (error) {
      return failure(error);
    }
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminForModule("content");
  if (auth instanceof NextResponse) return auth;
  const actorEmail = auth.user.email;
  if (!actorEmail)
    return NextResponse.json({ error: "Administrator email is required" }, { status: 403 });
  return runWithTenantRequestContext(auth, async () => {
    try {
      const body = z.record(z.string(), z.unknown()).parse(await request.json());
      if (Array.isArray(body.reorder)) {
        const input = z
          .object({
            requestKey: z.uuid(),
            reorder: z.array(z.unknown()).min(1).max(250),
            expected: z
              .array(z.object({ id: z.uuid(), revision: z.string().min(1) }).strict())
              .min(1)
              .max(250),
          })
          .strict()
          .parse(body);
        const receipt = await writeContentCalendarCommand(
          auth.database,
          {
            requestKey: input.requestKey,
            command: { operation: "reorder", updates: input.reorder },
          },
          actorEmail,
          input.expected,
        );
        return NextResponse.json({ success: true, affected: receipt.count, receipt });
      }
      const { id, expectedRevision, ...changes } = body;
      const item = await updateContentCalendarItem(
        auth.database,
        z.uuid().parse(id),
        changes,
        actorEmail,
        z.string().min(1).parse(expectedRevision),
      );
      return NextResponse.json({ item });
    } catch (error) {
      return failure(error);
    }
  });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminForModule("content");
  if (auth instanceof NextResponse) return auth;
  const actorEmail = auth.user.email;
  if (!actorEmail)
    return NextResponse.json({ error: "Administrator email is required" }, { status: 403 });
  return runWithTenantRequestContext(auth, async () => {
    try {
      const params = new URL(request.url).searchParams;
      const id = z.uuid().parse(params.get("id"));
      const revision = z.string().min(1).parse(params.get("expectedRevision"));
      const receipt = await writeContentCalendarCommand(
        auth.database,
        {
          requestKey: z.uuid().parse(params.get("requestKey")),
          command: { operation: "delete", id },
        },
        actorEmail,
        [{ id, revision }],
      );
      return NextResponse.json({ success: true, receipt });
    } catch (error) {
      return failure(error);
    }
  });
}
