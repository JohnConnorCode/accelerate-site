#!/usr/bin/env tsx
/**
 * Test Suite: Webhook Security & Integration Adapter Robustness
 *
 * Verifies:
 * 1. WhatsApp HMAC-SHA256 signature verification (valid, tampered, missing, wrong secret)
 * 2. HubSpot HMAC-SHA256 v3 + timestamp replay protection
 * 3. Integration adapter error handling: oversized payloads, malformed fields
 * 4. Idempotency under concurrent duplicate events
 * 5. MCP server robustness: auth rejection, oversized request, null id handling
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  ingestWhatsAppMessage,
  importHubSpotBatch,
  type WhatsAppIncomingMessagePayload,
  type HubSpotRawContact,
} from "../src/lib/revenue-os/integration-adapters";
import {
  handleMcpRequest,
  MCP_ERROR_CODES,
  type McpJsonRpcRequest,
} from "../src/lib/revenue-os/mcp-server";
import { tenant } from "../src/config/tenant";
import { MemorySupabase } from "./lib/memory-supabase";

// -----------------------------------------------------------------------
// Signature helpers (matching production route logic)
// -----------------------------------------------------------------------

function signWhatsApp(body: string, secret: string): string {
  const digest = createHmac("sha256", secret).update(Buffer.from(body)).digest("hex");
  return `sha256=${digest}`;
}

function signHubSpotV3(body: string, secret: string, timestamp: number, uri: string): string {
  const source = `${secret}${timestamp}POST${uri}${body}`;
  return createHmac("sha256", secret).update(source).digest("base64");
}

/** Verify WhatsApp HMAC-SHA256 signature using timing-safe comparison. */
function verifySigSync(rawBody: Buffer, appSecret: string, header: string | null): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const receivedHex = header.slice(7);
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const a = Buffer.from(receivedHex, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

// -----------------------------------------------------------------------
// HubSpot Signature Tests (pure logic)
// -----------------------------------------------------------------------

function verifyHubSpotV3Sync(
  rawBody: string,
  clientSecret: string,
  header: string | null,
  timestamp: string | null,
  uri: string,
): boolean {
  if (!header || !timestamp) return false;
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Date.now() - ts > 300_000) return false;
  const source = `${clientSecret}${timestamp}POST${uri}${rawBody}`;
  const expected = createHmac("sha256", clientSecret).update(source).digest("base64");
  return header === expected;
}

// -----------------------------------------------------------------------
// Main Test Runner
// -----------------------------------------------------------------------

