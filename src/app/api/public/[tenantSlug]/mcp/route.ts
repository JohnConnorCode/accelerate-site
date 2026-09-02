import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  handleMcpRequest,
  REVENUE_OS_MCP_SERVER_INFO,
  MCP_PROTOCOL_VERSION,
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
  _request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  const { tenantSlug } = await context.params;
  return NextResponse.json({
    status: "ok",
    server: REVENUE_OS_MCP_SERVER_INFO,
    protocolVersion: MCP_PROTOCOL_VERSION,
    endpoint: `/api/public/${tenantSlug}/mcp`,
    auth: "Bearer token (tenant MCP key, generated from /admin/integrations)",
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  const { tenantSlug } = await context.params;
  const authHeader = request.headers.get("authorization");
  const auth = await resolveTenantMcpAuth(tenantSlug, authHeader);
  if (!auth) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32000, message: "Unauthorized: Invalid or missing tenant MCP API key" },
      },
      { status: 401 },
    );
  }

  let body: McpJsonRpcRequest;
  try {
    body = (await request.json()) as McpJsonRpcRequest;
    if (!body || body.jsonrpc !== "2.0" || !body.method) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: (body as Partial<McpJsonRpcRequest>)?.id ?? null,
          error: { code: -32600, message: "Invalid Request: JSON-RPC 2.0 with 'method' is required" },
        },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error: Invalid JSON received" },
      },
      { status: 400 },
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
    if (response === null) return new NextResponse(null, { status: 204 });
    return NextResponse.json(response);
  });
}
