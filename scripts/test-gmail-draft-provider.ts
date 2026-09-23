import assert from "node:assert/strict";
import { bindTenantDatabaseForTest } from "../src/lib/supabase/server";
import { encryptSecret } from "../src/lib/revenue-os/encryption";
import { createGmailDraft, GOOGLE_GMAIL_DRAFT_SCOPE } from "../src/lib/revenue-os/google";
import { MemorySupabase } from "./lib/memory-supabase";

const tenantId = "tenant-gmail-draft-fixture";
const draftInput = {
  actionId: "action-draft-1",
  actorEmail: "operator@example.test",
  conversationId: "conversation-1",
  opportunityId: "opportunity-1",
  contactId: "contact-1",
  to: "customer@example.test",
  subject: "Re: Project update",
  body: "The revised schedule is ready for your review.",
};

function fixture(scopes: string[] = [GOOGLE_GMAIL_DRAFT_SCOPE]) {
  const memory = new MemorySupabase({
    tenants: [{ id: tenantId, status: "active" }],
    integration_connections: [
      {
        id: "google-connection-1",
        tenant_id: tenantId,
        provider: "google",
        status: "connected",
        scopes,
        account_email: "operator@example.test",
        encrypted_access_token: encryptSecret("fixture-access-token"),
        encrypted_refresh_token: encryptSecret("fixture-refresh-token"),
        token_expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
      },
    ],
    opportunities: [
      {
        id: "opportunity-1",
        tenant_id: tenantId,
        contact_id: "contact-1",
        stage: "qualified",
      },
    ],
    contacts: [
      {
        id: "contact-1",
        tenant_id: tenantId,
        email: "customer@example.test",
        unsubscribed: false,
      },
    ],
    conversations: [
      {
        id: "conversation-1",
        tenant_id: tenantId,
        external_id: "gmail-thread-1",
        subject: "Project update",
        contact_id: "contact-1",
        opportunity_id: "opportunity-1",
        channel: "gmail",
      },
    ],
    messages: [
      {
        id: "inbound-message-1",
        tenant_id: tenantId,
        conversation_id: "conversation-1",
        external_id: "gmail-inbound-1",
        subject: "Project update",
        references_header: "<root@example.test>",
        created_at: "2026-09-20T12:00:00.000Z",
        metadata: { rfc_message_id: "<latest@example.test>" },
      },
    ],
  });
  return {
    memory,
    database: bindTenantDatabaseForTest(memory.client, tenantId),
  };
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function main() {
  const previousKey = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "gmail-draft-test-key";
  const originalFetch = globalThis.fetch;
  try {
    // A successful execution writes only to Gmail's draft endpoint, stores an
    // unsent provider receipt, and replays without creating a second draft.
    {
      const { memory, database } = fixture();
      const requests: Array<{ url: string; method: string; body: string }> = [];
      globalThis.fetch = async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        const body = typeof init?.body === "string" ? init.body : "";
        requests.push({ url, method, body });
        if (method === "POST" && url === "https://gmail.googleapis.com/gmail/v1/users/me/drafts")
          return jsonResponse({
            id: "gmail-draft-1",
            message: { id: "gmail-message-1", threadId: "gmail-thread-1" },
          });
        throw new Error(`Unexpected provider request: ${method} ${url}`);
      };

      const saved = await createGmailDraft(database, draftInput);
      assert.equal(saved.status, "drafted");
      assert.equal(saved.sent, false);
      assert.equal(saved.draftId, "gmail-draft-1");
      assert.equal(saved.threadId, "gmail-thread-1");
      assert.equal(requests.length, 1, "saving a draft must not call any send endpoint");
      assert.equal(requests[0]!.method, "POST");
      const requestBody = JSON.parse(requests[0]!.body) as {
        message: { raw: string; threadId: string };
      };
      assert.equal(requestBody.message.threadId, "gmail-thread-1");
      const raw = Buffer.from(requestBody.message.raw, "base64url").toString("utf8");
      assert.match(raw, /^To: customer@example\.test$/m);
      assert.match(raw, /^Subject: Re: Project update$/m);
      assert.match(raw, /^Message-ID: <[^>]+@example\.test>$/m);
      assert.match(raw, /The revised schedule is ready for your review\./);

      const stored = memory.rows("messages").find((row) => row.id !== "inbound-message-1");
      assert.equal(stored?.status, "drafted");
      assert.equal(stored?.external_id, "gmail-message-1");
      assert.equal(stored?.provider_id, "gmail-message-1");
      assert.equal((stored?.metadata as { sent?: boolean }).sent, false);
      assert.equal(memory.rows("audit_log")[0]?.action, "gmail.draft_saved");

      const replay = await createGmailDraft(database, draftInput);
      assert.equal(replay.recovered, true);
      assert.equal(replay.draftId, "gmail-draft-1");
      assert.equal(requests.length, 1, "an executed idempotency key cannot create a duplicate");
      assert.equal(memory.rows("messages").length, 2);
    }

    // A lost create response is reconciled by exact RFC Message-ID, thread,
    // recipient, subject and body. Recovery performs reads only, never POSTs
    // the draft again.
    {
      const { memory, database } = fixture();
      let rfcMessageId = "";
      const requests: Array<{ url: URL; method: string }> = [];
      globalThis.fetch = async (input, init) => {
        const url = new URL(String(input));
        const method = init?.method ?? "GET";
        requests.push({ url, method });
        if (method === "POST" && url.pathname.endsWith("/drafts")) {
          const requestBody = JSON.parse(String(init?.body)) as {
            message: { raw: string };
          };
          const raw = Buffer.from(requestBody.message.raw, "base64url").toString("utf8");
          rfcMessageId = raw.match(/^Message-ID: (<[^>]+>)$/m)?.[1] ?? "";
          throw new TypeError("connection lost after Gmail accepted the request");
        }
        if (method === "GET" && url.pathname.endsWith("/messages")) {
          assert.match(url.searchParams.get("q") ?? "", /in:drafts rfc822msgid:/);
          assert.ok(rfcMessageId);
          return jsonResponse({ messages: [{ id: "gmail-message-recovered" }] });
        }
        if (method === "GET" && url.pathname.endsWith("/gmail-message-recovered"))
          return jsonResponse({
            id: "gmail-message-recovered",
            threadId: "gmail-thread-1",
            labelIds: ["DRAFT"],
            payload: {
              mimeType: "text/plain",
              body: { data: Buffer.from(draftInput.body).toString("base64url") },
              headers: [
                { name: "Message-ID", value: rfcMessageId },
                { name: "To", value: draftInput.to },
                { name: "Subject", value: draftInput.subject },
              ],
            },
          });
        throw new Error(`Unexpected provider request: ${method} ${url}`);
      };

      await assert.rejects(
        createGmailDraft(database, draftInput),
        /did not confirm whether the draft was saved/,
      );
      assert.equal(
        memory.rows("messages").find((row) => row.id !== "inbound-message-1")?.status,
        "uncertain",
      );

      const recovered = await createGmailDraft(database, draftInput);
      assert.equal(recovered.recovered, true);
      assert.equal(recovered.draftId, null, "Gmail message search does not invent a draft id");
      assert.equal(recovered.messageId, "gmail-message-recovered");
      assert.equal(recovered.sent, false);
      assert.deepEqual(
        requests.map((request) => request.method),
        ["POST", "GET", "GET"],
        "uncertain retry must reconcile by reads, not create another draft",
      );
      assert.equal(memory.rows("messages").length, 2);
      assert.equal(
        memory.rows("messages").find((row) => row.id !== "inbound-message-1")?.status,
        "drafted",
      );
    }

    // The optional least-privilege scope is checked before the provider call.
    {
      const { database } = fixture([]);
      let called = false;
      globalThis.fetch = async () => {
        called = true;
        throw new Error("provider should not be called without compose consent");
      };
      await assert.rejects(createGmailDraft(database, draftInput), /draft access is missing/);
      assert.equal(called, false);
    }

    console.log(
      JSON.stringify({
        result: "passed",
        checks: [
          "draft-endpoint-only",
          "threaded-unsent-receipt",
          "exact-content-and-domain-derived-message-id",
          "idempotent-replay",
          "uncertain-exact-reconciliation-without-retry-post",
          "compose-scope-required-before-provider-call",
        ],
      }),
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
    else process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = previousKey;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
