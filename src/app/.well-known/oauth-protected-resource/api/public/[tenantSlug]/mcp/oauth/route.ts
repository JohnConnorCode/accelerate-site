import { NextResponse } from "next/server";
import { workspaceMcpOAuthConfig } from "@/lib/revenue-os/workspace-mcp-oauth";

export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const config = workspaceMcpOAuthConfig((await context.params).tenantSlug);
    return NextResponse.json(
      {
        resource: config.resource,
        authorization_servers: [config.issuer],
        scopes_supported: ["openid", "email"],
        bearer_methods_supported: ["header"],
        resource_name: "Command Center workspace",
      },
      { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Workspace MCP OAuth is not configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
