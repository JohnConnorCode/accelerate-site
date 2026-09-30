import { z } from "zod";

/** Shared envelope and workspace byte budget. Site Studio has a separate asset budget. */
export const MCP_MAX_REQUEST_BYTES = 256_000;
export const mcpRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string().max(256), z.number().int().safe()]).optional(),
  method: z.string().min(1).max(120),
  params: z.record(z.string(), z.unknown()).optional(),
});

/** Valid JSON with a bad envelope is distinct from an unreadable JSON body. */
export function mcpRequestBodyError(error: unknown) {
  return error instanceof z.ZodError
    ? { code: -32600, message: "Invalid JSON-RPC request" }
    : { code: -32700, message: "Could not parse bounded UTF-8 JSON request" };
}

/** Browser origins require an exact allowlist; server clients may omit Origin. */
export function mcpHttpRequestError(request: Request, supportedVersions: readonly string[]) {
  const protocol = request.headers.get("mcp-protocol-version");
  if (protocol && !supportedVersions.includes(protocol)) return "Unsupported MCP protocol version";
  const origin = request.headers.get("origin");
  const allowed = (process.env.MCP_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (origin && origin !== new URL(request.url).origin && !allowed.includes(origin))
    return "MCP request origin is not allowed";
  return null;
}
