import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getRevenueAiTools,
  executeRegisteredRevenueTool,
  AI_TOOL_REGISTRY_VERSION,
  type RevenueToolPackId,
} from "./ai-tools";
import { loadOperatorQueue } from "./queue";
import { getActiveModules } from "./modules";
import { tenant as defaultTenant } from "@/config/tenant";

export const MCP_PROTOCOL_VERSION = "2024-11-05";
export const REVENUE_OS_MCP_SERVER_INFO = {
  name: "revenue-os-mcp",
  version: "1.0.0",
};

export interface McpJsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface McpJsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface McpServerContext {
  supabase: SupabaseClient;
  actorEmail: string;
  tenantSlug?: string;
  tenantConfig?: typeof defaultTenant | null;
  toolPack?: RevenueToolPackId;
}

/**
 * Standard MCP JSON-RPC Error Codes
 */
export const MCP_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
};

/**
 * Live Resources exposed by Revenue OS via MCP
 */
export const MCP_REVENUE_OS_RESOURCES = [
  {
    uri: "revenue-os://today/snapshot",
    name: "Today Command Center Snapshot",
    description: "Daily operator queue, pending approvals, and top revenue priorities.",
    mimeType: "application/json",
  },
  {
    uri: "revenue-os://system/modules",
    name: "Revenue OS Active Modules",
    description: "List of active and optional business modules in this workspace.",
    mimeType: "application/json",
  },
  {
    uri: "revenue-os://knowledge/registry",
    name: "Second Brain Knowledge Context",
    description: "Knowledge base configuration and Grounding Substrate status.",
    mimeType: "application/json",
  },
] as const;

/**
 * Pre-configured prompt templates for AI assistants (Claude, ChatGPT, etc.)
 */
export const MCP_REVENUE_OS_PROMPTS = [
  {
    name: "daily_operator_triage",
    description: "Review today's operator queue, outstanding action proposals, and unread conversations.",
    arguments: [],
  },
  {
    name: "pipeline_health_check",
    description: "Inspect pipeline opportunities stuck in stage or lacking scheduled next actions.",
    arguments: [
      {
        name: "stage",
        description: "Optional specific pipeline stage to analyze (e.g., inquiry, qualified, proposal, negotiation)",
        required: false,
      },
    ],
  },
  {
    name: "reactivate_stale_deals",
    description: "Find stale opportunities and draft grounded recovery outreach for founder approval.",
    arguments: [],
  },
] as const;

/**
 * Dispatches an incoming MCP JSON-RPC 2.0 request to the appropriate Revenue OS handler.
 */
