import { runWithTenantRequestContext } from "@/lib/tenancy/context";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { z } from "zod";
import {
  workspaceConfigurationPreviewSchema,
  workspaceConfigurationProposalSchema,
} from "@/lib/revenue-os/workspace-configuration-contract";
import {
  readWorkspaceConfiguration,
  previewWorkspaceConfiguration,
  proposeWorkspaceConfiguration,
} from "@/lib/revenue-os/workspace-configuration";
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(await readWorkspaceConfiguration(auth.database, {}));
  } catch {
    console.error("[workspace-configuration] Read refused");
    return NextResponse.json(
      { error: "Workspace configuration could not be loaded" },
      { status: 503 },
    );
  }
}
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const input = z
    .discriminatedUnion("action", [
      workspaceConfigurationPreviewSchema.extend({ action: z.literal("preview") }),
      workspaceConfigurationProposalSchema.extend({ action: z.literal("propose") }),
    ])
    .safeParse(
      await readBoundedJson(request).catch(() => {
        console.error("[workspace-configuration] Invalid request body refused");
        return null;
      }),
    );
  if (!input.success)
    return NextResponse.json({ error: "Invalid configuration proposal" }, { status: 400 });
  try {
    const { action, ...body } = input.data;
    return NextResponse.json(
      await runWithTenantRequestContext(auth, () =>
        action === "preview"
          ? previewWorkspaceConfiguration(auth.database, body)
          : proposeWorkspaceConfiguration(auth.database, body, auth.user.email!),
      ),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Configuration proposal refused" },
      { status: 409 },
    );
  }
}
