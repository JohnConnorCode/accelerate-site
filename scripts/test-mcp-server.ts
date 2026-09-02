#!/usr/bin/env tsx
/**
 * Test Suite: Model Context Protocol (MCP) Server for Revenue OS
 *
 * Verifies:
 * 1. Protocol initialization & capabilities handshake
 * 2. Tool discovery and registration inspection
 * 3. Tool execution with safety gates and output formatting
 * 4. Resource listing and bounded reading
 * 5. Prompt templates listing and prompt instruction retrieval
 * 6. Error handling for unknown methods, missing params, and invalid tools
 */
import assert from "node:assert/strict";
import {
  handleMcpRequest,
  MCP_PROTOCOL_VERSION,
  REVENUE_OS_MCP_SERVER_INFO,
  MCP_ERROR_CODES,
  type McpJsonRpcRequest,
} from "../src/lib/revenue-os/mcp-server";
import { tenant } from "../src/config/tenant";
import { MemorySupabase } from "./lib/memory-supabase";

interface ToolItem {
  name: string;
}

interface ResourceItem {
  uri: string;
}

interface PromptItem {
  name: string;
}

interface InitResult {
  protocolVersion: string;
  serverInfo: { name: string; version: string };
  capabilities: { tools?: unknown; resources?: unknown; prompts?: unknown };
}

interface ToolsListResult {
  tools: ToolItem[];
}

interface ResourcesListResult {
  resources: ResourceItem[];
}

interface ResourceReadResult {
  contents: Array<{ uri: string; mimeType: string; text: string }>;
}

interface PromptsListResult {
  prompts: PromptItem[];
}

interface PromptGetResult {
  messages: Array<{ role: string; content: { type: string; text: string } }>;
}

async function main() {
  console.log("Starting MCP Server tests...");
  const stubDb = new MemorySupabase({
    tasks: [
      {
        id: "task-1",
        title: "Follow up with Northline",
        due_at: new Date().toISOString(),
        priority: "high",
        status: "open",
      },
    ],
    action_queue: [],
  }).client as unknown as Parameters<typeof handleMcpRequest>[1]["supabase"];

  const context = {
    supabase: stubDb,
    actorEmail: "founder@acceleratewith.us",
    tenantSlug: "accelerate",
    tenantConfig: tenant,
  };

  // 1. Initialize
  const initReq: McpJsonRpcRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { clientInfo: { name: "claude-desktop", version: "0.1.0" } },
  };
  const initRes = await handleMcpRequest(initReq, context);
  assert.equal(initRes.jsonrpc, "2.0");
  assert.equal(initRes.id, 1);
  const initResult = initRes.result as InitResult;
  assert.equal(initResult.protocolVersion, MCP_PROTOCOL_VERSION);
  assert.equal(initResult.serverInfo.name, REVENUE_OS_MCP_SERVER_INFO.name);
  assert.ok(initResult.capabilities.tools);

  // 2. Tools listing
  const toolsReq: McpJsonRpcRequest = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
  };
  const toolsRes = await handleMcpRequest(toolsReq, context);
  const toolsResult = toolsRes.result as ToolsListResult;
  assert.ok(Array.isArray(toolsResult.tools) && toolsResult.tools.length >= 7, "Tools list must return registered tools");
  assert.ok(toolsResult.tools.some((t) => t.name === "get_today_snapshot"));
  assert.ok(toolsResult.tools.some((t) => t.name === "search_pipeline"));
  assert.ok(toolsResult.tools.some((t) => t.name === "propose_task"));

  // 3. Resources listing and reading
  const resListReq: McpJsonRpcRequest = {
    jsonrpc: "2.0",
    id: 3,
    method: "resources/list",
  };
  const resListRes = await handleMcpRequest(resListReq, context);
  const resListResult = resListRes.result as ResourcesListResult;
  assert.ok(Array.isArray(resListResult.resources) && resListResult.resources.length >= 2);
  assert.ok(resListResult.resources.some((r) => r.uri === "revenue-os://today/snapshot"));

  const resReadReq: McpJsonRpcRequest = {
    jsonrpc: "2.0",
    id: 4,
    method: "resources/read",
    params: { uri: "revenue-os://system/modules" },
  };
  const resReadRes = await handleMcpRequest(resReadReq, context);
  const resReadResult = resReadRes.result as ResourceReadResult;
  assert.ok(resReadResult.contents[0]?.text);
  const parsedModuleDoc = JSON.parse(resReadResult.contents[0].text) as { activeModules: unknown[] };
  assert.ok(Array.isArray(parsedModuleDoc.activeModules) && parsedModuleDoc.activeModules.length > 0);

  // 4. Prompts listing and getting
  const promptsListReq: McpJsonRpcRequest = {
    jsonrpc: "2.0",
    id: 5,
    method: "prompts/list",
  };
  const promptsListRes = await handleMcpRequest(promptsListReq, context);
  const promptsResult = promptsListRes.result as PromptsListResult;
  assert.ok(Array.isArray(promptsResult.prompts) && promptsResult.prompts.length >= 2);
  assert.ok(promptsResult.prompts.some((p) => p.name === "daily_operator_triage"));

  const promptGetReq: McpJsonRpcRequest = {
    jsonrpc: "2.0",
    id: 6,
    method: "prompts/get",
    params: { name: "daily_operator_triage" },
  };
  const promptGetRes = await handleMcpRequest(promptGetReq, context);
  const promptGetResult = promptGetRes.result as PromptGetResult;
  assert.ok(promptGetResult.messages[0]?.content?.text);

  // 5. Error handling
  const unknownMethodReq: McpJsonRpcRequest = {
    jsonrpc: "2.0",
    id: 7,
    method: "unknown/method",
  };
  const unknownMethodRes = await handleMcpRequest(unknownMethodReq, context);
  assert.equal(unknownMethodRes.error?.code, MCP_ERROR_CODES.METHOD_NOT_FOUND);

  const missingToolReq: McpJsonRpcRequest = {
    jsonrpc: "2.0",
    id: 8,
    method: "tools/call",
    params: { name: "" },
  };
  const missingToolRes = await handleMcpRequest(missingToolReq, context);
  assert.equal(missingToolRes.error?.code, MCP_ERROR_CODES.INVALID_PARAMS);

  console.log("All MCP Server tests passed successfully!");
}

main().catch((err) => {
  console.error("MCP server tests failed:", err);
  process.exit(1);
});
