import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { runPsql, POOLER_HOST } from "./lib/accelerate-database.mjs";
import { createCollectionsFixture } from "./lib/collections-fixture";
import { writeJourneyEvidence } from "./lib/reference-journey-evidence";
import {
  previewCollectionReminder,
  proposeCollectionReminder,
} from "../src/lib/revenue-os/collection-reminders";
import { approveAndExecuteAction } from "../src/lib/revenue-os/action-executor";

// Correlated receivables journey: the invoice issued by test-invoicing.ts is
// replayed through the production invoice RPCs on native PostgreSQL, becomes
// overdue, receives one approved reminder, is paid through
// observe_invoice_payment and settles its collection case. Disposable local
// PostgreSQL only; not a hosted Supabase proof.
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
  const tenant = invoice.tenantId as string,
    contact = invoice.contactId as string;
  const claims = `SET request.headers=${literal(JSON.stringify({ "x-tenant-id": tenant }))}; SET request.jwt.claim.role='service_role';`;
  const context = `${claims} SET ROLE service_role;`;
  // Supabase's service_role bypasses row-level security; this disposable
  // cluster's service_role does not, so invoice RPCs run with the same
  // service claim as the bypassing owner, matching hosted privileges.
  const invoiceContext = claims;
  function refreshInto(tables: Record<string, unknown[]>) {
    for (const table of [
      "collection_cases",
      "collection_case_invoices",
      "collection_observations",
      "collection_reminder_attempts",
      "work_items",
    ]) {
      tables[table] = JSON.parse(
        sql(
          `SELECT coalesce(jsonb_agg(t),'[]') FROM ${table} t WHERE tenant_id=${literal(tenant)};`,
        ),
      );
    }
  }
  let restore = () => {};
  try {
    sql(`INSERT INTO tenants(id,slug,name,status,config) VALUES(${literal(tenant)},'reference-receivables','Reference business','active','{"modules":{"receivables-collections":true,"invoicing":true}}');
    INSERT INTO contacts(id,tenant_id,full_name,primary_email) VALUES(${literal(contact)},${literal(tenant)},'Canonical customer','billing@example.test');`);

    // Replay the issued invoice through the production draft and issue RPCs.
    const saved = JSON.parse(
      sql(
        invoiceContext +
          `SELECT save_invoice_draft(NULL,NULL,${json(invoice.draft)},'owner@example.test');`,
      ),
    );
    assert.equal(saved.status, "draft");
    const invoiceId = saved.id as string;
    const fixture = createCollectionsFixture({
      allowSends: true,
      reference: {
        tenantId: tenant,
        contactId: contact,
        invoiceId,
        number: invoice.number,
        amountCents: invoice.amountCents,
      },
    });
    const { mem, db, state } = fixture;
    restore = fixture.restore;
    const refresh = () => refreshInto(mem.tables);
    assert.equal(Number(saved.amount_cents), invoice.amountCents);
    const issue = invoice.issue;
    const issued = JSON.parse(
      sql(
        invoiceContext +
          `SELECT issue_invoice(${literal(invoiceId)},${literal(issue.intentId)},${literal(issue.accountId)},${issue.livemode ? "true" : "false"},${literal(issue.linkHash)},${literal(issue.encryptedLink)});`,
      ),
    );
    assert.equal(issued.status, "open");
    assert.equal(issued.number, invoice.number);
    // The due date passes without payment.
    sql(
      `UPDATE invoices SET due_at=now()-interval '10 days' WHERE tenant_id=${literal(tenant)} AND id=${literal(invoiceId)};`,
    );

    const sync = (request = randomUUID()) =>
      JSON.parse(
        sql(
          context +
            `SELECT sync_collection_observations(${literal(request)},${json([{ invoiceId }])},'owner@example.test');`,
        ),
      );
    const requestId = randomUUID();
    const initial = sync(requestId);
    assert.deepEqual(sync(requestId), initial, "same request replays its receipt");
    assert.equal(initial.caseIds.length, 1);
    const caseId = initial.caseIds[0];
    refresh();
    assert.equal(mem.rows("collection_cases")[0]?.status, "open");
    assert.equal(Number(mem.rows("collection_observations")[0]?.remaining), invoice.amountCents);
    assert.equal(mem.rows("work_items")[0]?.entity_id, caseId);

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
    assert.equal(preview.amountRemaining, invoice.amountCents);
    const proposed = await proposeCollectionReminder(
      db,
      caseId,
      preview.digest,
      "owner@example.test",
    );
    assert.equal(state.sends, 0, "proposing never sends");
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
    assert.equal(state.sends, 1, "a replayed approval never sends twice");
    const afterSend = { ...mem.rows("work_items")[0] };
    await assert.rejects(() => previewCollectionReminder(db, caseId), /cooldown/i);

    // The customer pays: the verified PaymentIntent goes through the production RPC.
    const paid = JSON.parse(
      sql(
        invoiceContext +
          `SELECT observe_invoice_payment(${literal(invoiceId)},'evt_reference_paid',${json({
            intent_id: issue.intentId,
            account_id: issue.accountId,
            livemode: issue.livemode,
            intent_status: "succeeded",
            amount_received: invoice.amountCents,
            charge_id: "py_reference",
          })});`,
      ),
    );
    assert.equal(paid.status, "paid");
    state.balance = 0;
    sync();
    refresh();
    assert.equal(mem.rows("collection_cases")[0]?.status, "settled");
    const events = JSON.parse(
      sql(`SELECT jsonb_agg(t) FROM collection_events t WHERE tenant_id=${literal(tenant)};`),
    );
    writeJourneyEvidence("collections", {
      tenantId: tenant,
      contactId: contact,
      invoiceId,
      paymentIntentId: issue.intentId,
      number: issued.number,
      caseId,
      actionId: proposed.id,
      workItemId: afterSend.id,
      receipt,
      nextWorkAfterSend: afterSend,
      stages: [
        "issued_invoice",
        "overdue_observation",
        "case_and_next_work",
        "approved_reminder",
        "confirmed_message",
        "cooldown",
        "verified_paid",
        "settled",
      ],
      providerCalls: { sends: state.sends },
      timingsMs: { previewMs, approvalMs },
      events,
      databaseEvidence: "native-postgresql-production-rpcs",
      finalCase: mem.rows("collection_cases")[0],
    });
    console.log(
      "PASS: the issued invoice feeds real case/replay/reminder reservation, verified message reconciliation, next work and paid settlement transactions.",
    );
  } finally {
    restore();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
