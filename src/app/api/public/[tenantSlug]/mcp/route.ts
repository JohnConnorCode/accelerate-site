import { NextRequest, NextResponse } from "next/server";
import { createPlatformServiceRoleClient } from "@/lib/supabase/server";
import {
  handleMcpRequest,
  REVENUE_OS_MCP_SERVER_INFO,
  MCP_PROTOCOL_VERSION,
  type McpJsonRpcRequest,
} from "@/lib/revenue-os/mcp-server";
import { tenant as defaultTenant } from "@/config/tenant";
import { ACCELERATE_TENANT_SLUG } from "@/lib/tenancy/constants";
import { runWithTenantRequestContext, accelerateSystemContext } from "@/lib/tenancy/context";

export const runtime = "nodejs";

/**
 * Per-tenant MCP endpoint: /api/public/[tenantSlug]/mcp
 *
 * Allows each deployed tenant instance to expose its own isolated MCP surface
 * that an operator can point their Claude Desktop / ChatGPT / Antigravity config at,
 * completely separate from other tenants.
 *
 * Authentication: Bearer token matching the tenant's REVENUE_OS_API_KEY secret
 * stored in integration_connections with provider = 'mcp'.
 */

async function resolveTenantMcpAuth(
  tenantSlug: string,
  authHeader: string | null,
): Promise<{ actorEmail: string; tenantSlug: string } | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  // Platform-scoped lookup — the MCP API key is stored per-tenant in integration_connections
  const platform = createPlatformServiceRoleClient("mcp-tenant-auth");
  const { data: tenantRow } = await platform
    .from("tenants")
    .select("id,slug,status")
    .eq("slug", tenantSlug)
    .maybeSingle();
  if (!tenantRow || tenantRow.status !== "active") return null;

  const { data: conn } = await platform
    .from("integration_connections")
    .select("status,encrypted_credentials,environment_fallback_allowed")
    .eq("tenant_id", tenantRow.id)
    .eq("provider", "mcp")
    .maybeSingle();

  // Allow environment variable fallback for the platform's own tenant
  const allowEnv =
    tenantRow.slug === ACCELERATE_TENANT_SLUG && (!conn || conn.environment_fallback_allowed);

  let configuredKey: string | null = null;
  if (conn?.status === "connected" && conn.encrypted_credentials) {
    const creds = conn.encrypted_credentials as Record<string, unknown>;
    configuredKey = typeof creds.api_key === "string" ? creds.api_key : null;
  }
  if (!configuredKey && allowEnv) {
    configuredKey = process.env.REVENUE_OS_API_KEY || process.env.MCP_API_KEY || null;
  }

  if (!configuredKey || token !== configuredKey) return null;

  return {
    actorEmail: defaultTenant.founder.email,
    tenantSlug: tenantRow.slug,
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
    auth: "Bearer token (tenant REVENUE_OS_API_KEY)",
    docs: "https://github.com/acceleratewith/revenue-os/docs/mcp",
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

  const supabase = createPlatformServiceRoleClient(`mcp-tenant:${tenantSlug}`);
  const tenantContext = accelerateSystemContext(`mcp-tenant:${tenantSlug}`);

  return runWithTenantRequestContext(tenantContext, async () => {
    const response = await handleMcpRequest(body, {
      supabase,
      actorEmail: auth.actorEmail,
      tenantSlug: auth.tenantSlug,
      tenantConfig: defaultTenant,
    });
    return NextResponse.json(response);
  });
}
