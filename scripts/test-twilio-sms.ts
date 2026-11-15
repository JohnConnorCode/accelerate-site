import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MemorySupabase, type Row } from "./lib/memory-supabase";
import { bindTenantDatabaseForTest } from "../src/lib/supabase/server";
import { encryptTenantSecret } from "../src/lib/revenue-os/encryption";
import {
  checkConformance,
  type ExtsvcAdapterContract,
} from "../src/lib/revenue-os/extsvc-adapter-contract";
import { INTEGRATION_ADAPTERS } from "../src/lib/revenue-os/integration-adapters";
import { twilioSignature, verifyTwilioSignature } from "../src/lib/revenue-os/twilio-adapter";
import { reconcileSmsAction } from "../src/lib/revenue-os/sms";
import { approveAndExecuteAction } from "../src/lib/revenue-os/action-executor";
import { executeRegisteredRevenueTool } from "../src/lib/revenue-os/ai-tools";
import { ACTION_REVERSIBILITY } from "../src/lib/revenue-os/action-reversibility-contract";
import { approvalConsequence, approvalKind } from "../src/lib/admin/approval-presentation";

process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "controlled-twilio-fixture-key-not-a-provider-secret";
const TENANT = "00000000-0000-4000-8000-0000000000aa";
const SID = `AC${"1".repeat(32)}`;
const TOKEN = "f".repeat(32);
const NUMBER = "+15555550100";
const CUSTOMER = "+15555550123";
const API = "https://api.twilio.com/2010-04-01/";
const messageSid = (n: number) => `SM${String(n).padStart(32, "0")}`;
const checks: string[] = [];

// ---- Controlled Twilio: records every request, never reaches the network.
type Call = { url: string; method: string; body: string; auth: string | null };
let calls: Call[] = [];
let respond: (call: Call) => Response | Promise<Response> = () => {
  throw new Error("Unexpected Twilio request");
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const call = {
    url: String(input),
    method: init?.method ?? "GET",
    body: typeof init?.body === "string" ? init.body : "",
    auth: new Headers(init?.headers).get("authorization"),
  };
  calls.push(call);
  return respond(call);
}) as typeof fetch;

const bound = (mem: MemorySupabase) =>
  bindTenantDatabaseForTest(mem.client as never, TENANT) as SupabaseClient;
const connection = () => ({
  tenant_id: TENANT,
  provider: "twilio",
  status: "connected",
  credential_version: 1,
  encrypted_credentials: {
    account_sid: encryptTenantSecret(SID, TENANT, "twilio", "account_sid"),
    api_key: encryptTenantSecret(TOKEN, TENANT, "twilio", "api_key"),
    from_number: encryptTenantSecret(NUMBER, TENANT, "twilio", "from_number"),
  },
});
const fixture = (extra: Record<string, Row[]> = {}) => {
  const mem = new MemorySupabase({
    integration_connections: [connection()],
    contacts: [
      {
        id: "00000000-0000-4000-8000-000000000c01",
        tenant_id: TENANT,
        full_name: "Gus Henriksen",
        phone: CUSTOMER,
        communication_status: "active",
      },
    ],
    conversations: [],
    messages: [],
    action_queue: [],
    audit_log: [],
    ...extra,
  });
  // The workspace's default policy: an external send always asks a person first.
  mem.rpc("check_autonomy", ({ p_action_key }) => ({
    action_key: p_action_key,
    level: "always_ask",
    allowed: false,
    requires_approval: true,
    policy_id: null,
    hard_floor: false,
    reason: "Approval required",
  }));
  return mem;
};

/** Loads a route module with chosen dependencies replaced, the rest real. */
function loadRoute(file: string, mocks: Record<string, unknown>) {
  const exports: Record<string, (...args: never[]) => Promise<Response>> = {};
  const load = createRequire(resolve("package.json"));
  runInNewContext(
    ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      console,
      Error,
      URL,
      URLSearchParams,
      Buffer,
      require: (name: string) =>
        name in mocks
          ? mocks[name]
          : load(name.startsWith("@/") ? resolve("src", name.slice(2)) : name),
    },
  );
  return exports;
}

