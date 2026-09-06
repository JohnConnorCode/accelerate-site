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
  MCP_SUPPORTED_PROTOCOL_VERSIONS,
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
  registryVersion: string;
}

interface ToolsCallResult {
  content: Array<{ type: string; text: string }>;
  isError: boolean;
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
  const initRes = (await handleMcpRequest(initReq, context))!;
  assert.equal(initRes.jsonrpc, "2.0");
  assert.equal(initRes.id, 1);
  const initResult = initRes.result as InitResult;
  assert.equal(initResult.protocolVersion, MCP_PROTOCOL_VERSION);
  assert.equal(initResult.serverInfo.name, REVENUE_OS_MCP_SERVER_INFO.name);
  assert.ok(initResult.capabilities.tools);

  // 1b. Protocol version negotiation: a client that names a version we
  // support gets exactly that version echoed back, not a fixed constant, so
  // a client that strictly compares its request against the response never
  // sees a false mismatch. An unrecognized or absent version falls back to
  // our default rather than lying about supporting something we don't.
  for (const requested of MCP_SUPPORTED_PROTOCOL_VERSIONS) {
    const negotiated = (await handleMcpRequest(
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: requested } },
      context,
    ))!.result as InitResult;
    assert.equal(
      negotiated.protocolVersion,
      requested,
      `a client requesting ${requested} must get exactly ${requested} back`,
    );
  }
  const unrecognizedVersion = (await handleMcpRequest(
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "1900-01-01" } },
    context,
  ))!.result as InitResult;
  assert.equal(
    unrecognizedVersion.protocolVersion,
    MCP_PROTOCOL_VERSION,
    "an unrecognized requested version must fall back to our default, never be echoed as-is",
  );
  const noVersionRequested = (await handleMcpRequest(
    { jsonrpc: "2.0", id: 1, method: "initialize" },
    context,
  ))!.result as InitResult;
  assert.equal(noVersionRequested.protocolVersion, MCP_PROTOCOL_VERSION);

  // 2. Tools listing
  const toolsReq: McpJsonRpcRequest = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
  };
  const toolsRes = (await handleMcpRequest(toolsReq, context))!;
  const toolsResult = toolsRes.result as ToolsListResult;
  assert.ok(
    Array.isArray(toolsResult.tools) && toolsResult.tools.length >= 10,
    "Tools list must return registered tools",
  );
  assert.ok(toolsResult.tools.some((t) => t.name === "get_today_snapshot"));
  assert.ok(toolsResult.tools.some((t) => t.name === "search_pipeline"));
  assert.ok(toolsResult.tools.some((t) => t.name === "search_contacts"));
  assert.ok(toolsResult.tools.some((t) => t.name === "search_conversations"));
  assert.ok(toolsResult.tools.some((t) => t.name === "get_pending_actions"));
  assert.ok(toolsResult.tools.some((t) => t.name === "propose_conversation_reply"));
  assert.ok(toolsResult.tools.some((t) => t.name === "propose_task"));
  assert.ok(toolsResult.tools.some((t) => t.name === "propose_task_update"));
  assert.ok(toolsResult.registryVersion, "tools/list must report the registry version it served");

  // 2b. tools/call actually executes a tool and returns MCP content, not just
  // a bare JSON-RPC result. propose_task_update is the case that matters here:
  // it is the tool that lets an MCP client write to the DB at all, by staging
  // a proposal a human approves — this proves that staging round-trips
  // through the real JSON-RPC content envelope end to end.
  const callReq: McpJsonRpcRequest = {
    jsonrpc: "2.0",
    id: 9,
    method: "tools/call",
    params: {
      name: "propose_task_update",
      arguments: { taskId: "task-1", changeType: "complete" },
    },
  };
  const callRes = (await handleMcpRequest(callReq, context))!;
  const callResult = callRes.result as ToolsCallResult;
  assert.equal(callResult.isError, false);
  const staged = JSON.parse(callResult.content[0]!.text) as { id: string; action_type: string };
  assert.ok(staged.id, "a successful propose_task_update call must return the staged proposal id");
  assert.equal(staged.action_type, "update_task");

  // A tool call that fails validation comes back as isError: true content,
  // per MCP's spec (a normal result the model can read and retry from), not
  // a transport-level JSON-RPC error that looks like the protocol broke.
  const badCallReq: McpJsonRpcRequest = {
    jsonrpc: "2.0",
    id: 10,
    method: "tools/call",
    params: {
      name: "propose_task_update",
      arguments: { taskId: "task-1", changeType: "snooze" },
    },
  };
  const badCallRes = (await handleMcpRequest(badCallReq, context))!;
  const badCallResult = badCallRes.result as ToolsCallResult;
  assert.equal(badCallResult.isError, true);
  assert.match(badCallResult.content[0]!.text, /requires "until"/);

  // 3. Resources listing and reading
  const resListReq: McpJsonRpcRequest = {
    jsonrpc: "2.0",
    id: 3,
    method: "resources/list",
  };
  const resListRes = (await handleMcpRequest(resListReq, context))!;
  const resListResult = resListRes.result as ResourcesListResult;
  assert.ok(Array.isArray(resListResult.resources) && resListResult.resources.length >= 2);
  assert.ok(resListResult.resources.some((r) => r.uri === "revenue-os://today/snapshot"));

  const resReadReq: McpJsonRpcRequest = {
    jsonrpc: "2.0",
    id: 4,
    method: "resources/read",
    params: { uri: "revenue-os://system/modules" },
  };
  const resReadRes = (await handleMcpRequest(resReadReq, context))!;
  const resReadResult = resReadRes.result as ResourceReadResult;
  assert.ok(resReadResult.contents[0]?.text);
  const parsedModuleDoc = JSON.parse(resReadResult.contents[0].text) as {
    activeModules: unknown[];
  };
  assert.ok(
    Array.isArray(parsedModuleDoc.activeModules) && parsedModuleDoc.activeModules.length > 0,
  );

  // 4. Prompts listing and getting
  const promptsListReq: McpJsonRpcRequest = {
    jsonrpc: "2.0",
    id: 5,
    method: "prompts/list",
  };
  const promptsListRes = (await handleMcpRequest(promptsListReq, context))!;
  const promptsResult = promptsListRes.result as PromptsListResult;
  assert.ok(Array.isArray(promptsResult.prompts) && promptsResult.prompts.length >= 4);
  assert.ok(promptsResult.prompts.some((p) => p.name === "daily_operator_triage"));
  assert.ok(promptsResult.prompts.some((p) => p.name === "triage_inbox_conversations"));

  const promptGetReq: McpJsonRpcRequest = {
    jsonrpc: "2.0",
    id: 6,
    method: "prompts/get",
    params: { name: "triage_inbox_conversations" },
  };
  const promptGetRes = (await handleMcpRequest(promptGetReq, context))!;
  const promptGetResult = promptGetRes.result as PromptGetResult;
  assert.ok(promptGetResult.messages[0]?.content?.text);
  assert.match(promptGetResult.messages[0].content.text, /search_conversations/);

  // 5. Error handling
  const unknownMethodReq: McpJsonRpcRequest = {
    jsonrpc: "2.0",
    id: 7,
    method: "unknown/method",
  };
  const unknownMethodRes = (await handleMcpRequest(unknownMethodReq, context))!;
  assert.equal(unknownMethodRes.error?.code, MCP_ERROR_CODES.METHOD_NOT_FOUND);

  const missingToolReq: McpJsonRpcRequest = {
    jsonrpc: "2.0",
    id: 8,
    method: "tools/call",
    params: { name: "" },
  };
  const missingToolRes = (await handleMcpRequest(missingToolReq, context))!;
  assert.equal(missingToolRes.error?.code, MCP_ERROR_CODES.INVALID_PARAMS);

  // 9. True JSON-RPC notification (no id member at all): per spec, must not
  // receive a response body. handleMcpRequest signals this by returning null;
  // the two HTTP routes turn that into a 204 with no body.
  const trueNotification = {
    jsonrpc: "2.0",
    method: "notifications/initialized",
  } as McpJsonRpcRequest;
  const trueNotificationRes = await handleMcpRequest(trueNotification, context);
  assert.equal(
    trueNotificationRes,
    null,
    "A true notification (no id) must return null, not a response body",
  );

  // A client that mistakenly attaches an id to the same method still gets a
  // normal response, for compatibility.
  const notifWithId: McpJsonRpcRequest = {
    jsonrpc: "2.0",
    id: 999,
    method: "notifications/initialized",
  };
  const notifWithIdRes = (await handleMcpRequest(notifWithId, context))!;
  assert.ok(notifWithIdRes, "notifications/initialized with an id must still respond");
  assert.equal(notifWithIdRes.id, 999);

  console.log("All MCP Server tests passed successfully!");
}

main().catch((err) => {
  console.error("MCP server tests failed:", err);
  process.exit(1);
});
