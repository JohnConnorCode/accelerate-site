import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { forgetAgentMemory, updateAgentMemory } from "@/lib/revenue-os/memory";

function failure(error: unknown) {
  const message = (error as Error).message;
  const status = /not found/i.test(message)
    ? 404
    : /must be|unknown|no memory change/i.test(message)
      ? 400
      : 500;
  if (status === 500) console.error("Database error:", message);
  return NextResponse.json(
    { error: status === 500 ? "Memory change failed" : message },
    { status },
  );
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    console.warn("Memory API received a malformed JSON body");
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  try {
    const memory = await updateAgentMemory(
      auth.database,
      id,
      {
        subject: typeof body.subject === "string" ? body.subject : undefined,
        body: typeof body.body === "string" ? body.body : undefined,
        relevanceHorizon:
          typeof body.relevanceHorizon === "string"
            ? (body.relevanceHorizon as "session" | "daily" | "weekly" | "permanent")
            : undefined,
      },
      auth.user.email ?? auth.user.id,
    );
    return NextResponse.json({ memory });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;
  try {
    await forgetAgentMemory(auth.database, id, auth.user.email ?? auth.user.id);
    return NextResponse.json({ forgotten: id });
  } catch (error) {
    return failure(error);
  }
}
