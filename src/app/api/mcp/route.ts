import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  handleMcpRequest,
  REVENUE_OS_MCP_SERVER_INFO,
  MCP_PROTOCOL_VERSION,
  type McpJsonRpcRequest,
} from "@/lib/revenue-os/mcp-server";
import { tenant } from "@/config/tenant";
import { accelerateSystemContext } from "@/lib/tenancy/context";

export const runtime = "nodejs";

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) {
    timingSafeEqual(bufferA, Buffer.alloc(bufferA.length));
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Validates request authorization: either via an API key or an active admin session.
 *
 * This is the platform/bootstrap endpoint for Accelerate's own reference
 * deployment specifically (tenantSlug is always "accelerate" here); a
 * self-hosted fork's own tenant uses /api/public/[tenantSlug]/mcp instead.
 */
async function resolveMcpAuth(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    // Validate against configured API key
    const configuredApiKey = process.env.REVENUE_OS_API_KEY || process.env.MCP_API_KEY;
    if (configuredApiKey && timingSafeStringEqual(token, configuredApiKey)) {
      const supabase = createServiceRoleClient(accelerateSystemContext("mcp-platform"));
      return {
        supabase,
        actorEmail: process.env.ADMIN_EMAIL || tenant.founder.email,
        tenantSlug: "accelerate",
        tenantConfig: tenant,
      };
    }
  }

  // Fallback to session admin authentication
  const sessionAuth = await requireAdmin();
  if (sessionAuth instanceof NextResponse) {
    return null;
  }

  return {
    supabase: sessionAuth.database,
    actorEmail: sessionAuth.user.email || tenant.founder.email,
    tenantSlug: sessionAuth.tenant.slug,
    tenantConfig: tenant,
  };
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    server: REVENUE_OS_MCP_SERVER_INFO,
    protocolVersion: MCP_PROTOCOL_VERSION,
    endpoint: "/api/mcp",
    auth: "Bearer token or session admin",
  });
}

export async function POST(request: NextRequest) {
  const auth = await resolveMcpAuth(request);
  if (!auth) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32000,
          message: "Unauthorized: Invalid or missing API key / admin session",
        },
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
          id: body?.id ?? null,
          error: {
            code: -32600,
            message: "Invalid Request: JSON-RPC 2.0 with 'method' is required",
          },
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

  const response = await handleMcpRequest(body, {
    supabase: auth.supabase,
    actorEmail: auth.actorEmail,
    tenantSlug: auth.tenantSlug,
    tenantConfig: auth.tenantConfig,
  });

  if (response === null) return new NextResponse(null, { status: 204 });
  return NextResponse.json(response);
}
