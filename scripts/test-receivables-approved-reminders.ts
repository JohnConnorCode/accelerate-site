import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { AuthorizedMemorySupabase } from "./lib/autonomy-fixture";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import { encryptSecret, encryptTenantSecret } from "../src/lib/revenue-os/encryption";
import {
  previewCollectionReminder,
  proposeCollectionReminder,
  executeCollectionReminder,
  reconcileCollectionReminder,
} from "../src/lib/revenue-os/collection-reminders";
import { approveAndExecuteAction } from "../src/lib/revenue-os/action-executor";
import { retryPluginAction } from "../src/lib/revenue-os/actions";
async function main() {
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "controlled-collections-reminder-fixture";
  const tenant = randomUUID(),
    contact = randomUUID(),
    caseId = randomUUID(),
    invoiceAction = randomUUID();
  const mem = new AuthorizedMemorySupabase({
    tenants: [
      {
        id: tenant,
        name: "Example & Sons",
        status: "active",
        config: { modules: { "receivables-collections": true, "stripe-invoicing": true } },
      },
    ],
    contacts: [
      {
        id: contact,
        tenant_id: tenant,
        primary_email: "billing@example.test",
        communication_status: "active",
      },
    ],
    collection_cases: [
      {
        id: caseId,
        tenant_id: tenant,
        contact_id: contact,
        currency: "usd",
        status: "open",
        revision: 1,
        disputed: false,
        paused: false,
        pause_until: null,
        promise_date: null,
      },
    ],
    collection_case_invoices: [
      { tenant_id: tenant, case_id: caseId, creation_action_id: invoiceAction },
    ],
    collection_reminder_attempts: [],
    integration_connections: [
      {
        id: randomUUID(),
        tenant_id: tenant,
        provider: "stripe",
        status: "connected",
        credential_version: 1,
        account_email: "acct_fixture",
        encrypted_credentials: {
          api_key: encryptTenantSecret("rk_test_fixture0000000000", tenant, "stripe", "api_key"),
        },
      },
      {
        id: randomUUID(),
        tenant_id: tenant,
        provider: "resend",
        status: "connected",
        account_email: "finance@example.test",
        encrypted_credentials: { api_key: encryptSecret("re_controlled_fixture") },
      },
    ],
    action_queue: [
      {
        id: invoiceAction,
        tenant_id: tenant,
        action_type: "create_stripe_invoice_draft",
        status: "executed",
        payload: {
          accountId: "acct_fixture",
          testMode: true,
          contactId: contact,
          customerId: "cus_fixture",
          currency: "usd",
        },
        result: { invoiceId: "in_fixture", complete: true },
      },
    ],
  });
  function table(name: string) {
    const rows = mem.tables[name];
    assert.ok(rows);
    return rows;
  }
  const db = bindTenantDatabase(mem.client, tenant, true);
  const original = globalThis.fetch;
  let balance = 7500,
    timeout = false,
    sends = 0;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "api.stripe.com")
      return Response.json({
        id: "in_fixture",
        status: balance ? "open" : "paid",
        currency: "usd",
        amount_due: 10000,
        amount_paid: 10000 - balance,
        amount_remaining: balance,
        livemode: false,
        due_date: 1735689600,
        customer: "cus_fixture",
        hosted_invoice_url: "https://invoice.stripe.com/i/fixture",
        metadata: {
          accelerate_tenant_id: tenant,
          accelerate_action_id: invoiceAction,
          accelerate_contact_id: contact,
        },
      });
    assert.equal(url.hostname, "api.resend.com");
    sends++;
    if (timeout) throw new Error("controlled provider timeout");
    return Response.json({ id: "email_fixture" });
  };
  // Host fixture verifies the actual provider and executor path. The companion
  // PostgreSQL fixture proves the atomic reservation rather than mocking locks.
  mem.rpc("reserve_collection_reminder", ({ p_action }) => {
    assert.equal(table("collection_reminder_attempts").length, 0);
    table("collection_reminder_attempts").push({
      tenant_id: tenant,
      case_id: caseId,
      action_id: p_action,
      state: "dispatching",
    });
    return { state: "dispatching", reserved: true };
  });
  mem.rpc("reconcile_collection_reminder", ({ p_action }) => {
    const attempt = table("collection_reminder_attempts").find((r) => r.action_id === p_action)!;
    const message = table("messages")?.find((r) => r.idempotency_key === `action:${p_action}`);
    if (message?.provider_id && message.sent_at)
      Object.assign(attempt, {
        state: "sent",
        provider_id: message.provider_id,
        sent_at: message.sent_at,
      });
    else attempt.state = "uncertain";
    return attempt;
  });
  const row = () => table("collection_cases")[0]!;
  async function propose() {
    const preview = await previewCollectionReminder(db, caseId);
    assert.equal(preview.amountRemaining, balance);
    assert.equal(preview.to, "billing@example.test");
    assert.match(preview.html, /Example &amp; Sons/);
    assert.match(preview.subject, /^\[Test\]/);
    assert.equal(preview.testMode, true);
    writeFileSync("/tmp/collections-reminder-preview.html", preview.html);
    const action = await proposeCollectionReminder(
      db,
      caseId,
      preview.digest,
      "owner@example.test",
    );
    const id = randomUUID();
    table("action_queue").find((a) => a.id === action.id)!.id = id;
    return id;
  }
  async function stale(change: () => void, restore: () => void) {
    const id = await propose();
    change();
    await assert.rejects(() => approveAndExecuteAction(db, id, "owner@example.test"), /skipped/);
    assert.equal(table("action_queue").find((a) => a.id === id)?.status, "failed");
    assert.equal(
      table("action_queue").find((a) => a.id === id)?.result &&
        (table("action_queue").find((a) => a.id === id)!.result as { status: string }).status,
      "skipped",
    );
    assert.equal(sends, 0);
    restore();
  }
  try {
    await stale(
      () => {
        balance = 0;
      },
      () => {
        balance = 7500;
      },
    );
    await stale(
      () => {
        row().disputed = true;
      },
      () => {
        row().disputed = false;
      },
    );
    await stale(
      () => {
        row().paused = true;
      },
      () => {
        row().paused = false;
      },
    );
    await stale(
      () => {
        table("contacts")[0]!.primary_email = "changed@example.test";
      },
      () => {
        table("contacts")[0]!.primary_email = "billing@example.test";
      },
    );
    await stale(
      () => {
        table("contacts")[0]!.communication_status = "unsubscribed";
      },
      () => {
        table("contacts")[0]!.communication_status = "active";
      },
    );
    const cfg = table("tenants")[0]!.config as { modules: Record<string, boolean> };
    await stale(
      () => {
        cfg.modules["receivables-collections"] = false;
      },
      () => {
        cfg.modules["receivables-collections"] = true;
      },
    );
    const id = await propose();
    timeout = true;
    await assert.rejects(() => approveAndExecuteAction(db, id, "owner@example.test"), /uncertain/);
    assert.equal(sends, 1);
    await retryPluginAction(db, id, "owner@example.test");
    await assert.rejects(() => approveAndExecuteAction(db, id, "owner@example.test"), /uncertain/);
    assert.equal(sends, 1);
    await assert.rejects(() => previewCollectionReminder(db, caseId), /reconciliation/);
    // A late verified provider/webhook receipt resolves uncertainty with no resend.
    Object.assign(table("messages")[0]!, {
      provider_id: "email_late",
      sent_at: new Date().toISOString(),
      status: "sent",
    });
    await retryPluginAction(db, id, "owner@example.test");
    const recovered = (await approveAndExecuteAction(db, id, "owner@example.test")) as {
      state: string;
    };
    assert.equal(recovered.state, "sent");
    assert.equal(sends, 1);
    await assert.rejects(() => previewCollectionReminder(db, caseId), /cooldown/i);
    cfg.modules["receivables-collections"] = false;
    table("action_queue").find((a) => a.id === id)!.expires_at = "2020-01-01T00:00:00.000Z";
    assert.equal((await reconcileCollectionReminder(db, id)).state, "sent");
    assert.equal(sends, 1);
    cfg.modules["receivables-collections"] = true;
    // An independent case has a normal confirmed-send path as well.
    table("collection_reminder_attempts").length = 0;
    table("messages").length = 0;
    timeout = false;
    const normalId = await propose();
    const sent = (await approveAndExecuteAction(db, normalId, "owner@example.test")) as {
      state: string;
    };
    assert.equal(sent.state, "sent");
    assert.equal(sends, 2);
    await assert.rejects(
      () => approveAndExecuteAction(db, normalId, "owner@example.test"),
      /already handled/,
    );
    assert.equal(sends, 2);
    await assert.rejects(
      () => executeCollectionReminder(db, randomUUID(), "owner@example.test"),
      /approved/,
    );
    console.log(
      "PASS: branded preview, exact approval binding, paid/disputed/paused/suppressed/changed recipient/disabled refusals, timeout hold and confirmed receipt recovery without duplicate send.",
    );
  } finally {
    globalThis.fetch = original;
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
