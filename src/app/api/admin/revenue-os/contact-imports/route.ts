import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  analyzeContactImport,
  approveContactImport,
  contactImportSchemaUnavailable,
  executeContactImport,
  getContactImportBatch,
  listContactImportBatches,
  saveContactImportReview,
  type ContactImportAction,
} from "@/lib/revenue-os/contact-imports";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Contact import failed";
  const batchId = error && typeof error === "object" && "batchId" in error ? String((error as { batchId?: unknown }).batchId || "") : null;
  if (contactImportSchemaUnavailable(error)) {
    return NextResponse.json({ error: "Contact Import migration is not applied", schemaReady: false, batchId }, { status: 503 });
  }
  const status = /not found/i.test(message) ? 404 : /changed|stale|already|cannot be|not approved/i.test(message) ? 409 : /OpenRouter is not configured/i.test(message) ? 503 : 400;
  return NextResponse.json({ error: message, schemaReady: true, batchId }, { status });
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (id) {
      const batch = await getContactImportBatch(supabase, id);
      if (!batch) return NextResponse.json({ error: "Import batch not found" }, { status: 404 });
      return NextResponse.json({ schemaReady: true, batch });
    }
    return NextResponse.json({ schemaReady: true, batches: await listContactImportBatches(supabase) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const action = typeof body.action === "string" ? body.action : "";
  const actorEmail = auth.user.email || auth.user.id;
  const supabase = createServiceRoleClient();
  try {
    if (action === "analyze") {
      const limited = rateLimit(`contact-import-analyze:${actorEmail}`, 12, 60 * 60 * 1000);
      if (!limited.success) return NextResponse.json({ error: "AI import analysis limit reached. Try again later." }, { status: 429 });
      const sourceText = typeof body.sourceText === "string" ? body.sourceText : "";
      const batch = await analyzeContactImport(supabase, {
        sourceText,
        filename: typeof body.filename === "string" ? body.filename : null,
        instructions: typeof body.instructions === "string" ? body.instructions : null,
        actorEmail,
      });
      return NextResponse.json({ schemaReady: true, batch }, { status: 201 });
    }
    if (action === "save_review") {
      if (typeof body.batchId !== "string" || !Array.isArray(body.rows)) return NextResponse.json({ error: "batchId and rows are required" }, { status: 400 });
      const rows = body.rows.map((row) => {
        const value = row && typeof row === "object" ? row as Record<string, unknown> : {};
        return {
          id: typeof value.id === "string" ? value.id : "",
          included: Boolean(value.included),
          action: value.action as ContactImportAction,
          data: value.data,
        };
      });
      if (rows.some((row) => !row.id)) return NextResponse.json({ error: "Every review row needs an id" }, { status: 400 });
      return NextResponse.json({ schemaReady: true, batch: await saveContactImportReview(supabase, { batchId: body.batchId, rows, actorEmail }) });
    }
    if (action === "approve") {
      if (typeof body.batchId !== "string" || typeof body.expectedDigest !== "string") return NextResponse.json({ error: "batchId and expectedDigest are required" }, { status: 400 });
      return NextResponse.json({ schemaReady: true, batch: await approveContactImport(supabase, { batchId: body.batchId, expectedDigest: body.expectedDigest, actorEmail }) });
    }
    if (action === "execute") {
      const limited = rateLimit(`contact-import-execute:${actorEmail}`, 30, 60 * 60 * 1000);
      if (!limited.success) return NextResponse.json({ error: "Import execution limit reached. Try again later." }, { status: 429 });
      if (typeof body.batchId !== "string") return NextResponse.json({ error: "batchId is required" }, { status: 400 });
      return NextResponse.json({ schemaReady: true, batch: await executeContactImport(supabase, { batchId: body.batchId, actorEmail }) });
    }
    return NextResponse.json({ error: "Unknown contact import action" }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