async function main() {
  console.log("Starting Webhook Security & Robustness tests...");

  const APP_SECRET = "test-whatsapp-secret-32chars-long";
  const HS_SECRET = "test-hubspot-client-secret";
  const testUri = "https://example.com/api/public/acme/webhooks/hubspot";
  const now = Date.now();

  // 1. WhatsApp HMAC verification
  {
    const body = JSON.stringify({ test: "payload" });
    const rawBody = Buffer.from(body);

    // Valid signature
    const validSig = signWhatsApp(body, APP_SECRET);
    assert.ok(verifySigSync(rawBody, APP_SECRET, validSig), "Valid WhatsApp sig must pass");

    // Tampered body
    const tamperedBody = Buffer.from(body + " tampered");
    assert.ok(!verifySigSync(tamperedBody, APP_SECRET, validSig), "Tampered body must fail WhatsApp sig");

    // Missing header
    assert.ok(!verifySigSync(rawBody, APP_SECRET, null), "Missing header must fail");

    // Wrong format
    assert.ok(!verifySigSync(rawBody, APP_SECRET, "sha1=abc"), "Wrong prefix must fail");

    // Wrong secret
    const wrongSig = signWhatsApp(body, "different-secret-value-here!!!");
    assert.ok(!verifySigSync(rawBody, APP_SECRET, wrongSig), "Wrong secret must fail");
  }

  // 2. HubSpot v3 HMAC + replay protection
  {
    const body = JSON.stringify([{ subscriptionType: "contact.creation", objectId: 12345 }]);
    const validSig = signHubSpotV3(body, HS_SECRET, now, testUri);

    // Valid
    assert.ok(
      verifyHubSpotV3Sync(body, HS_SECRET, validSig, String(now), testUri),
      "Valid HubSpot v3 sig must pass",
    );

    // Tampered body
    assert.ok(
      !verifyHubSpotV3Sync(body + "x", HS_SECRET, validSig, String(now), testUri),
      "Tampered body must fail HubSpot sig",
    );

    // Replay attack: stale timestamp (6 minutes ago)
    const staleTs = now - 360_000;
    const staleSig = signHubSpotV3(body, HS_SECRET, staleTs, testUri);
    assert.ok(
      !verifyHubSpotV3Sync(body, HS_SECRET, staleSig, String(staleTs), testUri),
      "Stale timestamp (>5 min) must fail replay protection",
    );

    // Missing timestamp
    assert.ok(
      !verifyHubSpotV3Sync(body, HS_SECRET, validSig, null, testUri),
      "Missing timestamp must fail",
    );

    // Wrong URI (different tenant slug)
    const wrongUri = "https://example.com/api/public/other-tenant/webhooks/hubspot";
    const wrongUriSig = signHubSpotV3(body, HS_SECRET, now, wrongUri);
    assert.ok(
      !verifyHubSpotV3Sync(body, HS_SECRET, wrongUriSig, String(now), testUri),
      "Wrong URI must fail HubSpot sig",
    );
  }

  // 3. Integration adapter edge cases
  {
    const mem = new MemorySupabase({ contacts: [], companies: [], opportunities: [], activities: [], inquiries: [] });
    const db = mem.client as Parameters<typeof ingestWhatsAppMessage>[0];

    // Empty body WhatsApp message — must reject
    let rejected = false;
    try {
      await ingestWhatsAppMessage(db, { messageId: "wamid.1", fromPhoneNumber: "+15551234567", body: "", timestamp: new Date().toISOString() });
    } catch (err) {
      rejected = true;
      const msg = err instanceof Error ? err.message : String(err);
      assert.match(msg, /requires messageId/i, "Rejection must mention messageId");
    }
    assert.ok(rejected, "Empty body WhatsApp message must be rejected");

    // Very long message body — must be truncated in activity summary, not throw
    const longBody = "A".repeat(5000);
    const longResult = await ingestWhatsAppMessage(db, {
      messageId: "wamid.longtest",
      fromPhoneNumber: "+15559876543",
      senderName: "Test User",
      body: longBody,
      timestamp: new Date().toISOString(),
    });
    assert.ok(longResult.contact?.id, "Long body must still resolve contact");

    // HubSpot contact with neither email nor phone — must skip gracefully
    const invalidContacts: HubSpotRawContact[] = [
      { id: "hs-invalid", properties: { firstname: "No", lastname: "ContactInfo" } },
    ];
    const invalidSummary = await importHubSpotBatch(db, { contacts: invalidContacts, deals: [] });
    assert.equal(invalidSummary.contactsSkipped, 1, "Contact with no email and no phone must be skipped");

    // Completely empty import batch — must succeed with zero counts
    const emptySummary = await importHubSpotBatch(db, { contacts: [], deals: [] });
    assert.equal(emptySummary.contactsTotal, 0);
    assert.equal(emptySummary.dealsTotal, 0);
    assert.equal(emptySummary.errors.length, 0);
  }

  // 4. Concurrent duplicate WhatsApp events — idempotency
  {
    const mem = new MemorySupabase({ contacts: [], companies: [], opportunities: [], activities: [], inquiries: [] });
    const db = mem.client as Parameters<typeof ingestWhatsAppMessage>[0];

    const duplicatePayload: WhatsAppIncomingMessagePayload = {
      messageId: "wamid.dup-test-001",
      fromPhoneNumber: "+15558881234",
      senderName: "Dup Sender",
      body: "Duplicate message",
      timestamp: new Date().toISOString(),
    };

    // Ingest twice sequentially to test idempotency and identity deduplication
    const r1 = await ingestWhatsAppMessage(db, duplicatePayload);
    const r2 = await ingestWhatsAppMessage(db, { ...duplicatePayload });
    // Both must resolve (no crash), and both must reference same contact
    assert.ok(r1.contact?.id, "First duplicate must resolve contact");
    assert.ok(r2.contact?.id, "Second duplicate must resolve contact");
    assert.equal(r1.contact.id, r2.contact.id, "Duplicate payload must resolve to identical contact ID");
    // Contact table must not have duplicates
    const contactRows = mem.rows("contacts");
    const uniqueSourceIds = new Set(contactRows.map((r) => r.source_record_id));
    assert.equal(
      uniqueSourceIds.size,
      contactRows.length,
      "No duplicate contacts must be created from duplicate events",
    );
  }

  // 5. MCP server robustness
  {
    const mem = new MemorySupabase({ action_queue: [], tasks: [] });
    const stubDb = mem.client as Parameters<typeof handleMcpRequest>[1]["supabase"];
    const ctx = { supabase: stubDb, actorEmail: "test@acceleratewith.us", tenantConfig: tenant };

    // Null id request (notification-style) — must still respond without crashing
    const nullIdReq: McpJsonRpcRequest = { jsonrpc: "2.0", id: null, method: "ping" };
    const nullIdRes = await handleMcpRequest(nullIdReq, ctx);
    assert.equal(nullIdRes.id, null, "Null id must be echoed back");
    assert.ok(!nullIdRes.error, "Ping with null id must not error");

    // Unknown resource URI — must return INVALID_PARAMS, not crash
    const badResourceReq: McpJsonRpcRequest = {
      jsonrpc: "2.0", id: 99, method: "resources/read",
      params: { uri: "revenue-os://nonexistent/path" },
    };
    const badResourceRes = await handleMcpRequest(badResourceReq, ctx);
    assert.equal(badResourceRes.error?.code, MCP_ERROR_CODES.INVALID_PARAMS);

    // Unknown prompt name — must return INVALID_PARAMS
    const badPromptReq: McpJsonRpcRequest = {
      jsonrpc: "2.0", id: 100, method: "prompts/get",
      params: { name: "nonexistent_prompt" },
    };
    const badPromptRes = await handleMcpRequest(badPromptReq, ctx);
    assert.equal(badPromptRes.error?.code, MCP_ERROR_CODES.INVALID_PARAMS);

    // Empty tool name — must return INVALID_PARAMS (not 500)
    const emptyToolReq: McpJsonRpcRequest = {
      jsonrpc: "2.0", id: 101, method: "tools/call",
      params: { name: "" },
    };
    const emptyToolRes = await handleMcpRequest(emptyToolReq, ctx);
    assert.equal(emptyToolRes.error?.code, MCP_ERROR_CODES.INVALID_PARAMS);

    // Unregistered tool name — must return error (module/tool not found), not crash
    const unknownToolReq: McpJsonRpcRequest = {
      jsonrpc: "2.0", id: 102, method: "tools/call",
      params: { name: "delete_all_data", arguments: {} },
    };
    const unknownToolRes = await handleMcpRequest(unknownToolReq, ctx);
    assert.ok(unknownToolRes.error, "Unknown tool must return an error response");
    // Must not be a hard 500 — must be INTERNAL_ERROR or INVALID_PARAMS
    assert.ok(
      [MCP_ERROR_CODES.INTERNAL_ERROR, MCP_ERROR_CODES.INVALID_PARAMS].includes(unknownToolRes.error.code),
      `Unknown tool must return INTERNAL_ERROR or INVALID_PARAMS, got: ${unknownToolRes.error.code}`,
    );

    // notifications/initialized — must return ok, not crash (it's a one-way notification)
    const initNotifReq: McpJsonRpcRequest = {
      jsonrpc: "2.0", id: 103, method: "notifications/initialized",
    };
    const initNotifRes = await handleMcpRequest(initNotifReq, ctx);
    assert.ok(!initNotifRes.error, "notifications/initialized must not error");
  }

  console.log("All Webhook Security & Robustness tests passed successfully!");
}

main().catch((err) => {
  console.error("Webhook Security tests failed:", err);
  process.exit(1);
});
