import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { readBoundedJson } from "@/lib/http/bounded-json";
import {
  handleMcpRequest,
  type McpJsonRpcRequest,
} from "@/lib/revenue-os/mcp-server";
import {
  authenticateWorkspaceMcp,
  workspaceMcpOAuthConfig,
} from "@/lib/revenue-os/workspace-mcp-oauth";
import { parseTaskToolProfile } from "@/lib/revenue-os/tool-profiles";
import { runWithTenantRequestContext } from "@/lib/tenancy/context";
import { tenant } from "@/config/tenant";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version, Mcp-Session-Id",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id",
  "Cache-Control": "no-store",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers });
}
export function GET() {
  return NextResponse.json(
    { error: "Use stateless Streamable HTTP POST. Server-initiated SSE is not supported." },
    { status: 405, headers: { ...headers, Allow: "POST, OPTIONS" } },
  );
}
export async function POST(
  request: Request,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  const { tenantSlug } = await context.params;
  let config;
  try {
    config = workspaceMcpOAuthConfig(tenantSlug);
  } catch {
    return NextResponse.json(
      { error: "Workspace MCP OAuth is not configured" },
      { status: 503, headers },
    );
  }
  let connection;
  try {
    const token = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1];
    if (!token || token.length > 16_000) throw new Error("Bearer token required");
    connection = await authenticateWorkspaceMcp(token, tenantSlug);
  } catch {
    return NextResponse.json(
      { error: "Connect as an active workspace admin with an approved OAuth delegation." },
      {
        status: 401,
        headers: {
          ...headers,
          "WWW-Authenticate": `Bearer resource_metadata="${config.metadata}", scope="openid email", error="invalid_token", error_description="Connect as an active workspace admin"`,
        },
      },
    );
  }
  const limit = await rateLimit(`workspace-mcp:${connection.grant.id}`, 120, 60_000);
  if (!limit.success) return rateLimitResponse(limit, { error: "Rate limit exceeded" }, headers);
  let body: McpJsonRpcRequest;
  try {
    body = (await readBoundedJson(request, 256_000)) as McpJsonRpcRequest;
    if (
      !body ||
      body.jsonrpc !== "2.0" ||
      typeof body.method !== "string" ||
      (body.id !== undefined &&
        body.id !== null &&
        typeof body.id !== "string" &&
        typeof body.id !== "number")
    )
      throw new Error("Invalid request");
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid bounded JSON-RPC request" } },
      { status: 400, headers },
    );
  }
  const result = await runWithTenantRequestContext(connection.auth, () =>
    handleMcpRequest(body, {
      supabase: connection.auth.database,
      actorEmail: connection.auth.user.email!,
      tenantSlug: connection.auth.tenant.slug,
      tenantConfig: {
        ...tenant,
        modules: connection.auth.tenant.config.modules as Record<string, boolean> | undefined,
      },
      toolProfile: parseTaskToolProfile(new URL(request.url).searchParams.get("profile")),
      principalKind: "workspace_member",
      oauthAuthenticated: true,
    }),
  );
  if (result === null) return new NextResponse(null, { status: 204, headers });
  const response = NextResponse.json(result, { headers });
  if (body.method === "initialize") response.headers.set("Mcp-Session-Id", randomUUID());
  return response;
}
