import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { GraphInputError, readWorkspaceGraph } from "@/lib/revenue-os/graph-adapters";
import { workspaceGraphInputFromQuery } from "@/lib/revenue-os/graph-adapter-contract";

/**
 * Read-only workspace graph. The session actor is re-verified per source by
 * authorizeGraphSource; a refused or failed source returns a receipt, not an
 * error. Only malformed input fails the request.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const input = workspaceGraphInputFromQuery(request.nextUrl.searchParams);
    const graph = await readWorkspaceGraph(
      auth.database,
      {
        kind: "workspace_member",
        email: auth.user.email ?? "",
        userId: auth.user.id,
      },
      input,
    );
    return NextResponse.json(graph);
  } catch (error) {
    if (error instanceof ZodError || error instanceof GraphInputError)
      return NextResponse.json(
        {
          error:
            error instanceof GraphInputError
              ? error.message
              : "Check the graph filters: adapters, ids, relatedTo, limit (1-200) and cursors.",
          code: "invalid_input",
        },
        { status: 400 },
      );
    console.error("[graph] read failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "The workspace graph could not be loaded" }, { status: 500 });
  }
}
