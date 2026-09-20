import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { z } from "zod";
import {
  listKnowledgeDocuments,
  uploadKnowledgeDocument,
  queueDocumentIndex,
  archiveKnowledgeDocument,
} from "@/lib/revenue-os/knowledge-documents";
import { DOCUMENT_MAX_BYTES } from "@/lib/revenue-os/document-extraction";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json({ documents: await listKnowledgeDocuments(auth.database) });
  } catch {
    return NextResponse.json(
      { error: "Documents could not be loaded. Check workspace setup and retry." },
      { status: 503 },
    );
  }
}
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const length = Number(request.headers.get("content-length"));
  if (!Number.isFinite(length) || length <= 0 || length > DOCUMENT_MAX_BYTES + 16384)
    return NextResponse.json({ error: "Upload a document up to 8 MB" }, { status: 413 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      file.size > DOCUMENT_MAX_BYTES ||
      form.get("visibility") !== "workspace"
    )
      throw new Error("Choose a document and confirm workspace sharing");
    const mime = file.name.toLowerCase().endsWith(".md") ? "text/markdown" : file.type;
    const receipt = await uploadKnowledgeDocument(auth.database, {
      title: file.name,
      mime,
      bytes: new Uint8Array(await file.arrayBuffer()),
      actor: auth.user.email!,
    });
    return NextResponse.json(receipt, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const input = z
      .object({ id: z.string().uuid(), operation: z.enum(["retry", "archive"]) })
      .strict()
      .parse(await request.json());
    const receipt =
      input.operation === "retry"
        ? await queueDocumentIndex(auth.database, input.id, auth.user.email!)
        : await archiveKnowledgeDocument(auth.database, input.id, auth.user.email!);
    return NextResponse.json(receipt);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Document change failed" },
      { status: 400 },
    );
  }
}
