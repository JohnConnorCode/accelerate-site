import { NextRequest, NextResponse } from "next/server";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  handleMcpRequest,
  REVENUE_OS_MCP_SERVER_INFO,
  MCP_PROTOCOL_VERSION,
  MCP_SUPPORTED_PROTOCOL_VERSIONS,
  type McpJsonRpcRequest,
} from "@/lib/revenue-os/mcp-server";
import { tenant as defaultTenant } from "@/config/tenant";
import { resolveTenantProviderSecrets } from "@/lib/tenancy/providers";
import { runWithTenantRequestContext, type TenantSystemContext } from "@/lib/tenancy/context";

export const runtime = "nodejs";

/**
 * Per-tenant MCP endpoint: /api/public/[tenantSlug]/mcp
 *
 * Allows each deployed tenant instance to expose its own isolated MCP surface
 * that an operator can point their Claude Desktop / ChatGPT / Antigravity config at,
 * completely separate from other tenants.
 *
 * Authentication: Bearer token matching the tenant's own MCP key, generated once
 * from /admin/integrations and stored encrypted in integration_connections under
 * provider = 'mcp'. Resolved through resolveTenantProviderSecrets, the same helper
 * every other tenant-scoped provider (Resend, Calendly, WhatsApp, HubSpot) uses, so
 * the key is read back through the same encrypted envelope, never plaintext.
 */

/**
 * The Streamable HTTP transport spec (2025-03-26/2025-06-18) permits the
 * client's own web-based UI to call the MCP endpoint directly rather than
 * through a server-side proxy, so this endpoint needs real CORS support.
 * A wildcard origin is safe here specifically because authorization is a
 * Bearer token read from the Authorization header, never a cookie: a
 * cross-origin page can set that header only if it already has the tenant's
 * MCP key, at which point CORS was never the boundary protecting it.
 */
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
  "Access-Control-Max-Age": "86400",
};

function withCors(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(CORS_HEADERS)) response.headers.set(key, value);
  return response;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  // timingSafeEqual throws on length mismatch; compare against a same-length
  // dummy first so a wrong-length token can't short-circuit before the
  // constant-time comparison runs.
  if (bufferA.length !== bufferB.length) {
    timingSafeEqual(bufferA, Buffer.alloc(bufferA.length));
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

async function resolveTenantMcpAuth(
  tenantSlug: string,
  authHeader: string | null,
): Promise<{ actorEmail: string; context: TenantSystemContext } | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const resolved = await resolveTenantProviderSecrets(tenantSlug, "mcp");
  if (!resolved) return null;

  const configuredKey =
    resolved.apiKey || (resolved.allowEnvironment ? process.env.REVENUE_OS_API_KEY || process.env.MCP_API_KEY || null : null);
  if (!configuredKey || !timingSafeStringEqual(token, configuredKey)) return null;

  return {
    actorEmail: defaultTenant.founder.email,
    // The resolved context carries the tenant this key actually belongs to,
    // never a hardcoded platform tenant — this is the isolation boundary.
    context: resolved.context,
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  // A Streamable HTTP client's GET means "open a server-push SSE stream,"
  // signaled by requiring text/event-stream in Accept. This server has
  // nothing to push (every result comes back on the POST that asked for it),
  // so the spec-correct answer is 405, not a silent hang. A plain browser or
  // health-check hit — no such Accept header — gets a friendly status body
  // instead of an error, since that caller isn't speaking MCP transport.
  if (request.headers.get("accept")?.includes("text/event-stream")) {
    return withCors(
      NextResponse.json(
        { error: "This server does not support server-initiated SSE streams." },
        { status: 405, headers: { Allow: "GET, POST, DELETE, OPTIONS" } },
      ),
    );
  }
  const { tenantSlug } = await context.params;
  return withCors(
    NextResponse.json({
      status: "ok",
      server: REVENUE_OS_MCP_SERVER_INFO,
      protocolVersion: MCP_PROTOCOL_VERSION,
      supportedProtocolVersions: MCP_SUPPORTED_PROTOCOL_VERSIONS,
      endpoint: `/api/public/${tenantSlug}/mcp`,
      auth: "Bearer token (tenant MCP key, generated from /admin/integrations)",
    }),
  );
}

/**
 * This server is stateless — auth is a per-request Bearer token, not a
 * session — so there is no session to end. 405 is the spec-sanctioned
 * response for a server that does not allow clients to terminate sessions.
 */
export async function DELETE() {
  return withCors(
    NextResponse.json(
      { error: "This server does not use sessions; there is nothing to terminate." },
      { status: 405, headers: { Allow: "GET, POST, DELETE, OPTIONS" } },
    ),
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  const { tenantSlug } = await context.params;
  const authHeader = request.headers.get("authorization");
  const auth = await resolveTenantMcpAuth(tenantSlug, authHeader);
  if (!auth) {
    return withCors(
      NextResponse.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32000, message: "Unauthorized: Invalid or missing tenant MCP API key" },
        },
        { status: 401 },
      ),
    );
  }

  let body: McpJsonRpcRequest;
  try {
    body = (await request.json()) as McpJsonRpcRequest;
    if (!body || body.jsonrpc !== "2.0" || !body.method) {
      return withCors(
        NextResponse.json(
          {
            jsonrpc: "2.0",
            id: (body as Partial<McpJsonRpcRequest>)?.id ?? null,
            error: {
              code: -32600,
              message: "Invalid Request: JSON-RPC 2.0 with 'method' is required",
            },
          },
          { status: 400 },
        ),
      );
    }
  } catch {
    return withCors(
      NextResponse.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error: Invalid JSON received" },
        },
        { status: 400 },
      ),
    );
  }

  return runWithTenantRequestContext(auth.context, async () => {
    // Tenant-bound: createServiceRoleClient(systemContext) resolves the request
    // context set above and binds every table read/write to auth.context.tenantId,
    // instead of the unbound platform client this endpoint used before.
    const supabase = createServiceRoleClient(auth.context);
    const response = await handleMcpRequest(body, {
      supabase,
      actorEmail: auth.actorEmail,
      tenantSlug: auth.context.tenantSlug,
      tenantConfig: defaultTenant,
    });
    // handleMcpRequest returns null for a true notification (no id member),
    // which per JSON-RPC 2.0 must not receive a response body at all.
    if (response === null) return withCors(new NextResponse(null, { status: 204 }));
    const nextResponse = withCors(NextResponse.json(response));
    // Sessions are optional on this stateless server (auth is a per-request
    // Bearer token, nothing server-side keys off a session), but issuing one
    // on initialize costs nothing and satisfies a client that insists on
    // seeing Mcp-Session-Id before it will send anything after initialize.
    // We never require it back: a client that ignores it still works.
    if (body.method === "initialize") nextResponse.headers.set("Mcp-Session-Id", randomUUID());
    return nextResponse;
  });
}
