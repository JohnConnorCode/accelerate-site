#!/usr/bin/env tsx
/**
 * Standalone Stdio Model Context Protocol (MCP) Server Runner
 *
 * Usage with Claude Desktop or Claude Code (see docs/self-hosting/MCP-SETUP.md
 * for the full guide, including why --conditions=react-server is required):
 * {
 *   "mcpServers": {
 *     "revenue-os": {
 *       "command": "npx",
 *       "args": ["tsx", "scripts/revenue-os-mcp.ts"],
 *       "env": {
 *         "NODE_OPTIONS": "--conditions=react-server",
 *         "ADMIN_EMAIL": "john@acceleratewith.us",
 *         "NEXT_PUBLIC_SUPABASE_URL": "...",
 *         "SUPABASE_SERVICE_ROLE_KEY": "..."
 *       }
 *     }
 *   }
 * }
 *
 * This must not call createServerSupabaseClient(): that function reads
 * next/headers' cookies(), which throws outside a Next.js request scope, and
 * this process runs as a plain Node child process launched by the MCP
 * client, never inside one. createServiceRoleClient(accelerateSystemContext)
 * reads SUPABASE_SERVICE_ROLE_KEY directly instead, which is also the
 * variable this file's own docs above already told an operator to set.
 */
import readline from "node:readline";
import { createServiceRoleClient } from "../src/lib/supabase/server";
import { accelerateSystemContext } from "../src/lib/tenancy/context";
import { handleMcpRequest, type McpJsonRpcRequest } from "../src/lib/revenue-os/mcp-server";
import { tenant } from "../src/config/tenant";

async function main() {
  process.stderr.write("[revenue-os-mcp] Initializing MCP stdio bridge...\n");
  const supabase = createServiceRoleClient(accelerateSystemContext("mcp-stdio"));
  const actorEmail = process.env.ADMIN_EMAIL || tenant.founder.email;

  const context = {
    supabase,
    actorEmail,
    tenantSlug: "accelerate",
    tenantConfig: tenant,
  };

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  process.stderr.write(`[revenue-os-mcp] Ready. Connected as ${actorEmail}\n`);

  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const request = JSON.parse(trimmed) as McpJsonRpcRequest;
      const response = await handleMcpRequest(request, context);
      // A true notification (no id member) returns null and must not write
      // any response line at all, per JSON-RPC 2.0.
      if (response !== null) process.stdout.write(JSON.stringify(response) + "\n");
    } catch (err) {
      process.stderr.write(`[revenue-os-mcp] Error processing line: ${err}\n`);
      const errorResponse = {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      };
      process.stdout.write(JSON.stringify(errorResponse) + "\n");
    }
  });
}

main().catch((err) => {
  process.stderr.write(`[revenue-os-mcp] Fatal: ${err}\n`);
  process.exit(1);
});
