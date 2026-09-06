import "server-only";

// ---------------------------------------------------------------------------
// MCP Client Connector: connects to external MCP servers and makes their
// tools available within the platform governance.
//
// Northstar §34: MCP tools must still be mapped into platform governance.
// The existence of an MCP tool does not automatically imply permission to use it.
//
// This module handles:
//   1. Discovery: list tools from an external MCP server
//   2. Execution: call a tool on an external MCP server
//   3. Governance: all discovered tools must be registered as plugin_tools
//      with an autonomy_level before they can be used.
// ---------------------------------------------------------------------------

export interface McpClientConfig {
  serverUrl: string;
  apiKey?: string;
  headers?: Record<string, string>;
  name: string;
}

export interface DiscoveredMcpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpClientResult {
  tools: DiscoveredMcpTool[];
  serverInfo: { name: string; version?: string } | null;
  protocolVersion: string;
}

// ---------------------------------------------------------------------------
// Discover tools from an external MCP server
// ---------------------------------------------------------------------------

export async function discoverMcpTools(config: McpClientConfig): Promise<McpClientResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...config.headers,
  };
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  // Step 1: Initialize the session.
  const initResponse = await fetch(config.serverUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "accelerate-mcp-client", version: "1.0.0" },
      },
    }),
  });

  if (!initResponse.ok) {
    throw new Error(`MCP initialize failed: ${initResponse.status} ${initResponse.statusText}`);
  }

  const initResult = await initResponse.json();
  if (initResult.error) {
    throw new Error(`MCP initialize error: ${initResult.error.message}`);
  }

  const serverInfo = initResult.result?.serverInfo ?? null;
  const protocolVersion = initResult.result?.protocolVersion ?? "2025-06-18";

  // Step 2: List tools.
  const toolsResponse = await fetch(config.serverUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    }),
  });

  if (!toolsResponse.ok) {
    throw new Error(`MCP tools/list failed: ${toolsResponse.status} ${toolsResponse.statusText}`);
  }

  const toolsResult = await toolsResponse.json();
  if (toolsResult.error) {
    throw new Error(`MCP tools/list error: ${toolsResult.error.message}`);
  }

  const tools: DiscoveredMcpTool[] = (toolsResult.result?.tools ?? []).map(
    (tool: { name?: string; description?: string; inputSchema?: Record<string, unknown> }) => ({
      name: tool.name ?? "unknown",
      description: tool.description ?? "",
      inputSchema: tool.inputSchema ?? {},
    }),
  );

  return { tools, serverInfo, protocolVersion };
}

// ---------------------------------------------------------------------------
// Execute a tool on an external MCP server
// ---------------------------------------------------------------------------

export async function executeMcpTool(
  config: McpClientConfig,
  toolName: string,
  toolInput: Record<string, unknown>,
): Promise<unknown> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...config.headers,
  };
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  const response = await fetch(config.serverUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: toolInput,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`MCP tools/call failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  if (result.error) {
    throw new Error(`MCP tools/call error: ${result.error.message}`);
  }

  return result.result;
}
