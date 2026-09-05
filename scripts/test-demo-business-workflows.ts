import assert from "node:assert/strict";
import { DEMO_SCENARIOS } from "../src/lib/admin/demo/scenarios";
import {
  createDemoBusinessState,
  handleDemoBusinessRequest,
  DEMO_BUSINESS_MODULES,
} from "../src/lib/admin/demo/business-runtime";
import { defaultInvoiceDesign } from "../src/lib/revenue-os/invoice-page-contract";
import { workspaceBrandSchema } from "../src/lib/revenue-os/branding-contract";
async function main() {
  for (const pack of Object.values(DEMO_SCENARIOS)) {
    const state = createDemoBusinessState(pack),
      modules: Record<string, boolean> = { ...DEMO_BUSINESS_MODULES };
    let saves = 0;
    const request = async (
      path: string,
      body?: Record<string, unknown>,
      method = body ? "POST" : "GET",
      status = 200,
    ) => {
      const r = await handleDemoBusinessRequest(
        pack,
        state,
        modules,
        new URL(path, "http://localhost"),
        method,
        body ?? {},
        () => saves++,
      );
      assert.ok(r);
      const data = await r.json();
      assert.equal(r.status, status, JSON.stringify(data));
      return data;
    };
    workspaceBrandSchema.parse(state.brand);
    assert.equal(state.invoices.length, 3);
    assert.ok(state.tasks.length >= 4);
    assert.ok(
      state.invoices.every(
        (x) => x.document.customerEmail.endsWith(".example") && !x.document.paymentUrl,
      ),
    );
    const billing = await request("/api/admin/invoicing");
    const contact = billing.contacts[0];
    const input = {
      contactId: contact.id,
      customerId: billing.customers[0].id,
      currency: "usd",
      daysUntilDue: 14,
      memo: pack.business.invoiceMemo,
      lines: pack.business.invoiceLines,
    };
    await request(
      "/api/admin/plugins/workflow",
      { pluginId: "stripe-invoicing", mode: "preview", input: { ...input, lines: [] } },
      "POST",
      422,
    );
    const preview = await request("/api/admin/plugins/workflow", {
      pluginId: "stripe-invoicing",
      mode: "preview",
      input,
    });
    const proposed = {
      pluginId: "stripe-invoicing",
      mode: "propose",
      input,
      digest: preview.digest,
      requestId: crypto.randomUUID(),
    };
    const { action } = await request("/api/admin/plugins/workflow", proposed);
    assert.equal((await request("/api/admin/plugins/workflow", proposed)).action.id, action.id);
    modules["stripe-invoicing"] = false;
    await request(
      "/api/admin/revenue-os/actions",
      { id: action.id, decision: "approve" },
      "PATCH",
      422,
    );
    assert.equal(state.invoices.length, 3);
    modules["stripe-invoicing"] = true;
    await request("/api/admin/revenue-os/actions", { id: action.id, decision: "retry" }, "PATCH");
    await request("/api/admin/revenue-os/actions", { id: action.id, decision: "approve" }, "PATCH");
    await request(
      "/api/admin/revenue-os/actions",
      { id: action.id, decision: "approve" },
      "PATCH",
      422,
    );
    assert.equal(state.invoices.length, 4);
    const send = await request("/api/admin/invoicing", { creationActionId: action.id });
    await request(
      "/api/admin/revenue-os/actions",
      { id: send.action.id, decision: "approve" },
      "PATCH",
    );
    const generated = await request("/api/admin/invoicing/pages", {
      mode: "generate",
      creationActionId: action.id,
      brief: "Editorial layout",
    });
    assert.equal(generated.simulated, true);
    assert.equal(generated.design.introduction, pack.business.introduction);
    const page = await request("/api/admin/invoicing/pages", {
      mode: "preview",
      creationActionId: action.id,
      design: defaultInvoiceDesign,
    });
    const publication = await request("/api/admin/invoicing/pages", {
      mode: "propose",
      creationActionId: action.id,
      design: page.design,
      digest: page.digest,
      requestId: crypto.randomUUID(),
    });
    await request(
      "/api/admin/revenue-os/actions",
      { id: publication.action.id, decision: "approve" },
      "PATCH",
    );
    const pages = await request("/api/admin/invoicing/pages?creationActionId=" + action.id);
    const token = pages.pages[0].token;
    assert.equal(
      (await request("/api/admin/invoicing/pages?token=" + token)).document.total,
      preview.payload.total,
    );
    await request("/api/admin/invoicing/pages", { mode: "revoke", pageId: pages.pages[0].id });
    await request("/api/admin/invoicing/pages?token=" + token, undefined, "GET", 422);
    for (const pluginId of ["client-onboarding", "meeting-commitments"]) {
      const workspace = await request("/api/admin/plugins/tasks?pluginId=" + pluginId);
      const tasks = [
        {
          title: workspace.suggestedTasks[0],
          description: "Reviewed plan",
          dueDate: new Date().toISOString().slice(0, 10),
          assigneeUserId: workspace.currentUserId,
        },
      ];
      const input = {
        [pluginId === "client-onboarding" ? "opportunityId" : "meetingId"]: workspace.records[0].id,
        tasks,
      };
      const preview = await request("/api/admin/plugins/workflow", {
        pluginId,
        mode: "preview",
        input,
      });
      const proposal = await request("/api/admin/plugins/workflow", {
        pluginId,
        mode: "propose",
        input,
        digest: preview.digest,
        requestId: crypto.randomUUID(),
      });
      const executed = await request(
        "/api/admin/revenue-os/actions",
        { id: proposal.action.id, decision: "approve" },
        "PATCH",
      );
      const task = executed.result.tasks[0];
      await request("/api/admin/revenue-os/tasks", { id: task.id, action: "complete" }, "PATCH");
      assert.equal(
        (await request("/api/admin/plugins/tasks?pluginId=" + pluginId)).taskStates[task.id],
        "completed",
      );
      assert.equal(
        state.actions.find((x) => x.id === proposal.action.id)!.result!.tasks instanceof Array,
        true,
      );
    }
    const brand = await request("/api/admin/tenant/branding");
    await request(
      "/api/admin/tenant/branding",
      { brand: { ...brand.brand, name: pack.name + " Studio" }, revision: brand.revision },
      "PUT",
    );
    await request(
      "/api/admin/tenant/branding",
      { brand: brand.brand, revision: brand.revision },
      "PUT",
      422,
    );
    const other = createDemoBusinessState(pack);
    assert.equal(other.brand.name, pack.name);
    assert.equal(other.receipts.length, 0);
    assert.equal(JSON.parse(JSON.stringify(state)).brand.name, pack.name + " Studio");
    assert.ok(saves > 10);
    assert.ok(state.receipts.every((x) => x.simulated));
  }
  console.log(
    "All five business demos: coherent records, invoice review/send/publication/revocation, assigned tasks, disabled/replay/stale-input gates, local receipts and serializable isolated state passed.",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
