import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { DEMO_SCENARIOS } from "../src/lib/admin/demo/scenarios";
import {
  createDemoBusinessState,
  handleDemoBusinessRequest,
  DEMO_BUSINESS_MODULES,
} from "../src/lib/admin/demo/business-runtime";
import {
  collectionSummary,
  type CollectionWorkspaceData,
} from "../src/lib/revenue-os/collection-contract";
async function main() {
  for (const path of [
    "scripts/test-collections-actor-bridge.ts",
    "scripts/test-collections-workspace-host.ts",
  ]) {
    const run = spawnSync(process.execPath, ["--import", "tsx", path], {
      stdio: "inherit",
      env: process.env,
    });
    if (run.error) throw run.error;
    assert.equal(run.status, 0);
  }
  for (const pack of Object.values(DEMO_SCENARIOS)) {
    const state = createDemoBusinessState(pack),
      modules: Record<string, boolean> = { ...DEMO_BUSINESS_MODULES };
    let saved = 0;
    const call = async (path: string, method = "GET", body: Record<string, unknown> = {}) => {
      const response = await handleDemoBusinessRequest(
        pack,
        state,
        modules,
        new URL(path, "https://demo.example"),
        method,
        body,
        () => saved++,
      );
      assert.ok(response);
      return { status: response.status, data: await response.json() };
    };
    let workspace = (await call("/api/admin/collections/workspace"))
      .data as CollectionWorkspaceData;
    assert.equal(workspace.cases.length, 6);
    assert.equal(collectionSummary(workspace.cases).paidInvoices, 1);
    const first = workspace.cases[0]!,
      partial = workspace.cases[1]!,
      disputed = workspace.cases[2]!,
      promised = workspace.cases[3]!;
    assert.equal(partial.invoices[0]!.remaining, 7500);
    assert.equal(disputed.disputed, true);
    assert.ok(promised.promiseDate);
    assert.equal(
      (await call("/api/admin/collections/reminders", "POST", { caseId: disputed.id })).status,
      409,
    );
    assert.equal(
      (await call("/api/admin/collections/reminders", "POST", { caseId: promised.id })).status,
      409,
    );
    assert.equal(
      (
        await call("/api/admin/collections", "PATCH", {
          caseId: first.id,
          revision: 999,
          requestId: crypto.randomUUID(),
          patch: { disputed: true },
        })
      ).status,
      409,
    );
    let preview = (await call("/api/admin/collections/reminders", "POST", { caseId: first.id }))
      .data.preview;
    assert.equal(preview.to, first.email);
    assert.ok(preview.html.includes("Payment reminder"));
    let queued = (
      await call("/api/admin/collections/reminders", "POST", {
        caseId: first.id,
        digest: preview.digest,
      })
    ).data.action;
    assert.equal(
      (
        await call("/api/admin/collections/reminders", "POST", {
          caseId: first.id,
          digest: preview.digest,
        })
      ).data.action.id,
      queued.id,
    );
    await call("/api/admin/collections/simulate-payment", "POST", { caseId: first.id });
    assert.equal(
      (await call("/api/admin/revenue-os/actions", "PATCH", { id: queued.id, decision: "approve" }))
        .status,
      409,
    );
    assert.equal(state.actions.find((a) => a.id === queued.id)!.result!.status, "skipped");
    assert.equal(
      state.invoices.find((i) => i.actionId === first.invoices[0]!.creationActionId)!.receipt
        .status,
      "paid",
    );
    preview = (await call("/api/admin/collections/reminders", "POST", { caseId: partial.id })).data
      .preview;
    queued = (
      await call("/api/admin/collections/reminders", "POST", {
        caseId: partial.id,
        digest: preview.digest,
      })
    ).data.action;
    assert.equal(
      (await call("/api/admin/revenue-os/actions", "PATCH", { id: queued.id, decision: "approve" }))
        .status,
      200,
    );
    assert.equal(state.actions.find((a) => a.id === queued.id)!.result!.state, "sent");
    assert.equal(
      (
        await call("/api/admin/revenue-os/actions", "PATCH", {
          id: queued.id,
          decision: "reconcile",
        })
      ).data.result.state,
      "sent",
    );
    assert.equal(
      (await call("/api/admin/revenue-os/actions", "PATCH", { id: queued.id, decision: "approve" }))
        .status,
      409,
    );
    assert.equal(
      (await call("/api/admin/collections/reminders", "POST", { caseId: partial.id })).status,
      409,
    );
    modules["receivables-collections"] = false;
    assert.equal((await call("/api/admin/collections/workspace")).status, 409);
    modules["receivables-collections"] = true;
    workspace = (await call("/api/admin/collections/workspace")).data;
    assert.equal(workspace.cases.find((c) => c.id === first.id)!.status, "settled");
    assert.equal(
      (await call(`/api/admin/collections/workspace?contactId=${partial.contactId}`)).data.cases[0]
        .work[0].id,
      partial.work[0]!.id,
    );
    assert.ok(saved > 0);
    assert.ok(state.receipts.every((r) => r.simulated));
    assert.equal(createDemoBusinessState(pack).collections, undefined);
  }
  console.log(
    "PASS: all demo packs use canonical source invoices/shared workspace contracts; partial/disputed/promised/paid-after-approval, queued content, duplicate/refusal/cooldown, history, module toggle and reset fixtures.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
