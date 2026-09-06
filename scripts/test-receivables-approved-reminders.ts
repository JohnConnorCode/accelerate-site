import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createCollectionsFixture } from "./lib/collections-fixture";
import {
  previewCollectionReminder,
  proposeCollectionReminder,
  executeCollectionReminder,
  reconcileCollectionReminder,
} from "../src/lib/revenue-os/collection-reminders";
import { approveAndExecuteAction } from "../src/lib/revenue-os/action-executor";
import { retryPluginAction } from "../src/lib/revenue-os/actions";
async function main() {
  const { db, caseId, table, state, row, restore } = createCollectionsFixture({ allowSends: true });
  async function propose() {
    const preview = await previewCollectionReminder(db, caseId);
    assert.equal(preview.amountRemaining, state.balance);
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
    assert.equal(state.sends, 0);
    restore();
  }
  try {
    await stale(
      () => {
        state.balance = 0;
      },
      () => {
        state.balance = 7500;
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
    state.timeout = true;
    await assert.rejects(() => approveAndExecuteAction(db, id, "owner@example.test"), /uncertain/);
    assert.equal(state.sends, 1);
    await retryPluginAction(db, id, "owner@example.test");
    await assert.rejects(() => approveAndExecuteAction(db, id, "owner@example.test"), /uncertain/);
    assert.equal(state.sends, 1);
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
    assert.equal(state.sends, 1);
    await assert.rejects(() => previewCollectionReminder(db, caseId), /cooldown/i);
    cfg.modules["receivables-collections"] = false;
    table("action_queue").find((a) => a.id === id)!.expires_at = "2020-01-01T00:00:00.000Z";
    assert.equal((await reconcileCollectionReminder(db, id)).state, "sent");
    assert.equal(state.sends, 1);
    cfg.modules["receivables-collections"] = true;
    // An independent case has a normal confirmed-send path as well.
    table("collection_reminder_attempts").length = 0;
    table("messages").length = 0;
    state.timeout = false;
    const normalId = await propose();
    const sent = (await approveAndExecuteAction(db, normalId, "owner@example.test")) as {
      state: string;
    };
    assert.equal(sent.state, "sent");
    assert.equal(state.sends, 2);
    await assert.rejects(
      () => approveAndExecuteAction(db, normalId, "owner@example.test"),
      /already handled/,
    );
    assert.equal(state.sends, 2);
    await assert.rejects(
      () => executeCollectionReminder(db, randomUUID(), "owner@example.test"),
      /approved/,
    );
    console.log(
      "PASS: branded preview, exact approval binding, paid/disputed/paused/suppressed/changed recipient/disabled refusals, timeout hold and confirmed receipt recovery without duplicate send.",
    );
  } finally {
    restore();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
