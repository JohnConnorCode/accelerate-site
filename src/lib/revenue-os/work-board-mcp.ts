import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  listWorkBoard,
  mutateWorkBoard,
  workHistory,
  workMutationSchema,
  workPayloadSchema,
  WORK_OPERATIONS,
  type WorkActor,
} from "./work-board";
export const WORK_MCP_TOOLS = [
  {
    name: "work_list",
    description: "Read platform work and canonical readiness. Paginate with nextOffset.",
    inputSchema: {
      type: "object",
      properties: {
        offset: { type: "integer", minimum: 0 },
        limit: { type: "integer", minimum: 1, maximum: 500 },
        id: { type: "string", format: "uuid" },
        seedKey: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "work_mutate",
    description:
      "Versioned work operations. Claim requires a client-generated 32-byte base64url claimToken; retain it and requestKey for retries. Submit passing checks and exact commit for review. No deployment or merge is implied.",
    inputSchema: {
      oneOf: WORK_OPERATIONS.map((operation) =>
        z.toJSONSchema(
          workMutationSchema.extend({
            operation: z.literal(operation),
            payload: workPayloadSchema(operation),
          }),
        ),
      ),
    },
  },
  {
    name: "work_history",
    description: "Read the latest 100 immutable events for a scoped card.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", format: "uuid" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
];
export async function handleWorkMcp(db: SupabaseClient, actor: WorkActor, raw: unknown) {
  const request = z
    .object({
      jsonrpc: z.literal("2.0"),
      id: z.union([z.string(), z.number()]).optional(),
      method: z.string(),
      params: z.record(z.string(), z.unknown()).optional(),
    })
    .parse(raw);
  const reply = (result: unknown) => ({ jsonrpc: "2.0", id: request.id ?? null, result });
  if (request.method.startsWith("notifications/")) return null;
  if (request.method === "initialize")
    return reply({
      protocolVersion: "2025-03-26",
      capabilities: { tools: {} },
      serverInfo: { name: "accelerate-work-board", version: "1.0.0" },
    });
  if (request.method === "ping") return reply({});
  if (request.method === "tools/list") return reply({ tools: WORK_MCP_TOOLS });
  if (request.method === "tools/call") {
    try {
      const { name, arguments: args = {} } = z
        .object({ name: z.string(), arguments: z.unknown().optional() })
        .parse(request.params);
      let value;
      if (name === "work_list")
        value = await listWorkBoard(
          db,
          actor,
          z
            .object({
              offset: z.number().int().nonnegative().optional(),
              limit: z.number().int().min(1).max(500).optional(),
              id: z.string().uuid().optional(),
              seedKey: z.string().max(160).optional(),
            })
            .strict()
            .parse(args),
        );
      else if (name === "work_mutate") value = await mutateWorkBoard(db, actor, args);
      else if (name === "work_history")
        value = await workHistory(
          db,
          actor,
          z.object({ id: z.string().uuid() }).strict().parse(args).id,
        );
      else throw new Error("Unknown tool");
      return reply({ content: [{ type: "text", text: JSON.stringify(value) }] });
    } catch (error) {
      return reply({
        isError: true,
        content: [{ type: "text", text: error instanceof Error ? error.message : "Tool failed" }],
      });
    }
  }
  return {
    jsonrpc: "2.0",
    id: request.id ?? null,
    error: { code: -32601, message: "Method not found" },
  };
}