async function main() {
  // ---- AC1: one registered, conformant, tenant-scoped adapter.
  const adapter = INTEGRATION_ADAPTERS.get("twilio")!;
  assert.ok(adapter, "Twilio is registered with the integration adapters");
  assert.deepEqual(
    checkConformance(adapter as unknown as ExtsvcAdapterContract).blockingFailures,
    [],
  );
  respond = (call) =>
    call.url.includes("IncomingPhoneNumbers")
      ? json({ incoming_phone_numbers: [{ phone_number: NUMBER }] })
      : json({ sid: SID, status: "active" });
  calls = [];
  const verified = await adapter.verify({ accountSid: SID, authToken: TOKEN, fromNumber: NUMBER });
  assert.deepEqual(verified, {
    valid: true,
    provider: "twilio",
    accountDetails: { id: SID, name: NUMBER },
  });
  assert.ok(calls.length === 2 && calls.every((call) => call.url.startsWith(API)), "Pinned origin");
  assert.equal(calls[0]!.auth, `Basic ${Buffer.from(`${SID}:${TOKEN}`).toString("base64")}`);
  respond = (call) =>
    call.url.includes("IncomingPhoneNumbers")
      ? json({ incoming_phone_numbers: [] })
      : json({ sid: SID, status: "active" });
  const notOwned = await adapter.verify({ accountSid: SID, authToken: TOKEN, fromNumber: NUMBER });
  assert.equal(notOwned.valid, false);
  assert.match(notOwned.error ?? "", /not on this Twilio account/);
  calls = [];
  const malformed = await adapter.verify({
    accountSid: "AC1",
    authToken: TOKEN,
    fromNumber: "555",
  });
  assert.equal(malformed.valid, false);
  assert.equal(calls.length, 0, "Malformed credentials never reach Twilio");
  respond = () => json({ code: 20003, message: `Authenticate ${TOKEN}` }, 401);
  const refused = await adapter.verify({ accountSid: SID, authToken: TOKEN, fromNumber: NUMBER });
  assert.ok(
    !refused.valid && !String(refused.error).includes(TOKEN),
    "Errors never echo the token",
  );
  checks.push("adapter-conformance-and-verification");

  // Twilio's documented signature example, then tampering of each input.
  const docsParams = {
    CallSid: "CA1234567890ABCDE",
    Caller: "+12349013030",
    Digits: "1234",
    From: "+12349013030",
    To: "+18005551212",
  };
  const docsUrl = "https://mycompany.com/myapp.php?foo=1&bar=2";
  assert.equal(twilioSignature("12345", docsUrl, docsParams), "0/KCTR6DLpKmkAf8muzZqo1nDgQ=");
  const header = twilioSignature("12345", docsUrl, docsParams);
  assert.ok(verifyTwilioSignature("12345", docsUrl, docsParams, header));
  assert.ok(!verifyTwilioSignature("12345", docsUrl, { ...docsParams, Digits: "9" }, header));
  assert.ok(!verifyTwilioSignature("54321", docsUrl, docsParams, header));
  assert.ok(!verifyTwilioSignature("12345", `${docsUrl}&x=1`, docsParams, header));
  assert.ok(!verifyTwilioSignature("12345", docsUrl, docsParams, null));
  checks.push("signature-known-answer-and-tampering");

  // ---- AC2: the real webhook handler records verified texts as conversations.
  const mem = fixture();
  const db = bound(mem);
  const context = {
    kind: "system",
    tenantId: TENANT,
    tenantSlug: "acme",
    source: "twilio-webhook",
  };
  const webhook = loadRoute("src/app/api/public/[tenantSlug]/webhooks/twilio/route.ts", {
    "@/lib/tenancy/providers": {
      resolveTenantProviderSecrets: async (slug: string) =>
        slug === "acme"
          ? { context, apiKey: TOKEN, webhookSecret: null, allowEnvironment: false }
          : null,
    },
    "@/lib/supabase/server": { createServiceRoleClient: () => db },
  });
  const url = "https://workspace.example/api/public/acme/webhooks/twilio";
  const inbound = (params: Record<string, string>, slug = "acme", token = TOKEN) =>
    webhook.POST!(
      new NextRequest(url.replace("acme", slug), {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-twilio-signature": twilioSignature(token, url.replace("acme", slug), params),
        },
        body: new URLSearchParams(params).toString(),
      }) as never,
      { params: Promise.resolve({ tenantSlug: slug }) } as never,
    );
  const text = (n: number, body: string) => ({
    MessageSid: messageSid(n),
    AccountSid: SID,
    From: CUSTOMER,
    To: NUMBER,
    Body: body,
  });
  const first = await inbound(text(1, "Can you mow Thursday?"));
  assert.equal(first.status, 200);
  assert.match(await first.text(), /<Response><\/Response>/);
  const [conversation] = mem.rows("conversations");
  assert.equal(conversation?.channel, "sms");
  assert.equal(conversation?.external_id, `${NUMBER}:${CUSTOMER}`);
  assert.equal(
    conversation?.contact_id,
    "00000000-0000-4000-8000-000000000c01",
    "Phone links the contact",
  );
  assert.equal(mem.rows("messages").length, 1);
  assert.equal((await inbound(text(1, "Can you mow Thursday?"))).status, 200);
  assert.equal(mem.rows("messages").length, 1, "A replayed webhook records nothing twice");
  assert.equal(mem.rows("conversations")[0]!.unread_count, 1);
  await inbound(text(2, "STOP"));
  assert.equal((mem.rows("conversations")[0]!.metadata as Row).smsOptOut, true);
  await inbound(text(3, "start"));
  assert.equal((mem.rows("conversations")[0]!.metadata as Row).smsOptOut, false);
  const writes = mem.rows("messages").length;
  assert.equal((await inbound(text(4, "forged"), "acme", "0".repeat(32))).status, 401);
  assert.equal((await inbound(text(5, "unknown"), "nobody")).status, 404);
  assert.equal(
    (
      await inbound({
        MessageSid: messageSid(6),
        MessageStatus: "delivered",
        From: NUMBER,
        To: CUSTOMER,
      })
    ).status,
    200,
  );
  assert.equal(
    mem.rows("messages").length,
    writes,
    "Forged, unknown and status calls write nothing",
  );
  checks.push("webhook-verified-inbound-replay-and-opt-out");

  // ---- AC3: a reply stages send_sms; only an approval sends, with receipts.
  const reply = loadRoute("src/app/api/admin/revenue-os/conversations/reply/route.ts", {
    "@/lib/admin/auth": {
      requireAdmin: async () => ({
        database: db,
        user: { id: "00000000-0000-4000-8000-0000000000ad", email: "owner@acme.example" },
      }),
    },
  });
  calls = [];
  const staged = await reply.POST!(
    new NextRequest("https://workspace.example/api/admin/revenue-os/conversations/reply", {
      method: "POST",
      body: JSON.stringify({
        conversationId: conversation!.id,
        body: "Yes, Thursday at 9.",
        confirmed: true,
      }),
    }) as never,
  );
  const stagedBody = (await staged.json()) as { approvalRequired?: boolean };
  assert.equal(staged.status, 200);
  assert.equal(stagedBody.approvalRequired, true, "Even a confirmed text waits for approval");
  const [action] = mem.rows("action_queue");
  assert.equal(action?.action_type, "send_sms");
  assert.deepEqual(JSON.parse(JSON.stringify(action?.payload)), {
    conversationId: conversation!.id,
    to: CUSTOMER,
    body: "Yes, Thursday at 9.",
  });
  assert.equal(calls.length, 0, "Staging never contacts Twilio");
  // The assistant's reply tool stages the same send_sms on a text thread.
  const viaAssistant = await executeRegisteredRevenueTool(
    { supabase: db, actorEmail: "owner@acme.example", toolPack: "outreach" },
    "propose_conversation_reply",
    {
      conversationId: conversation!.id,
      body: "We can also do Friday.",
      reasoning: "Offer a backup day",
    },
  );
  const assistantAction = mem
    .rows("action_queue")
    .find((row) => row.id === (viaAssistant.output as Row).id);
  assert.equal(assistantAction?.action_type, "send_sms");
  assert.equal(assistantAction?.status, "pending", "The assistant's text waits for approval");
  assert.equal(calls.length, 0);
  mem.rows("action_queue").splice(mem.rows("action_queue").indexOf(assistantAction!), 1);

  respond = () => json({ sid: messageSid(90), status: "queued" }, 201);
  const sent = (await approveAndExecuteAction(db, String(action!.id), "owner@acme.example")) as Row;
  assert.equal(sent.sid, messageSid(90));
  assert.equal(calls.filter((call) => call.method === "POST").length, 1);
  assert.match(calls[0]!.body, /To=%2B15555550123/);
  assert.match(calls[0]!.body, /From=%2B15555550100/);
  assert.equal(mem.rows("action_queue")[0]!.status, "executed");
  const outbound = mem.rows("messages").find((row) => row.direction === "outbound");
  assert.equal(outbound?.provider_id, `twilio:${messageSid(90)}`, "The send is receipted");
  checks.push("reply-stages-and-approval-sends-with-receipt");

  // A STOP since approval refuses the send without contacting Twilio.
  await inbound(text(7, "STOP"));
  mem.rows("action_queue").push({
    id: "00000000-0000-4000-8000-0000000000b1",
    tenant_id: TENANT,
    action_type: "send_sms",
    status: "pending",
    title: "Text",
    payload: { conversationId: conversation!.id, to: CUSTOMER, body: "One more thing" },
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  });
  calls = [];
  await assert.rejects(
    () => approveAndExecuteAction(db, "00000000-0000-4000-8000-0000000000b1", "owner@acme.example"),
    /replied STOP/,
  );
  assert.equal(calls.length, 0, "An opted-out number is never texted");
  await inbound(text(8, "START"));
  checks.push("stop-refuses-send");

  // A timeout after the request left is uncertain; reconcile finds it and never resends.
  const uncertain = (id: string, body: string) =>
    mem.rows("action_queue").push({
      id,
      tenant_id: TENANT,
      action_type: "send_sms",
      status: "pending",
      title: "Text",
      payload: { conversationId: conversation!.id, to: CUSTOMER, body },
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    });
  uncertain("00000000-0000-4000-8000-0000000000b2", "Crew arrives at 9.");
  respond = () => {
    throw Object.assign(new Error("The operation timed out"), { name: "TimeoutError" });
  };
  calls = [];
  await assert.rejects(
    () => approveAndExecuteAction(db, "00000000-0000-4000-8000-0000000000b2", "owner@acme.example"),
    /reconcile before retrying/,
  );
  const failed = mem
    .rows("action_queue")
    .find((row) => row.id === "00000000-0000-4000-8000-0000000000b2")!;
  assert.equal(failed.status, "failed");
  respond = () =>
    json({
      messages: [
        {
          sid: messageSid(91),
          body: "Crew arrives at 9.",
          status: "delivered",
          date_created: new Date().toUTCString(),
        },
      ],
    });
  const settled = (await reconcileSmsAction(db, "00000000-0000-4000-8000-0000000000b2")) as Row;
  assert.deepEqual(
    [settled.sid, settled.reconciled, failed.status],
    [messageSid(91), true, "executed"],
  );
  assert.equal(calls.filter((call) => call.method === "POST").length, 1, "Reconcile never sends");
  assert.ok(mem.rows("messages").some((row) => row.provider_id === `twilio:${messageSid(91)}`));

  uncertain("00000000-0000-4000-8000-0000000000b3", "Gate code is 4521.");
  respond = () => {
    throw Object.assign(new Error("The operation timed out"), { name: "TimeoutError" });
  };
  await assert.rejects(() =>
    approveAndExecuteAction(db, "00000000-0000-4000-8000-0000000000b3", "owner@acme.example"),
  );
  respond = () => json({ messages: [] });
  calls = [];
  const notSent = (await reconcileSmsAction(db, "00000000-0000-4000-8000-0000000000b3")) as Row;
  const still = mem
    .rows("action_queue")
    .find((row) => row.id === "00000000-0000-4000-8000-0000000000b3")!;
  assert.deepEqual([notSent.sent, still.status], [false, "failed"]);
  assert.match(String(still.error), /Not sent/);
  assert.equal(calls.filter((call) => call.method === "POST").length, 0);
  checks.push("uncertain-send-reconciles-before-retry");

  // One presentation and one reversibility class for the new action.
  assert.equal(approvalKind({ action_type: "send_sms" }).external, true);
  assert.match(approvalConsequence({ action_type: "send_sms", payload: null }), /STOP/);
  assert.equal(
    ACTION_REVERSIBILITY.find((entry) => entry.actionType === "send_sms")?.reversibility,
    "irreversible",
  );
  checks.push("presentation-and-reversibility");

  console.log(JSON.stringify({ result: "passed", checks }));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
