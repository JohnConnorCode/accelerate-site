#!/usr/bin/env tsx
/** Newline-delimited MCP bridge. Diagnostics belong on stderr, never stdout.
 * Prefer REVENUE_OS_MCP_URL plus an existing workspace bearer key. This mode
 * reuses HTTP authentication and needs no database service-role credential.
 * The legacy local database mode remains installation-owner operated only.
 */
import { readMcpLines } from "./lib/mcp-stdio";
import { mcpRequestSchema } from "../src/lib/revenue-os/mcp-request";
import type { McpJsonRpcResponse } from "../src/lib/revenue-os/mcp-server";

async function main() {
  const endpoint = process.env.REVENUE_OS_MCP_URL;
  let session: string | undefined;
  let protocol = "2025-06-18";
  let dispatch: (request: unknown) => Promise<McpJsonRpcResponse | null>;
  if (endpoint) {
    const url = new URL(endpoint);
    if (
      url.username ||
      url.password ||
      (url.protocol !== "https:" &&
        !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
    )
      throw new Error(
        "Use an HTTPS MCP endpoint or a loopback HTTP endpoint without URL credentials",
      );
    const key = process.env.MCP_API_KEY || process.env.REVENUE_OS_API_KEY;
    if (!key) throw new Error("An existing workspace MCP bearer key is required");
    const { readBoundedJson } = await import("../src/lib/http/bounded-json");
    dispatch = async (raw) => {
      const request = mcpRequestSchema.parse(raw);
      const response = await fetch(url, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(180_000),
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "MCP-Protocol-Version": protocol,
          ...(session ? { "Mcp-Session-Id": session } : {}),
        },
        body: JSON.stringify(request),
      });
      if (!response.ok)
        throw new Error(`Workspace MCP refused the request (HTTP ${response.status})`);
      if (response.status === 202 || response.status === 204) return null;
      const result = (await readBoundedJson(response, 1024 * 1024)) as McpJsonRpcResponse;
      if (result.jsonrpc !== "2.0" || result.id !== request.id || (!result.result && !result.error))
        throw new Error("Workspace MCP returned an invalid or mismatched response");
      if (request.method === "initialize" && result.result) {
        session = response.headers.get("Mcp-Session-Id") ?? undefined;
        const negotiated = (result.result as { protocolVersion?: unknown }).protocolVersion;
        if (typeof negotiated === "string") protocol = negotiated;
      }
      return request.id === undefined ? null : result;
    };
    process.stderr.write("[revenue-os-mcp] Connected to workspace HTTP transport\n");
  } else {
    const [
      { createServiceRoleClient },
      { accelerateSystemContext },
      { handleMcpRequest },
      { tenant },
    ] = await Promise.all([
      import("../src/lib/supabase/server"),
      import("../src/lib/tenancy/context"),
      import("../src/lib/revenue-os/mcp-server"),
      import("../src/config/tenant"),
    ]);
    const context = {
      supabase: createServiceRoleClient(accelerateSystemContext("mcp-stdio")),
      actorEmail: process.env.ADMIN_EMAIL || tenant.founder.email,
      tenantSlug: "accelerate",
      tenantConfig: tenant,
      principalKind: "integration" as const,
    };
    dispatch = (request) => handleMcpRequest(request, context);
    process.stderr.write("[revenue-os-mcp] Connected to owner-operated local database transport\n");
  }
  for await (const message of readMcpLines(process.stdin)) {
    let request: unknown;
    let response: McpJsonRpcResponse | null;
    try {
      if (message.error) throw new Error(message.error);
      if (!message.line) continue;
      request = JSON.parse(message.line);
    } catch {
      process.stdout.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Invalid, oversized or non-UTF-8 JSON message" },
        }) + "\n",
      );
      continue;
    }
    const parsed = mcpRequestSchema.safeParse(request);
    if (!parsed.success)
      response = {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32600, message: "Invalid MCP request envelope" },
      };
    else {
      try {
        response = await dispatch(parsed.data);
      } catch {
        response =
          parsed.data.id === undefined
            ? null
            : {
                jsonrpc: "2.0",
                id: parsed.data.id,
                error: {
                  code: -32603,
                  message:
                    "Workspace request failed. Check connection access and retry using the same operation identifiers.",
                },
              };
        process.stderr.write("[revenue-os-mcp] Workspace request failed\n");
      }
    }
    if (response !== null) process.stdout.write(JSON.stringify(response) + "\n");
  }
}
main().catch(() => {
  process.stderr.write(
    "[revenue-os-mcp] Connection setup failed. Check endpoint and existing credentials.\n",
  );
  process.exitCode = 1;
});
