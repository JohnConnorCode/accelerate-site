import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { runPsql, POOLER_HOST } from "./lib/accelerate-database.mjs";
import { createCollectionsFixture } from "./lib/collections-fixture";
import { writeJourneyEvidence } from "./lib/reference-journey-evidence";
import { projectCollectionObservation } from "../src/lib/revenue-os/collections";
import { readStripeInvoiceForAction } from "../src/lib/revenue-os/stripe-invoicing";
import {
  previewCollectionReminder,
  proposeCollectionReminder,
} from "../src/lib/revenue-os/collection-reminders";
import { approveAndExecuteAction } from "../src/lib/revenue-os/action-executor";

// This bridge exercises production services over a controlled read transport
// and actual PostgreSQL lifecycle RPCs. It is not a hosted Supabase proof.
async function main() {
  assert.equal(POOLER_HOST, "127.0.0.1", "Disposable local PostgreSQL only");
  assert.ok(process.env.REFERENCE_JOURNEY_OUTPUT);
  const invoice = JSON.parse(
    readFileSync(resolve(process.env.REFERENCE_JOURNEY_OUTPUT, "invoice.json"), "utf8"),
  );
  const literal = (value: unknown) => "'" + String(value).replaceAll("'", "''") + "'";
  const json = (value: unknown) => literal(JSON.stringify(value)) + "::jsonb";
  function sql(input: string) {
    const result = runPsql(["-qAt"], { input });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  }
  const tenant = invoice.tenantId,
    contact = invoice.contactId;
  const context = `SET request.headers=${literal(JSON.stringify({ "x-tenant-id": tenant }))}; SET request.jwt.claim.role='service_role'; SET ROLE service_role;`;
  const fixture = createCollectionsFixture({ allowSends: true, referenceInvoice: invoice });
  const { mem, db, state, restore } = fixture;
  function refresh() {
    for (const table of [
      "collection_cases",
      "collection_case_invoices",
      "collection_observations",
      "collection_reminder_attempts",
      "work_items",
    ]) {
      mem.tables[table] = JSON.parse(
        sql(
          `SELECT coalesce(jsonb_agg(t),'[]') FROM ${table} t WHERE tenant_id=${literal(tenant)};`,
        ),
      );
    }
  }
  try {
    sql(`INSERT INTO tenants(id,slug,name,status,config) VALUES(${literal(tenant)},'reference-receivables','Reference business','active','{"modules":{"receivables-collections":true,"stripe-invoicing":true}}');
    INSERT INTO contacts(id,tenant_id,full_name,primary_email) VALUES(${literal(contact)},${literal(tenant)},'Canonical customer','billing@example.test');
    INSERT INTO integration_connections(tenant_id,provider,status,account_email,credential_version) VALUES(${literal(tenant)},'stripe','connected','acct_fixture',1);
    INSERT INTO action_queue(id,tenant_id,action_type,title,status,payload,result) VALUES(${literal(invoice.creationActionId)},${literal(tenant)},'create_stripe_invoice_draft','Reviewed invoice','executed',${json(invoice.creation.payload)},${json(invoice.creation.result)});`);
    mem.tables.action_queue = [invoice.creation];
    const requestId = randomUUID();
    const sync = (observations: unknown[], request = randomUUID()) =>
      JSON.parse(
        sql(
          context +
            `SELECT sync_collection_observations(${literal(request)},${json(observations)},'owner@example.test');`,
        ),
      );
    const initial = sync([invoice.observation], requestId);
    assert.deepEqual(sync([invoice.observation], requestId), initial);
    assert.equal(initial.caseIds.length, 1);
    const caseId = initial.caseIds[0];
    refresh();
    assert.equal(mem.rows("collection_cases")[0]?.status, "open");
    assert.equal(mem.rows("work_items")[0]?.entity_id, caseId);
    assert.ok(mem.rows("work_items")[0]?.next_check_reason);
    mem.rpc("reserve_collection_reminder", ({ p_action }) => {
      const action = mem.rows("action_queue").find((row) => row.id === p_action)!;
      assert.equal(action.status, "executing");
      assert.equal(action.approved_by, "owner@example.test");
      sql(
        `INSERT INTO action_queue(id,tenant_id,action_type,title,status,approved_by,approved_at,expires_at,payload) VALUES(${literal(action.id)},${literal(tenant)},'send_collection_reminder',${literal(action.title)},'executing',${literal(action.approved_by)},now(),now()+interval '1 day',${json(action.payload)});`,
      );
      const receipt = JSON.parse(
        sql(context + `SELECT reserve_collection_reminder(${literal(p_action)});`),
      );
      refresh();
      return receipt;
    });
    mem.rpc("reconcile_collection_reminder", ({ p_action }) => {
      const message = mem
        .rows("messages")
        .find((row) => row.idempotency_key === `action:${p_action}`)!;
      assert.equal(message.status, "sent");
      assert.ok(message.provider_id);
      sql(`INSERT INTO conversations(id,tenant_id,channel,contact_id) VALUES(${literal(message.conversation_id)},${literal(tenant)},'resend',${literal(contact)}) ON CONFLICT DO NOTHING;
      INSERT INTO messages(id,tenant_id,conversation_id,direction,idempotency_key,status,provider_id,sent_at) VALUES(${literal(message.id)},${literal(tenant)},${literal(message.conversation_id)},'outbound',${literal(message.idempotency_key)},'sent',${literal(message.provider_id)},${literal(message.sent_at)}) ON CONFLICT DO NOTHING;`);
      const receipt = JSON.parse(
        sql(context + `SELECT reconcile_collection_reminder(${literal(p_action)});`),
      );
      refresh();
      return receipt;
    });
    const previewStarted = performance.now();
    const preview = await previewCollectionReminder(db, caseId);
    const previewMs = performance.now() - previewStarted;
    assert.equal(preview.amountRemaining, invoice.observation.remaining);
    const proposed = await proposeCollectionReminder(
      db,
      caseId,
      preview.digest,
      "owner@example.test",
    );
    assert.equal(state.sends, 0);
    const approvalStarted = performance.now();
    const receipt = (await approveAndExecuteAction(db, proposed.id, "owner@example.test")) as {
      state: string;
      message_id: string;
    };
    const approvalMs = performance.now() - approvalStarted;
    assert.equal(receipt.state, "sent");
    assert.equal(state.sends, 1);
    await assert.rejects(
      () => approveAndExecuteAction(db, proposed.id, "owner@example.test"),
      /already handled/,
    );
    assert.equal(state.sends, 1);
    const afterSend = { ...mem.rows("work_items")[0] };
    assert.ok(afterSend.next_check_at);
    await assert.rejects(() => previewCollectionReminder(db, caseId), /cooldown/i);
    state.balance = 0;
    const paid = projectCollectionObservation(
      await readStripeInvoiceForAction(db, invoice.creationActionId),
      new Date().toISOString(),
    );
    sync([paid]);
    refresh();
    assert.equal(mem.rows("collection_cases")[0]?.status, "settled");
    assert.equal(
      mem
        .rows("work_items")
        .filter((row) =>
          ["pending", "claimed", "in_progress", "waiting"].includes(String(row.status)),
        ).length,
      0,
    );
    const events = JSON.parse(
      sql(`SELECT jsonb_agg(t) FROM collection_events t WHERE tenant_id=${literal(tenant)};`),
    );
    writeJourneyEvidence("collections", {
      tenantId: tenant,
      contactId: contact,
      creationActionId: invoice.creationActionId,
      caseId,
      actionId: proposed.id,
      workItemId: afterSend.id,
      receipt,
      nextWorkAfterSend: afterSend,
      stages: [
        "approved_invoice",
        "overdue_observation",
        "case_and_next_work",
        "approved_reminder",
        "confirmed_message",
        "cooldown",
        "verified_paid",
        "settled",
      ],
      providerCalls: { reads: state.reads, sends: state.sends },
      timingsMs: { previewMs, approvalMs },
      events,
      databaseEvidence: "native-postgresql-production-rpcs",
      finalCase: mem.rows("collection_cases")[0],
    });
    console.log(
      "PASS: the approved test invoice feeds real case/replay/reminder reservation, verified message reconciliation, next work and paid settlement transactions.",
    );
  } finally {
    restore();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
