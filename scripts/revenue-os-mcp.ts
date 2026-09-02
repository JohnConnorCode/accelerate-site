#!/usr/bin/env tsx
/**
 * Standalone Stdio Model Context Protocol (MCP) Server Runner
 *
 * Usage with Claude Desktop or Claude Code:
 * {
 *   "mcpServers": {
 *     "revenue-os": {
 *       "command": "npx",
 *       "args": ["tsx", "scripts/revenue-os-mcp.ts"],
 *       "env": {
 *         "ADMIN_EMAIL": "john@acceleratewith.us",
 *         "NEXT_PUBLIC_SUPABASE_URL": "...",
 *         "SUPABASE_SERVICE_ROLE_KEY": "..."
 *       }
 *     }
 *   }
 * }
 */
import readline from "node:readline";
import { createServerSupabaseClient } from "../src/lib/supabase/server";
import {
  handleMcpRequest,
  type McpJsonRpcRequest,
} from "../src/lib/revenue-os/mcp-server";
import { tenant } from "../src/config/tenant";

async function main() {
  process.stderr.write("[revenue-os-mcp] Initializing MCP stdio bridge...\n");
  const supabase = await createServerSupabaseClient();
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
      process.stdout.write(JSON.stringify(response) + "\n");
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
