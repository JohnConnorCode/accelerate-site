import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { readBoundedJson } from "@/lib/http/bounded-json";
import {
  collectionCasePatchSchema,
  listCollectionCases,
  syncCollectionCases,
  updateCollectionCase,
} from "@/lib/revenue-os/collections";
const response = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function GET(request: Request) {
  const auth = await requireAdminForModule("receivables-collections");
  if (auth instanceof NextResponse) return auth;
  const status = z
    .enum(["open", "settled"])
    .safeParse(new URL(request.url).searchParams.get("status") ?? "open");
  if (!status.success) return response({ error: "Choose open or settled cases" }, 400);
  try {
    return response({ cases: await listCollectionCases(auth.database, status.data) });
  } catch {
    console.warn("[collections] Request refused or data unavailable");
    return response({ error: "Collections could not be loaded" }, 503);
  }
}
export async function POST(request: Request) {
  const auth = await requireAdminForModule("receivables-collections");
  if (auth instanceof NextResponse) return auth;
  let raw: unknown;
  try {
    raw = await readBoundedJson(request);
  } catch {
    console.warn("[collections] Request refused or data unavailable");
    return response({ error: "Invalid refresh request" }, 400);
  }
  const parsed = z
    .object({ requestId: z.uuid(), creationActionIds: z.array(z.uuid()).min(1).max(25) })
    .strict()
    .safeParse(raw);
  if (!parsed.success)
    return response({ error: "Choose up to 25 existing invoice operations and a request ID" }, 400);
  try {
    return response(
      await syncCollectionCases(
        auth.database,
        parsed.data.creationActionIds,
        parsed.data.requestId,
        auth.user.email!,
      ),
    );
  } catch {
    console.warn("[collections] Request refused or data unavailable");
    return response(
      {
        error:
          "Refresh was not recorded. Check Stripe, case state and plugin activation; retry using the same request ID.",
      },
      422,
    );
  }
}
export async function PATCH(request: Request) {
  const auth = await requireAdminForModule("receivables-collections");
  if (auth instanceof NextResponse) return auth;
  let raw: unknown;
  try {
    raw = await readBoundedJson(request);
  } catch {
    console.warn("[collections] Request refused or data unavailable");
    return response({ error: "Invalid case change" }, 400);
  }
  const parsed = z
    .object({
      caseId: z.uuid(),
      revision: z.number().int().positive(),
      requestId: z.uuid(),
      patch: collectionCasePatchSchema,
    })
    .strict()
    .safeParse(raw);
  if (!parsed.success)
    return response({ error: "A valid case revision and policy change are required" }, 400);
  try {
    return response({
      case: await updateCollectionCase(
        auth.database,
        parsed.data.caseId,
        parsed.data.revision,
        parsed.data.requestId,
        parsed.data.patch,
        auth.user.email!,
      ),
    });
  } catch {
    console.warn("[collections] Request refused or data unavailable");
    return response(
      { error: "Case changed or is unavailable. Reload before retrying your edit." },
      409,
    );
  }
}
