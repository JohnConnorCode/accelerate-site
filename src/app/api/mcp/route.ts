import { NextRequest, NextResponse } from "next/server";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  handleMcpRequest,
  REVENUE_OS_MCP_SERVER_INFO,
  MCP_PROTOCOL_VERSION,
  MCP_SUPPORTED_PROTOCOL_VERSIONS,
  type McpJsonRpcRequest,
} from "@/lib/revenue-os/mcp-server";
import { tenant } from "@/config/tenant";
import { accelerateSystemContext } from "@/lib/tenancy/context";

export const runtime = "nodejs";

/**
 * Access-Control-Allow-Credentials is deliberately never set, so a
 * cross-origin browser call never carries this endpoint's session cookie
 * (fetch's default is credentials: "same-origin"); a wildcard origin is
 * therefore safe here too — cross-origin callers can only reach this
 * endpoint through the Bearer-token path, never the session-cookie path.
 */
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version",
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

export async function GET(request: NextRequest) {
  if (request.headers.get("accept")?.includes("text/event-stream")) {
    return withCors(
      NextResponse.json(
        { error: "This server does not support server-initiated SSE streams." },
        { status: 405, headers: { Allow: "GET, POST, OPTIONS" } },
      ),
    );
  }
  return withCors(
    NextResponse.json({
      status: "ok",
      server: REVENUE_OS_MCP_SERVER_INFO,
      protocolVersion: MCP_PROTOCOL_VERSION,
      supportedProtocolVersions: MCP_SUPPORTED_PROTOCOL_VERSIONS,
      endpoint: "/api/mcp",
      auth: "Bearer token or session admin",
    }),
  );
}

export async function POST(request: NextRequest) {
  const auth = await resolveMcpAuth(request);
  if (!auth) {
    return withCors(
      NextResponse.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32000,
            message: "Unauthorized: Invalid or missing API key / admin session",
          },
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
            id: body?.id ?? null,
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

  const response = await handleMcpRequest(body, {
    supabase: auth.supabase,
    actorEmail: auth.actorEmail,
    tenantSlug: auth.tenantSlug,
    tenantConfig: auth.tenantConfig,
  });

  if (response === null) return withCors(new NextResponse(null, { status: 204 }));
  const nextResponse = withCors(NextResponse.json(response));
  if (body.method === "initialize") nextResponse.headers.set("Mcp-Session-Id", randomUUID());
  return nextResponse;
}
