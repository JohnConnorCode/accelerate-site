import assert from "node:assert/strict";
import { bindTenantDatabaseForTest } from "../src/lib/supabase/server";
import { encryptSecret } from "../src/lib/revenue-os/encryption";
import {
  createGmailDraft,
  GOOGLE_GMAIL_DRAFT_SCOPE,
  syncGmail,
} from "../src/lib/revenue-os/google";
import { AuthorizedMemorySupabase } from "./lib/autonomy-fixture";
import { randomUUID } from "node:crypto";
import { createOpportunity, transitionOpportunity } from "../src/lib/revenue-os/pipeline";
import { createDraftFollowupWork } from "../src/lib/revenue-os/sales-coworker";
import { executeRegisteredRevenueTool } from "../src/lib/revenue-os/ai-tools";
import { approveAndExecuteAction } from "../src/lib/revenue-os/action-executor";
import { writeJourneyEvidence } from "./lib/reference-journey-evidence";

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
  const memory = new AuthorizedMemorySupabase({
    tenants: [{ id: tenantId, status: "active" }],
    kanban_columns: [
      ...["new", "qualified", "won"].map((column_key) => ({
        tenant_id: tenantId,
        board_key: "pipeline",
        column_key,
        label: column_key,
        metadata: { role: column_key === "won" ? "won" : "open" },
      })),
    ],
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
        settings: { gmail_history_id: "history-0" },
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
        primary_email: "customer@example.test",
        full_name: "Customer Example",
        communication_status: "active",
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
    action_queue: [],
    work_items: [],
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
      memory.idFactory = () => randomUUID();
      memory.tables.contacts = [];
      memory.tables.opportunities = [];
      const opportunity = await createOpportunity(database, {
        actorEmail: "operator@example.test",
        name: "Customer Example",
        email: "customer@example.test",
        companyName: "Customer Company",
        source: "controlled_inquiry",
      });
      await transitionOpportunity(database, {
        id: opportunity.id,
        to: "qualified",
        actorEmail: "operator@example.test",
        reason: "Reviewed controlled inquiry",
        source: "reference_journey",
      });
      const conversation = memory.rows("conversations")[0]!;
      conversation.contact_id = opportunity.contact_id;
      conversation.opportunity_id = opportunity.id;
      const followup = await createDraftFollowupWork(database, {
        opportunityId: opportunity.id,
        reason: "Customer requested the revised schedule",
        source: "reference_journey",
        actorEmail: "operator@example.test",
      });
      // The memory transport has no SQL defaults; mirror the initial database status.
      followup.workItem.status = "waiting";
      const toolContext = {
        supabase: database,
        actorEmail: "operator@example.test",
        workItem: followup.workItem,
      };
      const proposalInput = {
        conversationId: conversation.id,
        body: draftInput.body,
        reasoning: followup.workItem.reason,
      };
      const contact = memory.rows("contacts")[0]!;
      // Canonical contacts receive this SQL default on intake.
      contact.communication_status = "active";
      for (const status of ["unsubscribed", "bounced"]) {
        contact.communication_status = status;
        await assert.rejects(
          () => executeRegisteredRevenueTool(toolContext, "propose_gmail_draft", proposalInput),
          /suppressed/,
        );
      }
      contact.communication_status = "active";
      const proposed = (
        await executeRegisteredRevenueTool(toolContext, "propose_gmail_draft", proposalInput)
      ).output as { id: string };
      const replayed = (
        await executeRegisteredRevenueTool(toolContext, "propose_gmail_draft", proposalInput)
      ).output as { id: string };
      assert.equal(replayed.id, proposed.id);
      const approvedInput = {
        ...draftInput,
        actionId: proposed.id,
        contactId: opportunity.contact_id,
        opportunityId: opportunity.id,
        workItem: followup.workItem,
      };
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

      assert.equal(requests.length, 0, "proposal and replay create no provider effect");
      const saved = (await approveAndExecuteAction(
        database,
        proposed.id,
        "operator@example.test",
      )) as Awaited<ReturnType<typeof createGmailDraft>>;
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
      assert.equal(
        memory.rows("audit_log").find((row) => row.action === "gmail.draft_saved")?.action,
        "gmail.draft_saved",
      );

      const replay = await createGmailDraft(database, approvedInput);
      assert.equal(replay.recovered, true);
      assert.equal(replay.draftId, "gmail-draft-1");
      assert.equal(requests.length, 1, "an executed idempotency key cannot create a duplicate");
      assert.equal(memory.rows("messages").length, 2);

      assert.equal(
        memory.rows("action_queue").find((row) => row.id === proposed.id)?.approved_by,
        "operator@example.test",
      );
      Object.assign(
        memory.rows("work_items").find((row) => row.id === followup.workItem.id)!,
        {
          status: "waiting",
          outcome: "Gmail draft saved. Not sent.",
          lease_owner: null,
        },
      );
      memory.rpc("record_evidence", () => ({
        claim_id: "claim-1",
        evidence_id: "evidence-1",
        claim_status: "confirmed",
        best_evidence: "verified_external",
        is_new_claim: false,
      }));
      memory.rpc("stop_campaign_memberships", () => []);

      let threadMessages = [
        {
          id: "gmail-message-1",
          threadId: "gmail-thread-1",
          labelIds: ["SENT"],
          internalDate: String(Date.parse("2026-09-21T12:00:00Z")),
          payload: {
            mimeType: "text/plain",
            body: { data: Buffer.from(draftInput.body).toString("base64url") },
            headers: [
              { name: "From", value: "Operator <operator@example.test>" },
              { name: "To", value: draftInput.to },
              { name: "Subject", value: draftInput.subject },
              { name: "Message-ID", value: saved.rfcMessageId },
            ],
          },
        },
      ];
      let profileReads = 0;
      globalThis.fetch = async (input) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith("/profile")) {
          profileReads += 1;
          return jsonResponse({
            emailAddress: "operator@example.test",
            historyId: `history-${profileReads}`,
          });
        }
        if (url.pathname.endsWith("/history"))
          return jsonResponse({
            history: [{ messagesAdded: [{ message: { threadId: "gmail-thread-1" } }] }],
          });
        if (url.pathname.endsWith("/settings/sendAs")) return jsonResponse({ sendAs: [] });
        if (url.pathname.endsWith("/threads/gmail-thread-1"))
          return jsonResponse({
            id: "gmail-thread-1",
            historyId: `history-${profileReads}`,
            messages: threadMessages,
          });
        throw new Error(`Unexpected sync request: ${url}`);
      };

      const sentSync = await syncGmail(database);
      assert.equal(sentSync.failed, 0);
      assert.equal(
        memory.rows("work_items")[0]?.outcome,
        "Follow-up sent from Gmail. Waiting for a reply.",
        "manual send must update the same open follow-up item",
      );
      assert.ok(memory.rows("work_items")[0]?.next_check_at);
      const sentReceipt = memory
        .rows("messages")
        .find((row) => row.external_id === "gmail-message-1");
      assert.equal(sentReceipt?.status, "sent");

      threadMessages = [
        ...threadMessages,
        {
          id: "gmail-reply-1",
          threadId: "gmail-thread-1",
          labelIds: ["INBOX", "UNREAD"],
          internalDate: String(Date.parse("2026-09-22T12:00:00Z")),
          payload: {
            mimeType: "text/plain",
            body: { data: Buffer.from("Thanks, the schedule looks good.").toString("base64url") },
            headers: [
              { name: "From", value: "Customer Example <customer@example.test>" },
              { name: "To", value: "operator@example.test" },
              { name: "Subject", value: draftInput.subject },
              { name: "Message-ID", value: "<reply@example.test>" },
              { name: "In-Reply-To", value: saved.rfcMessageId },
              { name: "References", value: `<latest@example.test> ${saved.rfcMessageId}` },
            ],
          },
        },
      ];
      const replySync = await syncGmail(database);
      assert.equal(replySync.failed, 0);
      assert.equal(memory.rows("work_items")[0]?.status, "completed");
      assert.match(memory.rows("work_items")[0]?.outcome as string, /canonical contact replied/);
      writeJourneyEvidence("sales", {
        tenantId,
        contactId: opportunity.contact_id,
        companyId: opportunity.company_id,
        opportunityId: opportunity.id,
        actionId: proposed.id,
        workItemId: followup.workItem.id,
        messageId: sentReceipt?.id,
        providerReceipt: saved.draftId,
        stages: [
          "inquiry",
          "qualified",
          "approved_unsent_draft",
          "manual_send_synced",
          "reply_completed",
        ],
        providerCalls: requests.length + profileReads,
        workItem: memory.rows("work_items").find((row) => row.id === followup.workItem.id),
        approval: memory.rows("action_queue").find((row) => row.id === proposed.id)?.approved_by,
      });
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
          "canonical-inquiry-through-qualification-and-approved-executor",
          "suppressed-canonical-contact-refused",
          "draft-endpoint-only",
          "threaded-unsent-receipt",
          "exact-content-and-domain-derived-message-id",
          "idempotent-replay",
          "gmail-manual-send-keeps-the-same-work-item-open-with-a-next-check",
          "canonical-thread-reply-closes-that-work-item",
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
