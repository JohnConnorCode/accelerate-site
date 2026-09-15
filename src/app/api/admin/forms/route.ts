import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { readBoundedJson } from "@/lib/http/bounded-json";
import {
  acceptFormSubmission,
  createFormDefinition,
  formSchemaValidator,
  listFormDefinitions,
  listFormSubmissions,
  rejectFormSubmission,
  saveFormDefinition,
  setFormStatus,
} from "@/lib/revenue-os/form-builder";

const response = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request) {
  const auth = await requireAdminForModule("form-builder");
  if (auth instanceof NextResponse) return auth;
  const params = new URL(request.url).searchParams;
  const view = params.get("view") ?? "forms";
  try {
    if (view === "submissions") {
      const parsed = z
        .object({
          formId: z.uuid().optional(),
          status: z.enum(["pending_review", "accepted", "rejected"]).optional(),
        })
        .strict()
        .safeParse({
          formId: params.get("formId") ?? undefined,
          status: params.get("status") ?? undefined,
        });
      if (!parsed.success) return response({ error: "Invalid submission filter" }, 400);
      return response({
        submissions: await listFormSubmissions(auth.database, auth.tenant.id, parsed.data),
      });
    }
    return response({ forms: await listFormDefinitions(auth.database, auth.tenant.id) });
  } catch {
    console.warn("[forms] admin read failed");
    return response({ error: "Forms could not be loaded" }, 503);
  }
}

const createSchema = z.object({ name: z.string().min(1).max(120), description: z.string().max(2000).optional() }).strict();
const saveSchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(2000).optional(),
    schema: z.unknown(),
  })
  .strict();
const statusSchema = z.object({ id: z.uuid(), status: z.enum(["draft", "published", "archived"]) }).strict();
const reviewSchema = z
  .object({ id: z.uuid(), decision: z.enum(["accepted", "rejected"]), requestId: z.uuid().optional() })
  .strict();

export async function POST(request: Request) {
  const auth = await requireAdminForModule("form-builder");
  if (auth instanceof NextResponse) return auth;
  let raw: unknown;
  try {
    raw = await readBoundedJson(request, 65536);
  } catch {
    console.warn("[forms] admin request body unreadable");
    return response({ error: "Invalid form request" }, 400);
  }
  const action = (raw as { action?: unknown } | null)?.action;
  try {
    if (action === "create") {
      const parsed = createSchema.safeParse((raw as { form?: unknown }).form ?? raw);
      if (!parsed.success) return response({ error: "Name must be 1 to 120 characters" }, 400);
      return response(
        {
          form: await createFormDefinition(auth.database, {
            tenantId: auth.tenant.id,
            actorEmail: auth.user.email!,
            ...parsed.data,
          }),
        },
        201,
      );
    }
    if (action === "save") {
      const parsed = saveSchema.safeParse((raw as { form?: unknown }).form ?? raw);
      if (!parsed.success) return response({ error: "Invalid form definition" }, 400);
      // formSchemaValidator owns the element rules; this pre-check keeps errors readable.
      const schema = formSchemaValidator.safeParse(parsed.data.schema);
      if (!schema.success) {
        return response({ error: schema.error.issues[0]?.message ?? "Invalid form schema" }, 400);
      }
      return response({
        form: await saveFormDefinition(auth.database, {
          tenantId: auth.tenant.id,
          actorEmail: auth.user.email!,
          ...parsed.data,
          schema: schema.data,
        }),
      });
    }
    if (action === "status") {
      const parsed = statusSchema.safeParse((raw as { form?: unknown }).form ?? raw);
      if (!parsed.success) return response({ error: "Invalid status change" }, 400);
      return response({
        form: await setFormStatus(auth.database, {
          tenantId: auth.tenant.id,
          actorEmail: auth.user.email!,
          ...parsed.data,
        }),
      });
    }
    if (action === "review") {
      const parsed = reviewSchema.safeParse(raw);
      if (!parsed.success) return response({ error: "Invalid review" }, 400);
      if (parsed.data.decision === "rejected") {
        await rejectFormSubmission(auth.database, {
          tenantId: auth.tenant.id,
          id: parsed.data.id,
          actorEmail: auth.user.email!,
        });
        return response({ reviewed: parsed.data.id, decision: "rejected" });
      }
      return response({
        ...(await acceptFormSubmission(auth.database, {
          tenantId: auth.tenant.id,
          id: parsed.data.id,
          actorEmail: auth.user.email!,
          requestId: parsed.data.requestId ?? crypto.randomUUID(),
        })),
        decision: "accepted" as const,
      });
    }
    return response({ error: "Unknown form action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Form request failed";
    const status = /not found|cannot become|Unpublish|Archived|no email|already reviewed/i.test(message) ? 422 : 503;
    return response({ error: message }, status);
  }
}
