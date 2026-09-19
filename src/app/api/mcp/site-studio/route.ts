import { NextResponse } from "next/server";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { handleMcpRequest, type McpJsonRpcRequest } from "@/lib/revenue-os/mcp-server";
import { runWithTenantRequestContext } from "@/lib/tenancy/context";
import { tenant } from "@/config/tenant";
import { authenticateSiteEditor, siteEditorOAuthConfig } from "@/lib/site-studio/delegation";
import { SITE_EDITOR_TOOL_NAMES } from "@/lib/site-studio/editor-contract";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 180;
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version, Mcp-Session-Id",
  "Access-Control-Expose-Headers": "WWW-Authenticate",
  "Cache-Control": "no-store",
};
export function OPTIONS() { return new NextResponse(null, { status: 204, headers }); }
export function GET() { return NextResponse.json({ error: "Use stateless Streamable HTTP POST. Server-initiated SSE is not supported." }, { status: 405, headers: { ...headers, Allow: "POST, OPTIONS" } }); }
export async function POST(request: Request) {
  let config;
  try { config = siteEditorOAuthConfig(); }
  catch { return NextResponse.json({ error: "Site Studio OAuth is not configured" }, { status: 503, headers }); }
  let delegation;
  try {
    const token = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1];
    if (!token || token.length > 16_000) throw new Error("Bearer token required");
    delegation = await authenticateSiteEditor(token);
  } catch {
    return NextResponse.json({ error: "Connect as the installation owner with an active Site Studio delegation." }, {
      status: 401, headers: { ...headers, "WWW-Authenticate": `Bearer resource_metadata="${config.metadata}", scope="openid email"` },
    });
  }
  if (!rateLimit(`site-editor-mcp:${delegation.grant.id}`, 120, 60_000).success)
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers });
  let body: McpJsonRpcRequest;
  try {
    body = await readBoundedJson(request, 8_010_000) as McpJsonRpcRequest;
    if (!body || body.jsonrpc !== "2.0" || typeof body.method !== "string" ||
      (body.id !== undefined && body.id !== null && typeof body.id !== "string" && typeof body.id !== "number"))
      throw new Error("Invalid request");
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid bounded JSON-RPC request" } }, { status: 400, headers });
  }
  const result = await runWithTenantRequestContext(delegation.auth, () => handleMcpRequest(body, {
    supabase: delegation.auth.database, actorEmail: delegation.auth.user.email!,
    tenantSlug: delegation.auth.tenant.slug,
    tenantConfig: { ...tenant, modules: delegation.auth.tenant.config.modules as Record<string, boolean> | undefined },
    principalKind: "workspace_member", allowedToolNames: SITE_EDITOR_TOOL_NAMES,
    siteEditorDelegation: delegation,
  }));
  return result === null ? new NextResponse(null, { status: 204, headers }) : NextResponse.json(result, { headers });
}
