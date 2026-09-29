import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readMcpLines } from "./lib/mcp-stdio";
import { MemorySupabase } from "./lib/memory-supabase";
import { bindTenantDatabaseForTest } from "../src/lib/supabase/server";
import { readBoundedJson } from "../src/lib/http/bounded-json";
import {
  mcpRequestSchema,
  mcpHttpRequestError,
  MCP_MAX_REQUEST_BYTES,
} from "../src/lib/revenue-os/mcp-request";
import {
  handleMcpRequest,
  MCP_SUPPORTED_PROTOCOL_VERSIONS,
} from "../src/lib/revenue-os/mcp-server";
import { executeRegisteredRevenueTool } from "../src/lib/revenue-os/ai-tools";
import { tenant } from "../src/config/tenant";

const tenantId = "11111111-1111-4111-8111-111111111111";
const itemId = "22222222-2222-4222-8222-222222222222";
const actorEmail = "admin@fictional.example";
const memory = new MemorySupabase({
  tenants: [{ id: tenantId, status: "active", config: {} }],
  tenant_memberships: [
    { tenant_id: tenantId, invited_email: actorEmail, role: "admin", status: "active" },
  ],
  action_queue: [],
  content_calendar: [
    {
      id: itemId,
      title: "Original draft",
      slug: "original",
      status: "draft",
      category: null,
      target_keywords: null,
      pillar: null,
      funnel_stage: null,
      target_publish_date: null,
      actual_publish_date: null,
      author: null,
      notes: null,
      seo_title: null,
      seo_description: null,
      word_count_target: null,
      updated_at: "2026-09-29T12:00:00Z",
    },
  ],
});
const database = bindTenantDatabaseForTest(memory.client, tenantId);
const context = {
  supabase: database,
  actorEmail,
  tenantConfig: tenant,
  principalKind: "workspace_member" as const,
};
const request = (method: string, params = {}, id = 1) => ({ jsonrpc: "2.0", id, method, params });
const contentPreview = request("tools/call", {
  name: "preview_content_calendar_update",
  arguments: { id: itemId, changes: { title: "Reviewed title" } },
});

