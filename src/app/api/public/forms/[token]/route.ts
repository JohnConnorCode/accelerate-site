import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { readBoundedJson } from "@/lib/http/bounded-json";
import {
  formResponseValidator,
  getPublishedFormByToken,
  isFormModuleEnabled,
  recordFormSubmission,
} from "@/lib/revenue-os/form-builder";

/**
 * Public form surface. The 64-hex share token is the credential: only
 * published forms resolve, responses are zod-validated, and repeat posts
 * with the same requestId return the original receipt instead of a duplicate.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const database = createServiceRoleClient({
    kind: "system",
    tenantId: "public-form-surface",
    tenantSlug: "public",
    source: "public-form",
  });
  const form = await getPublishedFormByToken(database, token).catch((error: unknown) => {
    console.warn("[forms] public lookup failed", error instanceof Error ? error.name : "UnknownError");
    return null;
  });
  if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });
  const enabled = await isFormModuleEnabled(database, form.tenantId).catch(() => false);
  if (!enabled) return NextResponse.json({ error: "Form not found" }, { status: 404 });
  return NextResponse.json(
    { name: form.name, description: form.description, schema: form.schema },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }
  const limit = rateLimit(`public-form:${token.slice(0, 16)}`, 30, 60_000);
  if (!limit.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  let body: unknown;
  try {
    body = await readBoundedJson(request);
  } catch {
    console.warn("[forms] public response body unreadable");
    return NextResponse.json({ error: "Invalid response" }, { status: 400 });
  }
  const parsed = z
    .object({ response: z.unknown(), requestId: z.uuid(), website: z.string().max(200).optional() })
    .strict()
    .safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid response" }, { status: 400 });
  if (parsed.data.website) {
    // Honeypot: automated submitters fill the hidden field. Accept quietly
    // without recording anything, so bots learn nothing.
    console.warn("[forms] honeypot submission ignored");
    return NextResponse.json({ accepted: true }, { status: 202 });
  }
  const response = formResponseValidator.safeParse(parsed.data.response);
  if (!response.success) return NextResponse.json({ error: "Invalid response" }, { status: 400 });
  const database = createServiceRoleClient({
    kind: "system",
    tenantId: "public-form-surface",
    tenantSlug: "public",
    source: "public-form",
  });
  try {
    const form = await getPublishedFormByToken(database, token);
    if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });
    const enabled = await isFormModuleEnabled(database, form.tenantId);
    if (!enabled) return NextResponse.json({ error: "Form not found" }, { status: 404 });
    const receipt = await recordFormSubmission(database, {
      formId: form.id,
      tenantId: form.tenantId,
      response: response.data,
      requestId: parsed.data.requestId,
    });
    // Operator notice is best-effort: the response is already stored, and a
    // notification failure must never fail the visitor's submit.
    database
      .from("admin_notifications")
      .insert({
        tenant_id: form.tenantId,
        type: "new_form_response",
        title: `New response: ${form.name}`.slice(0, 120),
        description: receipt.contactEmail
          ? `From ${receipt.contactEmail}. Review in Forms.`
          : "A new response is waiting for review in Forms.",
        link: "/admin/forms",
        priority: "info",
      })
      .then(
        () => {},
        (error: unknown) =>
          console.warn(
            "[forms] response notification failed",
            error instanceof Error ? error.message : "UnknownError",
          ),
      );
    return NextResponse.json({ accepted: true, ...receipt }, { status: 202 });
  } catch (error) {
    console.warn("[forms] public submission failed", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "Response could not be recorded" }, { status: 500 });
  }
}