export async function handleMcpRequest(
  request: McpJsonRpcRequest,
  context: McpServerContext,
): Promise<McpJsonRpcResponse> {
  const { id, method, params = {} } = request;

  try {
    switch (method) {
      case "initialize": {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: MCP_PROTOCOL_VERSION,
            serverInfo: REVENUE_OS_MCP_SERVER_INFO,
            capabilities: {
              tools: { listChanged: false },
              resources: { subscribe: false, listChanged: false },
              prompts: { listChanged: false },
            },
            instructions:
              `You are connected to ${context.tenantConfig?.brand.name || "Revenue OS"}. All read queries are bounded and grounded. ` +
              "All mutations (status changes, tasks, emails, campaigns) generate safe proposals in the " +
              "action_queue requiring founder confirmation before external execution.",
          },
        };
      }

      case "notifications/initialized": {
        // Notification, no response required
        return { jsonrpc: "2.0", id, result: { initialized: true } };
      }

      case "ping": {
        return { jsonrpc: "2.0", id, result: {} };
      }

      case "tools/list": {
        const tools = getRevenueAiTools(context.toolPack).map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          impact: tool.impact,
          confirmationRequired: tool.confirmationRequired,
        }));
        return {
          jsonrpc: "2.0",
          id,
          result: { tools, registryVersion: AI_TOOL_REGISTRY_VERSION },
        };
      }

      case "tools/call": {
        const toolName = String(params.name || "");
        const toolArguments = (params.arguments as Record<string, unknown>) || {};
        if (!toolName) {
          return {
            jsonrpc: "2.0",
            id,
            error: {
              code: MCP_ERROR_CODES.INVALID_PARAMS,
              message: "Missing tool name in tools/call request",
            },
          };
        }

        const execution = await executeRegisteredRevenueTool(
          {
            supabase: context.supabase,
            actorEmail: context.actorEmail,
            toolPack: context.toolPack,
            tenantConfig: context.tenantConfig,
          },
          toolName,
          toolArguments,
        );

        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify(execution.output, null, 2),
              },
            ],
            isError: false,
          },
        };
      }

      case "resources/list": {
        return {
          jsonrpc: "2.0",
          id,
          result: { resources: MCP_REVENUE_OS_RESOURCES },
        };
      }

      case "resources/read": {
        const uri = String(params.uri || "");
        if (uri === "revenue-os://today/snapshot") {
          const queue = await loadOperatorQueue(context.supabase);
          return {
            jsonrpc: "2.0",
            id,
            result: {
              contents: [
                {
                  uri,
                  mimeType: "application/json",
                  text: JSON.stringify({ queue, timestamp: new Date().toISOString() }, null, 2),
                },
              ],
            },
          };
        }

        if (uri === "revenue-os://system/modules") {
          const activeModules = getActiveModules(context.tenantConfig);
          return {
            jsonrpc: "2.0",
            id,
            result: {
              contents: [
                {
                  uri,
                  mimeType: "application/json",
                  text: JSON.stringify({ activeModules }, null, 2),
                },
              ],
            },
          };
        }

        if (uri === "revenue-os://knowledge/registry") {
          return {
            jsonrpc: "2.0",
            id,
            result: {
              contents: [
                {
                  uri,
                  mimeType: "application/json",
                  text: JSON.stringify({
                    contract: "revenue-os-knowledge.v1",
                    grounding: "strict",
                    untrustedDataBoundary: true,
                  }, null, 2),
                },
              ],
            },
          };
        }

        return {
          jsonrpc: "2.0",
          id,
          error: {
            code: MCP_ERROR_CODES.INVALID_PARAMS,
            message: `Unknown resource URI: ${uri}`,
          },
        };
      }

      case "prompts/list": {
        return {
          jsonrpc: "2.0",
          id,
          result: { prompts: MCP_REVENUE_OS_PROMPTS },
        };
      }

      case "prompts/get": {
        const promptName = String(params.name || "");
        const promptDef = MCP_REVENUE_OS_PROMPTS.find((p) => p.name === promptName);
        if (!promptDef) {
          return {
            jsonrpc: "2.0",
            id,
            error: {
              code: MCP_ERROR_CODES.INVALID_PARAMS,
              message: `Unknown prompt name: ${promptName}`,
            },
          };
        }

        let systemInstructions = "";
        if (promptName === "daily_operator_triage") {
          systemInstructions =
            "Call get_today_snapshot to inspect today's urgent tasks and pending approvals. " +
            "Summarize items needing attention and propose any necessary follow-up tasks.";
        } else if (promptName === "pipeline_health_check") {
          systemInstructions =
            "Call search_pipeline to inspect open opportunities. Highlight opportunities without recent activity " +
            "or missing next actions, and suggest next steps.";
        } else if (promptName === "reactivate_stale_deals") {
          systemInstructions =
            "Identify lost or stale opportunities from the pipeline. Propose grounded, personalized reactivation outreach " +
            "for founder review using propose_send_email.";
        }

        return {
          jsonrpc: "2.0",
          id,
          result: {
            description: promptDef.description,
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text: systemInstructions,
                },
              },
            ],
          },
        };
      }

      default:
        return {
          jsonrpc: "2.0",
          id,
          error: {
            code: MCP_ERROR_CODES.METHOD_NOT_FOUND,
            message: `Method not found: ${method}`,
          },
        };
    }
  } catch (error) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: MCP_ERROR_CODES.INTERNAL_ERROR,
        message: error instanceof Error ? error.message : "Internal Revenue OS error",
      },
    };
  }
}