async function main() {
  for (const invalid of [
    null,
    [],
    {},
    request(""),
    { ...request("ping"), id: null },
    { ...request("ping"), id: 1.2 },
    { ...request("ping"), id: {} },
    { ...request("ping"), params: [] },
  ]) {
    assert.equal(mcpRequestSchema.safeParse(invalid).success, false);
    assert.equal((await handleMcpRequest(invalid, context))?.error?.code, -32600);
  }
  const noId = {
    jsonrpc: "2.0",
    method: "tools/call",
    params: { name: "propose_task", arguments: { title: "Must not run" } },
  };
  assert.equal(await handleMcpRequest(noId, context), null);
  assert.equal(memory.rows("action_queue").length, 0);
  const preview = await handleMcpRequest(contentPreview, context);
  assert.equal(
    (preview?.result as { isError: boolean }).isError,
    false,
    "real read preview with a record ID must not be mistaken for a queued action",
  );
  assert.equal(memory.rows("content_calendar")[0]?.title, "Original draft");
  assert.equal(memory.rows("action_queue").length, 0);
  await executeRegisteredRevenueTool(context, "preview_content_calendar_update", {
    id: itemId,
    changes: { title: "Reviewed title" },
  });

  memory.rows("tenants")[0]!.config = { modules: { content: false } };
  const hidden = (await handleMcpRequest(request("tools/list"), context))?.result as {
    tools: { name: string }[];
  };
  assert.equal(
    hidden.tools.some((tool) => tool.name === "preview_content_calendar_update"),
    false,
  );
  assert.equal(
    ((await handleMcpRequest(contentPreview, context))?.result as { isError: boolean }).isError,
    true,
  );
  memory.rows("tenants")[0]!.config = {};
  memory.rows("tenant_memberships")[0]!.status = "revoked";
  assert.equal(
    (await handleMcpRequest(contentPreview, context))?.error?.data &&
      (
        (await handleMcpRequest(request("tools/list"), context))?.error?.data as {
          denyCode: string;
        }
      ).denyCode,
    "membership_revoked",
  );
  memory.rows("tenant_memberships")[0]!.status = "active";
  memory.rows("tenants")[0]!.status = "suspended";
  assert.equal(
    ((await handleMcpRequest(request("tools/list"), context))?.error?.data as { denyCode: string })
      .denyCode,
    "tenant_unknown_or_suspended",
  );
  memory.rows("tenants")[0]!.status = "active";

  assert.equal(
    mcpHttpRequestError(
      new Request("https://workspace.example/mcp", { headers: { Origin: "https://evil.example" } }),
      MCP_SUPPORTED_PROTOCOL_VERSIONS,
    ),
    "MCP request origin is not allowed",
  );
  assert.equal(
    mcpHttpRequestError(
      new Request("https://workspace.example/mcp", {
        headers: { Origin: "https://workspace.example" },
      }),
      MCP_SUPPORTED_PROTOCOL_VERSIONS,
    ),
    null,
  );
  assert.equal(
    mcpHttpRequestError(
      new Request("https://workspace.example/mcp", {
        headers: { "MCP-Protocol-Version": "2026-07-28" },
      }),
      MCP_SUPPORTED_PROTOCOL_VERSIONS,
    ),
    "Unsupported MCP protocol version",
  );
  assert.equal(
    mcpHttpRequestError(
      new Request("https://workspace.example/mcp"),
      MCP_SUPPORTED_PROTOCOL_VERSIONS,
    ),
    null,
  );
  const oldOrigins = process.env.MCP_ALLOWED_ORIGINS;
  try {
    process.env.MCP_ALLOWED_ORIGINS = "https://client.example";
    assert.equal(
      mcpHttpRequestError(
        new Request("https://workspace.example/mcp", {
          headers: { Origin: "https://client.example" },
        }),
        MCP_SUPPORTED_PROTOCOL_VERSIONS,
      ),
      null,
    );
    assert.ok(
      mcpHttpRequestError(
        new Request("https://workspace.example/mcp", {
          headers: { Origin: "https://client.example.evil.test" },
        }),
        MCP_SUPPORTED_PROTOCOL_VERSIONS,
      ),
    );
  } finally {
    if (oldOrigins === undefined) delete process.env.MCP_ALLOWED_ORIGINS;
    else process.env.MCP_ALLOWED_ORIGINS = oldOrigins;
  }

  let cancelled = false;
  const stream = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) {
      controller.enqueue(new Uint8Array(9));
      controller.enqueue(new Uint8Array(9));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    readBoundedJson({ body: stream, headers: new Headers({ "content-length": "1" }) }, 10),
    /size limit/,
  );
  assert.equal(cancelled, true);
  await assert.rejects(
    readBoundedJson(new Response(new Uint8Array([34, 0xc3, 0x28, 34])), 10),
    /encoded data|encoding/i,
  );
  const unicode = Buffer.from('"José 王"\n');
  const split = async function* () {
    for (const byte of unicode) yield new Uint8Array([byte]);
  };
  const decoded = [];
  for await (const line of readMcpLines(split())) decoded.push(line);
  assert.deepEqual(decoded, [{ line: '"José 王"' }]);
  const frames = async function* () {
    yield Buffer.alloc(MCP_MAX_REQUEST_BYTES, 120);
    yield Buffer.from("\n");
    yield Buffer.alloc(MCP_MAX_REQUEST_BYTES + 1, 120);
    yield Buffer.from('\n{"jsonrpc":"2.0","id":8,"method":"ping"}\n');
    yield Buffer.from([0xc3, 0x28, 10]);
  };
  const lines = [];
  for await (const line of readMcpLines(frames())) lines.push(line);
  assert.equal(lines[0]?.line?.length, MCP_MAX_REQUEST_BYTES);
  assert.ok(lines[1]?.error);
  assert.equal(JSON.parse(lines[2]!.line!).id, 8);
  assert.ok(lines[3]?.error);

  const received: { id: unknown; protocol: unknown; session: unknown }[] = [];
  const server = createServer(async (incoming, outgoing) => {
    try {
      assert.equal(incoming.headers.authorization, "Bearer fictional-workspace-key");
      assert.ok(incoming.headers.accept?.includes("application/json"));
      const chunks = [];
      for await (const chunk of incoming) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      received.push({
        id: body.id,
        protocol: incoming.headers["mcp-protocol-version"],
        session: incoming.headers["mcp-session-id"],
      });
      if (body.id === 99) {
        outgoing.writeHead(401);
        outgoing.end();
        return;
      }
      const result = await handleMcpRequest(body, context);
      if (result === null) {
        outgoing.writeHead(202);
        outgoing.end();
        return;
      }
      outgoing.setHeader("Content-Type", "application/json");
      if (body.method === "initialize") outgoing.setHeader("Mcp-Session-Id", "fictional-session");
      outgoing.end(JSON.stringify(result));
    } catch {
      outgoing.writeHead(500);
      outgoing.end();
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    const child = spawn(process.execPath, ["--import", "tsx", "scripts/revenue-os-mcp.ts"], {
      env: {
        ...process.env,
        REVENUE_OS_MCP_URL: `http://127.0.0.1:${address.port}/mcp`,
        MCP_API_KEY: "fictional-workspace-key",
        SUPABASE_SERVICE_ROLE_KEY: "",
        NEXT_PUBLIC_SUPABASE_URL: "",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    const finished = once(child, "exit");
    const timeout = setTimeout(() => child.kill("SIGTERM"), 20_000);
    const messages = [
      request("initialize", { protocolVersion: "2025-03-26" }, 10),
      { jsonrpc: "2.0", method: "notifications/initialized" },
      request("tools/list", {}, 11),
      request("tools/call", contentPreview.params, 12),
      request("ping", {}, 99),
      request("ping", {}, 13),
    ];
    child.stdin.end(
      messages.map((message) => JSON.stringify(message)).join("\n") +
        "\n" +
        "x".repeat(MCP_MAX_REQUEST_BYTES + 1) +
        "\n" +
        JSON.stringify(request("ping", {}, 14)) +
        "\n",
    );
    const [code] = await finished;
    clearTimeout(timeout);
    assert.equal(code, 0, Buffer.concat(stderr).toString());
    const results = Buffer.concat(stdout)
      .toString("utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.deepEqual(
      results.map((result) => result.id),
      [10, 11, 12, 99, 13, null, 14],
    );
    assert.equal(results[3].error.code, -32603);
    assert.equal(results[5].error.code, -32700);
    assert.equal(received[1]?.session, "fictional-session");
    assert.equal(received[1]?.protocol, "2025-03-26");
    assert.equal(memory.rows("action_queue").length, 0);
    assert.equal(memory.rows("content_calendar")[0]?.title, "Original draft");
  } finally {
    server.close();
    await once(server, "close");
  }
  console.log(
    "PASS: bounded UTF-8 HTTP/stdio framing, live module and membership checks, real read preview, notification silence, negotiated session forwarding and failure recovery. No external providers or domain writes.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
